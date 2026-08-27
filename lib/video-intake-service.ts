import type { TranscriptPipelineResult, TranscriptPipelineStore } from "./transcript-pipeline.ts";
import {
  isKnownPermanentTranscriptUnavailable,
  isRevalidatableTranscriptUnavailable,
  isTranscriptRevalidationDue,
  retrieveAndPersistTranscript,
} from "./transcript-pipeline.ts";
import { retrieveSupadataVideo } from "./supadata.ts";
import {
  isSupadataTranscriptChannel,
  selectedSupadataTranscriptChannels,
  SUPADATA_TRANSCRIPT_CHANNEL_PRIORITY,
} from "./supadata-intake-policy.ts";
import { SupadataTranscriptStore } from "./supadata-transcript-store.ts";
import {
  createVideoIntakeRun,
  ensureVideoIntakeItem,
  failVideoIntakeRun,
  finalizeVideoIntakeRun,
  persistDiscoveryResult,
  recordVideoIntakeStage,
  type VideoResearchSlot,
} from "./youtube-transcript-persistence.ts";
import {
  discoverXwadaVideoChannels,
  xwadaDiscoverySummary,
  type XwadaChannelResult,
} from "./youtube-reliability.ts";

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
    shortsSkipped: number;
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
  skippedShortIds: string[];
};

type VideoIntakeClient = Awaited<ReturnType<typeof createVideoIntakeRun>>["client"];

export type ScheduledVideoIntakeDependencies = {
  createRun: typeof createVideoIntakeRun;
  recordStage: typeof recordVideoIntakeStage;
  persistDiscovery: typeof persistDiscoveryResult;
  ensureItem: typeof ensureVideoIntakeItem;
  finalizeRun: typeof finalizeVideoIntakeRun;
  failRun: typeof failVideoIntakeRun;
  discoverChannels: typeof discoverXwadaVideoChannels;
  createStore: (client: VideoIntakeClient) => TranscriptPipelineStore;
  retrieveTranscript: typeof retrieveSupadataVideo;
};

const defaultDependencies: ScheduledVideoIntakeDependencies = {
  createRun: createVideoIntakeRun,
  recordStage: recordVideoIntakeStage,
  persistDiscovery: persistDiscoveryResult,
  ensureItem: ensureVideoIntakeItem,
  finalizeRun: finalizeVideoIntakeRun,
  failRun: failVideoIntakeRun,
  discoverChannels: discoverXwadaVideoChannels,
  createStore: (client) => new SupadataTranscriptStore(client),
  retrieveTranscript: retrieveSupadataVideo,
};

