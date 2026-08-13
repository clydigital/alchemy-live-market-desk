import {
  normalizeTranscriptApiError,
  type TranscriptApiError,
  type TranscriptApiRetrieval,
  type TranscriptApiTranscript,
} from "./transcriptapi.ts";

export type TranscriptIntakeItem = {
  id: string;
  runId: string;
  videoId: string;
  publisher: string;
  title: string;
  url: string;
  transcriptStatus: "ready" | "missing" | "unavailable" | "not_applicable";
  // A non-retryable unavailable row is an auditable provider conclusion, not
  // a cache miss. Scheduled intake must preserve it without re-spending a
  // TranscriptAPI request on every cadence.
  transcriptRetryable?: boolean | null;
  transcriptErrorCode?: string | null;
  transcriptErrorMessage?: string | null;
  transcriptHttpStatus?: number | null;
  required: boolean;
  attemptCount: number;
};

export type ReadyTranscriptCache = {
  itemId: string;
  runId: string;
  retrievedAt: string;
  transcript: TranscriptApiTranscript;
};

export type TranscriptDebtInput = {
  debtKey: string;
  videoId: string;
  publisher: string;
  provider: "transcriptapi";
  reason: string;
  errorCode: string;
  httpStatus: number | null;
  retryable: boolean;
  retryAfterSeconds: number | null;
  attemptedAt: string;
  nextCheckAt: string | null;
  nextAction: string;
};

export interface TranscriptPipelineStore {
  findReadyTranscript(videoId: string): Promise<ReadyTranscriptCache | null>;
  findVideoItem(videoId: string): Promise<TranscriptIntakeItem | null>;
  saveSuccess(item: TranscriptIntakeItem, retrieval: TranscriptApiRetrieval, attemptedAt: string): Promise<void>;
  saveFailure(item: TranscriptIntakeItem, error: TranscriptApiError, attemptedAt: string): Promise<void>;
  upsertDebt(item: TranscriptIntakeItem, debt: TranscriptDebtInput): Promise<void>;
  resolveDebt(videoId: string, attemptedAt: string): Promise<void>;
  recalculateRunState(runId: string): Promise<void>;
}

export type TranscriptPipelineResult =
  | {
    status: "ready";
    videoId: string;
    provider: "transcriptapi";
    cacheHit: boolean;
    language: string;
    segmentCount: number;
    durationSeconds: number | null;
    textLength: number;
    retrievedAt: string;
  }
  | {
    status: "failed";
    videoId: string;
    provider: "transcriptapi";
    cacheHit: false;
    errorCode: string;
    errorMessage: string;
    httpStatus: number | null;
    retryable: boolean;
    attemptedAt: string;
    nextCheckAt: string | null;
  }
  | {
    status: "not_found";
    videoId: string;
    provider: "transcriptapi";
    cacheHit: false;
  };

function nextAction(error: TranscriptApiError) {
  switch (error.code) {
    case "provider_auth_error": return "Verify the server-side TRANSCRIPT_API_KEY and redeploy.";
    case "provider_payment_required": return "Restore TranscriptAPI credits or plan access, then retry.";
    case "provider_rate_limit": return "Retry after the provider cooldown.";
    case "provider_server_error": return "Retry after bounded backoff; escalate if the provider remains unavailable.";
    case "network_error":
    case "timeout": return "Retry after the network/provider cooldown.";
    case "language_unavailable": return "Review the languages reported by /youtube/info and retry with an available track.";
    case "transcript_missing": return "Confirm caption availability and keep creator claims blocked. Scheduled intake will not retry unless availability changes.";
    case "video_private": return "Confirm publisher access; scheduled intake will not retry while the video remains private.";
    case "video_deleted": return "Confirm the source was removed and keep creator claims blocked; scheduled intake will not retry it.";
    case "video_not_found": return "Confirm the canonical YouTube video ID before a manual retry; scheduled intake will not retry it.";
    case "invalid_video_url": return "Correct the canonical YouTube video ID or URL before a manual retry; scheduled intake will not retry it.";
    default: return error.retryable ? "Retry after bounded backoff." : "Review the preserved provider response before retrying.";
  }
}

export function isKnownPermanentTranscriptUnavailable(item: TranscriptIntakeItem) {
  return item.transcriptStatus === "unavailable" && item.transcriptRetryable === false;
}

function nextCheck(error: TranscriptApiError, attemptedAt: Date) {
  if (!error.retryable) return null;
  const seconds = error.retryAfterSeconds
    ?? (error.code === "provider_rate_limit" ? 15 * 60 : 30 * 60);
  return new Date(attemptedAt.getTime() + Math.max(60, seconds) * 1_000).toISOString();
}

function readyResult(videoId: string, transcript: TranscriptApiTranscript, retrievedAt: string, cacheHit: boolean): TranscriptPipelineResult {
  return {
    status: "ready",
    videoId,
    provider: "transcriptapi",
    cacheHit,
    language: transcript.language,
    segmentCount: transcript.segments.length,
    durationSeconds: transcript.durationSeconds,
    textLength: transcript.text.length,
    retrievedAt,
  };
}

export async function retrieveAndPersistTranscript(input: {
  videoId: string;
  store: TranscriptPipelineStore;
  retrieve: (videoId: string) => Promise<TranscriptApiRetrieval>;
  now?: () => Date;
}): Promise<TranscriptPipelineResult> {
  const cached = await input.store.findReadyTranscript(input.videoId);
  if (cached) {
    await input.store.recalculateRunState(cached.runId);
    return readyResult(input.videoId, cached.transcript, cached.retrievedAt, true);
  }

  const item = await input.store.findVideoItem(input.videoId);
  if (!item) {
    return { status: "not_found", videoId: input.videoId, provider: "transcriptapi", cacheHit: false };
  }

  const attemptedDate = input.now?.() ?? new Date();
  const attemptedAt = attemptedDate.toISOString();
  try {
    const retrieval = await input.retrieve(input.videoId);
    await input.store.saveSuccess(item, retrieval, attemptedAt);
    await input.store.resolveDebt(input.videoId, attemptedAt);
    await input.store.recalculateRunState(item.runId);
    return readyResult(input.videoId, retrieval.transcript, attemptedAt, false);
  } catch (error) {
    const normalized = normalizeTranscriptApiError(error);
    await input.store.saveFailure(item, normalized, attemptedAt);
    const nextCheckAt = nextCheck(normalized, attemptedDate);
    if (item.required) {
      await input.store.upsertDebt(item, {
        debtKey: `transcript:youtube:${input.videoId}`,
        videoId: input.videoId,
        publisher: item.publisher,
        provider: "transcriptapi",
        reason: normalized.message,
        errorCode: normalized.code,
        httpStatus: normalized.httpStatus,
        retryable: normalized.retryable,
        retryAfterSeconds: normalized.retryAfterSeconds,
        attemptedAt,
        nextCheckAt,
        nextAction: nextAction(normalized),
      });
    }
    await input.store.recalculateRunState(item.runId);
    return {
      status: "failed",
      videoId: input.videoId,
      provider: "transcriptapi",
      cacheHit: false,
      errorCode: normalized.code,
      errorMessage: normalized.message,
      httpStatus: normalized.httpStatus,
      retryable: normalized.retryable,
      attemptedAt,
      nextCheckAt,
    };
  }
}

