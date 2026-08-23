import type { TranscriptPipelineResult } from "@/lib/transcript-pipeline";
import {
  isKnownPermanentTranscriptUnavailable,
  isRevalidatableTranscriptUnavailable,
  isTranscriptRevalidationDue,
  retrieveAndPersistTranscript,
} from "@/lib/transcript-pipeline";
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

async function revalidationNextCheckAt(runClient: Parameters<typeof ensureVideoIntakeItem>[0]["client"], videoId: string) {
  if (!runClient) return null;
  const { data, error } = await runClient
    .from("research_debt")
    .select("next_check_at")
    .eq("debt_key", `transcript:youtube:${videoId}`)
    .eq("status", "open")
    .limit(1)
    .maybeSingle<{ next_check_at: string | null }>();
  if (error) throw new Error(`Could not read transcript revalidation debt: ${error.message}`);
  return data?.next_check_at ?? null;
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

      let suppressUnavailable = isKnownPermanentTranscriptUnavailable(item);
      if (!suppressUnavailable && isRevalidatableTranscriptUnavailable(item)) {
        const nextCheckAt = await revalidationNextCheckAt(run.client, video.videoId);
        suppressUnavailable = !isTranscriptRevalidationDue(item, nextCheckAt, startedAt);
      }

      // Structural failures remain suppressed. Changeable non-retryable states
      // stay visible as research debt but receive one bounded revalidation when
      // their persisted next_check_at becomes due. Legacy rows with no
      // next_check_at are revalidated once, then acquire the new 24-hour clock.
      if (suppressUnavailable) {
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