async function processVideo(
  videoId: string,
  store: TranscriptPipelineStore,
  activeRunId: string,
  retrieveTranscript: typeof retrieveSupadataVideo,
) {
  const supadataApiKey = process.env.SUPADATA_API_KEY?.trim() || "";
  return retrieveAndPersistTranscript({
    videoId,
    store,
    activeRunId,
    provider: "supadata",
    // Scheduled work uses a single bounded attempt. Retryable failures are
    // persisted as debt and are picked up by a later cadence rather than
    // holding the full research cycle for minutes.
    retrieve: (id) => retrieveTranscript(id, supadataApiKey, { timeoutMs: 8_000 }),
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
 * Supadata credit spend is intentionally limited to StockedUp, Kevin Gerrity,
 * ClearValue Tax and FX Evolution. Livestreams and short-form uploads are
 * classified upstream and never enter the transcript provider path.
 */
export async function runScheduledVideoIntake(input: {
  slot: VideoResearchSlot;
  runKey: string;
  scheduledFor: string;
  now?: Date;
  maxTranscriptAttempts?: number;
}, dependencyOverrides: Partial<ScheduledVideoIntakeDependencies> = {}): Promise<ScheduledVideoIntakeResult> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const startedAt = input.now ?? new Date();
  const maxTranscriptAttempts = Math.max(1, input.maxTranscriptAttempts ?? DEFAULT_MAX_TRANSCRIPT_ATTEMPTS);
  const run = await dependencies.createRun({
    slot: input.slot,
    runKey: input.runKey,
    scheduledFor: input.scheduledFor,
  });

  let currentStage = "youtube_discovery_started";
  try {
    await dependencies.recordStage({
      runId: run.id,
      slot: input.slot,
      stage: "youtube_discovery_started",
      status: "running",
      client: run.client,
    });

    const store = dependencies.createStore(run.client);
    const channels = await dependencies.discoverChannels(startedAt);
    const totalDetected = channels.reduce((sum, ch) => sum + ch.videos.length, 0);

    const discoveryFailures = channels
      .filter((channel) => !["checked", "no_recent_videos"].includes(channel.status))
      .map((channel) => ({
        source: channel.channelName,
        detail: channel.detail || channel.status,
      }));

    currentStage = "youtube_discovery_complete";
    // Crucial requirement: commit YouTube discovery independently of transcript processing success
    await dependencies.persistDiscovery({
      runId: run.id,
      slot: input.slot,
      channelChecks: channels.map((channel) => ({
        source: channel.channelName,
        status: channel.status,
        itemCount: channel.videos.length,
        note: channel.detail,
      })),
      discoveryFailures,
      videosDetected: totalDetected,
      client: run.client,
    });

    const results: TranscriptPipelineResult[] = [];
    const knownUnavailableVideos: ScheduledVideoIntakeResult["knownUnavailableVideos"] = [];
    const deferredVideoIds: string[] = [];
    const selectedChannels = channels.filter((channel) => isSupadataTranscriptChannel(channel.channelKey));
    const skippedLivestreamIds = selectedChannels.flatMap((channel) => (
      channel.videos.filter((video) => video.isLive === true).map((video) => video.videoId)
    ));
    const skippedShortIds = selectedChannels.flatMap((channel) => (
      channel.videos.filter((video) => video.isShort === true).map((video) => video.videoId)
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

        currentStage = "video_item_persisted";
        const item = await dependencies.ensureItem({
          runId: run.id,
          channelKey: channel.channelKey,
          video,
          client: run.client,
        });

        await dependencies.recordStage({
          runId: run.id,
          slot: input.slot,
          stage: "video_item_persisted",
          status: "complete",
          detail: { videoId: video.videoId, channelKey: channel.channelKey },
          client: run.client,
        });

        let suppressUnavailable = isKnownPermanentTranscriptUnavailable(item);
        if (!suppressUnavailable && isRevalidatableTranscriptUnavailable(item)) {
          const nextCheckAt = await revalidationNextCheckAt(run.client, video.videoId);
          suppressUnavailable = !isTranscriptRevalidationDue(item, nextCheckAt, startedAt);
        }

        if (suppressUnavailable) {
          knownUnavailableVideos.push({
            videoId: video.videoId,
            errorCode: item.transcriptErrorCode || null,
            errorMessage: item.transcriptErrorMessage || null,
            httpStatus: item.transcriptHttpStatus ?? null,
          });
          continue;
        }

        currentStage = "transcript_cache_checked";
        const cached = await store.findReadyTranscript(video.videoId);
        await dependencies.recordStage({
          runId: run.id,
          slot: input.slot,
          stage: "transcript_cache_checked",
          status: "complete",
          detail: { videoId: video.videoId, cacheHit: Boolean(cached), cachedProvider: cached?.provider },
          client: run.client,
        });

        if (cached) {
          const result = await processVideo(video.videoId, store, run.id, dependencies.retrieveTranscript);
          results.push(result);
          currentStage = "transcript_persisted";
          await dependencies.recordStage({
            runId: run.id,
            slot: input.slot,
            stage: "transcript_persisted",
            status: "complete",
            detail: { videoId: video.videoId, cacheHit: true, provider: result.provider },
            client: run.client,
          });
          currentStage = "transcript_state_updated";
          await dependencies.recordStage({
            runId: run.id,
            slot: input.slot,
            stage: "transcript_state_updated",
            status: "complete",
            detail: { videoId: video.videoId, cacheHit: true, provider: result.provider },
            client: run.client,
          });
          continue;
        }

        if (providerAttempts >= maxTranscriptAttempts) {
          deferredVideoIds.push(video.videoId);
          continue;
        }

        currentStage = "supadata_request_started";
        await dependencies.recordStage({
          runId: run.id,
          slot: input.slot,
          stage: "supadata_request_started",
          status: "running",
          detail: { videoId: video.videoId },
          client: run.client,
        });

        const result = await processVideo(video.videoId, store, run.id, dependencies.retrieveTranscript);
        results.push(result);

        await dependencies.recordStage({
          runId: run.id,
          slot: input.slot,
          stage: "supadata_request_started",
          status: "complete",
          detail: { videoId: video.videoId, providerResult: result.status },
          client: run.client,
        });

        currentStage = "supadata_response_received";
        await dependencies.recordStage({
          runId: run.id,
          slot: input.slot,
          stage: "supadata_response_received",
          status: result.status === "ready" ? "complete" : "failed",
          detail: {
            videoId: video.videoId,
            status: result.status,
            provider: result.provider,
            cacheHit: false,
            errorCode: result.status === "failed" ? result.errorCode : undefined,
            errorMessage: result.status === "failed" ? result.errorMessage : undefined,
            httpStatus: result.status === "failed" ? result.httpStatus : undefined,
            retryable: result.status === "failed" ? result.retryable : undefined,
            nextCheckAt: result.status === "failed" ? result.nextCheckAt : undefined,
          },
          client: run.client,
        });

        currentStage = "transcript_persisted";
        await dependencies.recordStage({
          runId: run.id,
          slot: input.slot,
          stage: "transcript_persisted",
          status: result.status === "ready" ? "complete" : "failed",
          detail: { videoId: video.videoId, status: result.status },
          client: run.client,
        });

        currentStage = "transcript_state_updated";
        await dependencies.recordStage({
          runId: run.id,
          slot: input.slot,
          stage: "transcript_state_updated",
          status: "complete",
          detail: { videoId: video.videoId },
          client: run.client,
        });

        if (!result.cacheHit && result.status !== "not_found") providerAttempts += 1;
      }
    }

    currentStage = "source_checks_finalized";
    await dependencies.finalizeRun({
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

    await dependencies.recordStage({
      runId: run.id,
      slot: input.slot,
      stage: "source_checks_finalized",
      status: "complete",
      client: run.client,
    });

    currentStage = "run_completed";
    await dependencies.recordStage({
      runId: run.id,
      slot: input.slot,
      stage: "run_completed",
      status: "complete",
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
        shortsSkipped: skippedShortIds.length,
      },
      channels,
      transcripts: results,
      knownUnavailableVideos,
      deferredVideoIds,
      skippedLivestreamIds,
      skippedShortIds,
    };
  } catch (error) {
    await dependencies.failRun({
      runId: run.id,
      slot: input.slot,
      stage: currentStage,
      error,
      client: run.client,
    });
    throw error;
  }
}
