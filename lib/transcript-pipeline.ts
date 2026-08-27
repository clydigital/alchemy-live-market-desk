import {
  normalizeTranscriptApiError,
  TranscriptApiError,
  type TranscriptApiRetrieval,
  type TranscriptApiTranscript,
} from "./transcriptapi.ts";

export type TranscriptProvider = "transcriptapi" | "supadata";

export type TranscriptIntakeItem = {
  id: string;
  runId: string;
  videoId: string;
  publisher: string;
  title: string;
  url: string;
  transcriptStatus: "ready" | "missing" | "unavailable" | "not_applicable";
  transcriptProvider?: TranscriptProvider | null;
  // A non-retryable unavailable row is an auditable provider conclusion, not
  // a cache miss. Scheduled intake preserves it as research debt. Structural
  // states remain suppressed; all other non-retryable states are revalidated
  // on a bounded cooldown instead of every scheduled cadence.
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
  provider?: TranscriptProvider;
  transcript: TranscriptApiTranscript;
};

export type TranscriptDebtInput = {
  debtKey: string;
  videoId: string;
  publisher: string;
  provider: TranscriptProvider;
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
  saveSuccess(
    item: TranscriptIntakeItem,
    retrieval: TranscriptApiRetrieval,
    attemptedAt: string,
    provider: TranscriptProvider,
  ): Promise<void>;
  saveFailure(
    item: TranscriptIntakeItem,
    error: TranscriptApiError,
    attemptedAt: string,
    provider: TranscriptProvider,
  ): Promise<void>;
  upsertDebt(item: TranscriptIntakeItem, debt: TranscriptDebtInput): Promise<void>;
  resolveDebt(videoId: string, attemptedAt: string): Promise<void>;
  recalculateRunState(runId: string): Promise<void>;
}

export type TranscriptPipelineResult =
  | {
    status: "ready";
    videoId: string;
    provider: TranscriptProvider;
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
    provider: TranscriptProvider;
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
    provider: TranscriptProvider;
    cacheHit: false;
  };

const TRANSCRIPT_REVALIDATION_MS = 24 * 60 * 60 * 1_000;
const STRUCTURAL_UNAVAILABLE_CODES = new Set([
  "video_deleted",
  "video_not_found",
  "invalid_video_url",
]);

function providerLabel(provider: TranscriptProvider) {
  return provider === "supadata" ? "Supadata" : "TranscriptAPI";
}

function nextAction(error: TranscriptApiError, provider: TranscriptProvider) {
  switch (error.code) {
    case "provider_auth_error": return provider === "supadata"
      ? "Verify the server-side SUPADATA_API_KEY and redeploy; scheduled intake will revalidate after the 24-hour cooldown."
      : "Verify the server-side TRANSCRIPT_API_KEY and redeploy; scheduled intake will revalidate after the 24-hour cooldown.";
    case "provider_payment_required": return `Restore ${providerLabel(provider)} credits or plan access; scheduled intake will revalidate after the 24-hour cooldown.`;
    case "provider_rate_limit": return "Retry after the provider cooldown.";
    case "provider_server_error": return "Retry after bounded backoff; escalate if the provider remains unavailable.";
    case "network_error":
    case "timeout": return "Retry after the network/provider cooldown.";
    case "language_unavailable": return "Keep creator claims blocked and revalidate caption-language availability after the 24-hour cooldown.";
    case "transcript_missing": return "Keep creator claims blocked; scheduled intake will revalidate native-caption availability after the 24-hour cooldown.";
    case "video_private": return "Keep creator claims blocked; scheduled intake will revalidate publisher access after the 24-hour cooldown.";
    case "video_deleted": return "Confirm the source was removed and keep creator claims blocked; scheduled intake will not retry it.";
    case "video_not_found": return "Confirm the canonical YouTube video ID before a manual retry; scheduled intake will not retry it.";
    case "invalid_video_url": return "Correct the canonical YouTube video ID or URL before a manual retry; scheduled intake will not retry it.";
    default: return error.retryable
      ? "Retry after bounded backoff."
      : "Review the preserved provider response; scheduled intake will revalidate after the 24-hour cooldown.";
  }
}

function isStructuralTranscriptUnavailableCode(code: string | null | undefined) {
  return STRUCTURAL_UNAVAILABLE_CODES.has(code || "");
}

export function isRevalidatableTranscriptUnavailable(item: TranscriptIntakeItem) {
  return item.transcriptStatus === "unavailable"
    && item.transcriptRetryable === false
    && !isStructuralTranscriptUnavailableCode(item.transcriptErrorCode);
}

