import type { TranscriptPipelineResult } from "@/lib/transcript-pipeline";
import { retrieveAndPersistTranscript } from "@/lib/transcript-pipeline";
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
    cacheHits: number;
    transcriptsDeferred: number;
  };
  channels: XwadaChannelResult[];
  transcripts: TranscriptPipelineResult[];
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
  const deferredVideoIds: string[] = [];

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
      await ensureVideoIntakeItem({
        runId: run.id,
        channelKey: channel.channelKey,
        video,
        client: run.client,
      });
      if (results.length >= maxTranscriptAttempts) {
        deferredVideoIds.push(video.videoId);
        continue;
      }
      results.push(await processVideo(video.videoId, store));
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
    deferredVideoIds,
    discoveryFailures,
    client: run.client,
  });

  const failedTranscripts = results.filter((result) => result.status === "failed");
  return {
    runId: run.id,
    runKey: input.runKey,
    generatedAt: new Date().toISOString(),
    status: discoveryFailures.length || failedTranscripts.length || deferredVideoIds.length ? "attention" : "healthy",
    summary: {
      ...xwadaDiscoverySummary(channels),
      transcriptsReady: results.filter((result) => result.status === "ready").length,
      transcriptFailures: failedTranscripts.length,
      cacheHits: results.filter((result) => result.status === "ready" && result.cacheHit).length,
      transcriptsDeferred: deferredVideoIds.length,
    },
    channels,
    transcripts: results,
    deferredVideoIds,
  };
}
