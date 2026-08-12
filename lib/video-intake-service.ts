import type { TranscriptPipelineResult } from "@/lib/transcript-pipeline";
import { isKnownPermanentTranscriptUnavailable, retrieveAndPersistTranscript } from "@/lib/transcript-pipeline";
import { retrieveTranscriptApiVideo } from "@/lib/transcriptapi";
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
  };
  channels: XwadaChannelResult[];
  transcripts: TranscriptPipelineResult[];
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

/**
 * The shared Live-only YouTube and TranscriptAPI intake step.  It deliberately
 * caps transcript work so a slow provider cannot consume an entire scheduled
 * research window. Deferred videos remain persisted and are retried on a
 * later cycle without being represented as a successful transcript.
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

  const failedTranscripts = results.filter((result) => result.status === "failed");
  return {
    runId: run.id,
    runKey: input.runKey,
    generatedAt: new Date().toISOString(),
    status: discoveryFailures.length || failedTranscripts.length || knownUnavailableVideos.length || deferredVideoIds.length ? "attention" : "healthy",
    summary: {
      ...xwadaDiscoverySummary(channels),
      transcriptsReady: results.filter((result) => result.status === "ready").length,
      transcriptFailures: failedTranscripts.length,
      transcriptsUnavailable: knownUnavailableVideos.length,
      cacheHits: results.filter((result) => result.status === "ready" && result.cacheHit).length,
      transcriptsDeferred: deferredVideoIds.length,
    },
    channels,
    transcripts: results,
    knownUnavailableVideos,
    deferredVideoIds,
  };
}
