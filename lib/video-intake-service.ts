import type { TranscriptPipelineResult } from "@/lib/transcript-pipeline";
import { isKnownPermanentTranscriptUnavailable, retrieveAndPersistTranscript } from "@/lib/transcript-pipeline";
import { retrieveTranscriptApiVideo } from "@/lib/transcriptapi";
import { reviewReadyCreatorTranscripts, type TranscriptReviewBatchResult } from "@/lib/transcript-research-review";
import {
  createVideoIntakeRun,
  ensureVideoIntakeItem,
  finalizeVideoIntakeRun,
  SupabaseTranscriptStore,
  type VideoResearchSlot,
} from "@/lib/youtube-transcript-persistence";
import {
  discoverXwadaVideoChannels,
  xwadaDiscoverySummary,
  type XwadaChannelResult,
} from "@/lib/youtube-reliability";

const DEFAULT_MAX_TRANSCRIPT_ATTEMPTS = 6;
const REQUIRED_CHANNEL_KEYS = new Set(["stockedup", "wall-street-truth-bombs", "traders-reality"]);

export type ScheduledVideoIntakeResult = {
  runId: string;
  runKey: string;
  generatedAt: string;
  status: "healthy" | "attention";
  summary: ReturnType<typeof xwadaDiscoverySummary> & {
    transcriptsReady: number;
    transcriptFailures: number;
    transcriptsUnavailable: number;
    cacheHits: number;
    transcriptsDeferred: number;
    transcriptsReviewed: number;
    transcriptReviewFailures: number;
  };
  channels: XwadaChannelResult[];
  transcripts: TranscriptPipelineResult[];
  transcriptReview: TranscriptReviewBatchResult;
  knownUnavailableVideos: Array<{
    videoId: string;
    errorCode: string | null;
    errorMessage: string | null;
    httpStatus: number | null;
  }>;
  deferredVideoIds: string[];
};

async function processVideo(videoId: string, store: SupabaseTranscriptStore) {
  const transcriptApiKey = process.env.TRANSCRIPT_API_KEY?.trim() || "";
  return retrieveAndPersistTranscript({
    videoId,
    store,
    // Scheduled work uses a single bounded attempt. Retryable failures are
    // persisted as debt and are picked up by a later cadence rather than
    // holding the full research cycle for minutes.
    retrieve: (id) => retrieveTranscriptApiVideo(id, transcriptApiKey, { timeoutMs: 8_000, maxAttempts: 1 }),
  });
}

function emptyReviewResult(error?: unknown): TranscriptReviewBatchResult {
  return {
    reviewed: 0,
    failed: error ? 1 : 0,
    considered: 0,
    reviewedVideoIds: [],
    failures: error ? [{
      id: "transcript-review-queue",
      title: "Creator transcript research review",
      error: error instanceof Error ? error.message.slice(0, 500) : "Unknown creator transcript research-review failure.",
    }] : [],
  };
}

async function persistTranscriptReviewHealth(
  runId: string,
  review: TranscriptReviewBatchResult,
  client: Parameters<typeof finalizeVideoIntakeRun>[0]["client"] extends infer T ? NonNullable<T> : never,
) {
  const { data, error } = await client
    .from("research_slot_runs")
    .select("stage_summary,warnings,health_state")
    .eq("research_run_id", runId)
    .maybeSingle<{ stage_summary: Record<string, unknown> | null; warnings: string[] | null; health_state: string | null }>();
  if (error) throw new Error(`Could not read transcript-review slot health: ${error.message}`);
  if (!data) return;
  const reviewWarnings = review.failures.map((failure) => `${failure.title}: transcript research review failed: ${failure.error}`);
  const verificationStatus = review.failed ? "partial" : review.considered ? "complete" : "not_required";
  const { error: updateError } = await client.from("research_slot_runs").update({
    verification_status: verificationStatus,
    ...(review.failed ? { health_state: "degraded" } : {}),
    stage_summary: {
      ...(data.stage_summary ?? {}),
      transcriptReview: {
        status: review.failed ? (review.reviewed ? "partial" : "failed") : review.considered ? "complete" : "not_required",
        considered: review.considered,
        reviewed: review.reviewed,
        failed: review.failed,
      },
    },
    warnings: [...new Set([...(data.warnings ?? []), ...reviewWarnings])],
    updated_at: new Date().toISOString(),
  }).eq("research_run_id", runId);
  if (updateError) throw new Error(`Could not persist transcript-review slot health: ${updateError.message}`);
}

/**
 * The shared Live-only YouTube and TranscriptAPI intake step. It deliberately
 * caps transcript work so a slow provider cannot consume an entire scheduled
 * research window. A retrieved transcript is then reviewed into a research
 * lead before it can become canonical evidence; retrieval alone is not review.
 */
