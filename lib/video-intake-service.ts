import type { TranscriptPipelineResult } from "@/lib/transcript-pipeline";
import {
  isKnownPermanentTranscriptUnavailable,
  isRevalidatableTranscriptUnavailable,
  isTranscriptRevalidationDue,
  retrieveAndPersistTranscript,
} from "@/lib/transcript-pipeline";
import { retrieveSupadataVideo } from "@/lib/supadata";
import {
  isSupadataTranscriptChannel,
  selectedSupadataTranscriptChannels,
  SUPADATA_TRANSCRIPT_CHANNEL_PRIORITY,
} from "@/lib/supadata-intake-policy";
import { SupadataTranscriptStore } from "@/lib/supadata-transcript-store";
import {
  createVideoIntakeRun,
  ensureVideoIntakeItem,
  finalizeVideoIntakeRun,
  type VideoResearchSlot,
} from "@/lib/youtube-transcript-persistence";
import {
  discoverXwadaVideoChannels,
  xwadaDiscoverySummary,
  type XwadaChannelResult,
} from "@/lib/youtube-reliability";

const DEFAULT_MAX_TRANSCRIPT_ATTEMPTS = 6;
export { isSupadataTranscriptChannel, selectedSupadataTranscriptChannels, SUPADATA_TRANSCRIPT_CHANNEL_PRIORITY };

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
    livestreamsSkipped: number;
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
  skippedLivestreamIds: string[];
};

async function processVideo(videoId: string, store: SupadataTranscriptStore) {
  const supadataApiKey = process.env.SUPADATA_API_KEY?.trim() || "";
  return retrieveAndPersistTranscript({
    videoId,
    store,
    provider: "supadata",
    // Scheduled work uses a single bounded attempt. Retryable failures are
    // persisted as debt and are picked up by a later cadence rather than
    // holding the full research cycle for minutes.
    retrieve: (id) => retrieveSupadataVideo(id, supadataApiKey, { timeoutMs: 8_000 }),
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
 * The shared Live-only YouTube intake step. Discovery remains broad, while
 * Supadata credit spend is intentionally limited to StockedUp, Kevin Gerrity
 * and ClearValue Tax. Livestreams are classified upstream and never enter the
 * transcript provider path.
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
  const store = new SupadataTranscriptStore(run.client);
  const channels = await discoverXwadaVideoChannels(startedAt);
  const results: TranscriptPipelineResult[] = [];
  const knownUnavailableVideos: ScheduledVideoIntakeResult["knownUnavailableVideos"] = [];
  const deferredVideoIds: string[] = [];
  const selectedChannels = channels.filter((channel) => isSupadataTranscriptChannel(channel.channelKey));
  const skippedLivestreamIds = selectedChannels.flatMap((channel) => (
    channel.videos.filter((video) => video.isLive === true).map((video) => video.videoId)
  ));
  const orderedChannels = selectedSupadataTranscriptChannels(channels);
  let providerAttempts = 0;

  // Process one upload from each selected channel before spending a second
  // Supadata credit on another upload from the same creator.
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
      // run full of old uploads can defer a fresh selected-channel video.
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
      livestreamsSkipped: skippedLivestreamIds.length,
    },
    channels,
    transcripts: results,
    knownUnavailableVideos,
    deferredVideoIds,
    skippedLivestreamIds,
  };
}