export function isKnownPermanentTranscriptUnavailable(item: TranscriptIntakeItem) {
  return item.transcriptStatus === "unavailable"
    && item.transcriptRetryable === false
    && isStructuralTranscriptUnavailableCode(item.transcriptErrorCode);
}

export function isTranscriptRevalidationDue(
  item: TranscriptIntakeItem,
  nextCheckAt: string | null | undefined,
  now = new Date(),
) {
  if (!isRevalidatableTranscriptUnavailable(item)) return false;
  if (!nextCheckAt) return true;
  const nextCheckTime = Date.parse(nextCheckAt);
  return !Number.isFinite(nextCheckTime) || nextCheckTime <= now.getTime();
}

function nextCheck(error: TranscriptApiError, attemptedAt: Date) {
  if (!error.retryable) {
    if (!isStructuralTranscriptUnavailableCode(error.code)) {
      return new Date(attemptedAt.getTime() + TRANSCRIPT_REVALIDATION_MS).toISOString();
    }
    return null;
  }
  const seconds = error.retryAfterSeconds
    ?? (error.code === "provider_rate_limit" ? 15 * 60 : 30 * 60);
  return new Date(attemptedAt.getTime() + Math.max(60, seconds) * 1_000).toISOString();
}

function readyResult(
  videoId: string,
  transcript: TranscriptApiTranscript,
  retrievedAt: string,
  cacheHit: boolean,
  provider: TranscriptProvider,
): TranscriptPipelineResult {
  return {
    status: "ready",
    videoId,
    provider,
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
  activeRunId?: string;
  provider?: TranscriptProvider;
  now?: () => Date;
}): Promise<TranscriptPipelineResult> {
  const provider = input.provider ?? "transcriptapi";
  const cached = await input.store.findReadyTranscript(input.videoId);
  if (cached) {
    const targetRunId = input.activeRunId ?? cached.runId;
    await input.store.recalculateRunState(targetRunId);
    return readyResult(input.videoId, cached.transcript, cached.retrievedAt, true, cached.provider ?? provider);
  }

  const item = await input.store.findVideoItem(input.videoId);
  if (!item) {
    return { status: "not_found", videoId: input.videoId, provider, cacheHit: false };
  }

  const targetRunId = input.activeRunId ?? item.runId;
  const activeItem = targetRunId === item.runId ? item : { ...item, runId: targetRunId };
  const attemptedDate = input.now?.() ?? new Date();
  const attemptedAt = attemptedDate.toISOString();
  let retrieval: TranscriptApiRetrieval;
  try {
    retrieval = await input.retrieve(input.videoId);
    if (!retrieval.transcript.text.trim()) {
      throw new TranscriptApiError("The transcript provider returned no transcript text.", {
        code: "transcript_missing",
        httpStatus: retrieval.transcript.httpStatus,
        retryable: false,
      });
    }
  } catch (error) {
    const normalized = normalizeTranscriptApiError(error);
    await input.store.saveFailure(activeItem, normalized, attemptedAt, provider);
    const nextCheckAt = nextCheck(normalized, attemptedDate);
    if (activeItem.required) {
      await input.store.upsertDebt(activeItem, {
        debtKey: `transcript:youtube:${input.videoId}`,
        videoId: input.videoId,
        publisher: activeItem.publisher,
        provider,
        reason: normalized.message,
        errorCode: normalized.code,
        httpStatus: normalized.httpStatus,
        retryable: normalized.retryable,
        retryAfterSeconds: normalized.retryAfterSeconds,
        attemptedAt,
        nextCheckAt,
        nextAction: nextAction(normalized, provider),
      });
    }
    await input.store.recalculateRunState(targetRunId);
    return {
      status: "failed",
      videoId: input.videoId,
      provider,
      cacheHit: false,
      errorCode: normalized.code,
      errorMessage: normalized.message,
      httpStatus: normalized.httpStatus,
      retryable: normalized.retryable,
      attemptedAt,
      nextCheckAt,
    };
  }

  // Persistence failures are orchestration failures, not provider failures.
  // Let them propagate so the scheduled run records the true broken edge
  // instead of attempting to overwrite a successful provider response with a
  // fabricated provider error.
  await input.store.saveSuccess(activeItem, retrieval, attemptedAt, provider);
  await input.store.resolveDebt(input.videoId, attemptedAt);
  await input.store.recalculateRunState(targetRunId);
  return readyResult(input.videoId, retrieval.transcript, attemptedAt, false, provider);
}