export async function runScheduledVideoIntake(input: {
  slot: VideoResearchSlot;
  runKey: string;
  scheduledFor: string;
  now?: Date;
  maxTranscriptAttempts?: number;
}): Promise<ScheduledVideoIntakeResult> {
  const startedAt = input.now ?? new Date();
  const maxTranscriptAttempts = Math.max(1, input.maxTranscriptAttempts ?? DEFAULT_MAX_TRANSCRIPT_ATTEMPTS);
  const run = await createVideoIntakeRun({
    slot: input.slot,
    runKey: input.runKey,
    scheduledFor: input.scheduledFor,
  });
  const store = new SupabaseTranscriptStore(run.client);
  const channels = await discoverXwadaVideoChannels(startedAt);
  const results: TranscriptPipelineResult[] = [];
  const knownUnavailableVideos: ScheduledVideoIntakeResult["knownUnavailableVideos"] = [];
  const deferredVideoIds: string[] = [];
  let providerAttempts = 0;

  // Process the first new upload from each required channel before spending the
  // bounded TranscriptAPI budget on secondary creators or a second upload.
  const orderedChannels = [...channels].sort((left, right) => (
    Number(REQUIRED_CHANNEL_KEYS.has(right.channelKey)) - Number(REQUIRED_CHANNEL_KEYS.has(left.channelKey))
  ));
  const longestChannel = Math.max(0, ...orderedChannels.map((channel) => channel.videos.length));
  for (let videoIndex = 0; videoIndex < longestChannel; videoIndex += 1) {
    for (const channel of orderedChannels) {
      const video = channel.videos[videoIndex];
      if (!video) continue;
      const item = await ensureVideoIntakeItem({
        runId: run.id,
        channelKey: channel.channelKey,
        video,
        client: run.client,
      });
      // A persisted non-retryable TranscriptAPI conclusion is intentionally
      // kept as open research debt and still blocks the required source. It
      // must not be treated as a cache miss or spend a provider call again.
      if (isKnownPermanentTranscriptUnavailable(item)) {
        knownUnavailableVideos.push({
          videoId: video.videoId,
          errorCode: item.transcriptErrorCode || null,
          errorMessage: item.transcriptErrorMessage || null,
          httpStatus: item.transcriptHttpStatus ?? null,
        });
        continue;
      }
      // Cached transcripts should not consume the provider budget, otherwise a
      // run full of old uploads can defer a fresh required-channel video.
      const cached = await store.findReadyTranscript(video.videoId);
      if (!cached && providerAttempts >= maxTranscriptAttempts) {
        deferredVideoIds.push(video.videoId);
        continue;
      }
      const result = await processVideo(video.videoId, store);
      results.push(result);
      if (!result.cacheHit && result.status !== "not_found") providerAttempts += 1;
    }
  }

  // Review a diverse bounded batch. Review is deliberately separate from
  // retrieval state: a provider success is not equivalent to a researched lead.
  let transcriptReview = emptyReviewResult();
  try {
    transcriptReview = await reviewReadyCreatorTranscripts({ client: run.client, maxReviews: 6 });
  } catch (error) {
    transcriptReview = emptyReviewResult(error);
  }

  const discoveryFailures = channels
    .filter((channel) => !["checked", "no_recent_videos"].includes(channel.status))
    .map((channel) => ({
      source: channel.channelName,
      detail: channel.detail || channel.status,
    }));
  await finalizeVideoIntakeRun({
    runId: run.id,
    slot: input.slot,
    channelChecks: channels.map((channel) => ({
      source: channel.channelName,
      status: channel.status,
      itemCount: channel.videos.length,
      note: channel.detail,
    })),
    results,
    knownUnavailableVideos,
    deferredVideoIds,
    discoveryFailures,
    client: run.client,
  });
  try {
    await persistTranscriptReviewHealth(run.id, transcriptReview, run.client);
  } catch (error) {
    transcriptReview = {
      ...transcriptReview,
      failed: transcriptReview.failed + 1,
      failures: [...transcriptReview.failures, {
        id: "transcript-review-health",
        title: "Transcript review health persistence",
        error: error instanceof Error ? error.message.slice(0, 500) : "Unknown transcript review health persistence failure.",
      }],
    };
  }

  const failedTranscripts = results.filter((result) => result.status === "failed");
  return {
    runId: run.id,
    runKey: input.runKey,
    generatedAt: new Date().toISOString(),
    status: discoveryFailures.length || failedTranscripts.length || knownUnavailableVideos.length || deferredVideoIds.length || transcriptReview.failed
      ? "attention"
      : "healthy",
    summary: {
      ...xwadaDiscoverySummary(channels),
      transcriptsReady: results.filter((result) => result.status === "ready").length,
      transcriptFailures: failedTranscripts.length,
      transcriptsUnavailable: knownUnavailableVideos.length,
      cacheHits: results.filter((result) => result.status === "ready" && result.cacheHit).length,
      transcriptsDeferred: deferredVideoIds.length,
      transcriptsReviewed: transcriptReview.reviewed,
      transcriptReviewFailures: transcriptReview.failed,
    },
    channels,
    transcripts: results,
    transcriptReview,
    knownUnavailableVideos,
    deferredVideoIds,
  };
}
