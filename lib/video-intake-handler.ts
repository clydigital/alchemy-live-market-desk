import { NextResponse } from "next/server.js";

import { acceptsResearchAuthorization } from "./research-auth.ts";
import { scheduledVideoRunIdentity, type ScheduledVideoSlot } from "./scheduled-video-identity.ts";
import { retrieveSupadataVideo } from "./supadata.ts";
import { SupadataTranscriptStore } from "./supadata-transcript-store.ts";
import { retrieveAndPersistTranscript, type TranscriptPipelineStore } from "./transcript-pipeline.ts";
import { runScheduledVideoIntake } from "./video-intake-service.ts";
import type { VideoResearchSlot } from "./youtube-transcript-persistence.ts";

function authenticated(request: Request) {
  return acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.RESEARCH_UPDATE_TOKEN,
    process.env.CRON_SECRET,
    process.env.VERCEL_ENV === "production" ? null : process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ]);
}

export type VideoIntakeHandlerDependencies = {
  authenticate: (request: Request) => boolean;
  now: () => Date;
  createStore: () => TranscriptPipelineStore;
  retrieveTranscript: typeof retrieveSupadataVideo;
  runScheduled: typeof runScheduledVideoIntake;
};

const defaultDependencies: VideoIntakeHandlerDependencies = {
  authenticate: authenticated,
  now: () => new Date(),
  createStore: () => new SupadataTranscriptStore(),
  retrieveTranscript: retrieveSupadataVideo,
  runScheduled: runScheduledVideoIntake,
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function localHour(now: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  return Number(values.hour);
}

function selectedSlot(now: Date, supplied: string | null): VideoResearchSlot {
  if (supplied === "video_midnight" || supplied === "video_late_morning") return supplied;
  return localHour(now) < 6 ? "video_midnight" : "video_late_morning";
}

function validVideoId(value: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}

async function targetFromRequest(request: Request) {
  const url = new URL(request.url);
  const queryValue = url.searchParams.get("videoId")?.trim();
  if (queryValue) return queryValue;
  if (request.method !== "POST") return null;
  const body = await request.json().catch(() => null) as { videoId?: unknown } | null;
  return typeof body?.videoId === "string" ? body.videoId.trim() : null;
}

async function processVideo(
  videoId: string,
  store: TranscriptPipelineStore,
  retrieveTranscript: typeof retrieveSupadataVideo,
) {
  const supadataApiKey = process.env.SUPADATA_API_KEY?.trim() || "";
  return retrieveAndPersistTranscript({
    videoId,
    store,
    provider: "supadata",
    retrieve: (id) => retrieveTranscript(id, supadataApiKey, { timeoutMs: 8_000 }),
  });
}

async function runTarget(videoId: string, dependencies: VideoIntakeHandlerDependencies) {
  if (!validVideoId(videoId)) {
    return response({ status: "failed", videoId, errorCode: "invalid_video_url" }, 400);
  }
  const result = await processVideo(videoId, dependencies.createStore(), dependencies.retrieveTranscript);
  if (result.status === "not_found") {
    return response({
      status: "not_found",
      videoId,
      detail: "The video must already exist in research_intake_items before a targeted retry.",
    }, 404);
  }
  return response({
    engine: "XWADA",
    mode: "targeted_transcript_retry",
    generatedAt: new Date().toISOString(),
    result,
  }, result.status === "ready" ? 200 : 502);
}

async function runDiscovery(
  request: Request,
  dependencies: VideoIntakeHandlerDependencies,
  forcedSlot?: ScheduledVideoSlot,
) {
  const startedAt = dependencies.now();
  const requestUrl = new URL(request.url);
  const slot = forcedSlot ?? selectedSlot(startedAt, requestUrl.searchParams.get("slot"));
  const { runKey, scheduledFor } = scheduledVideoRunIdentity(slot, startedAt);
  const intake = await dependencies.runScheduled({ slot, runKey, scheduledFor, now: startedAt });
  return response({
    engine: "XWADA",
    mode: "scheduled_video_intake",
    runId: intake.runId,
    runKey,
    generatedAt: intake.generatedAt,
    timezone: "Asia/Kuala_Lumpur",
    policy: {
      discovery: "YouTube Data API uploads playlist",
      uploadsPerChannel: 10,
      backfillHours: 72,
      transcriptProvider: "Supadata native captions",
      transcriptMode: "native",
      transcriptFormat: "timestamped",
      generatedTranscriptFallback: false,
      cache: "Database-first; completed transcripts are never fetched twice.",
      failureRule: "Required transcript failures stay blocked and create idempotent research debt; overflow is deferred to the next scheduled intake window.",
    },
    status: intake.status,
    summary: intake.summary,
    channels: intake.channels.map((channel) => ({
      channelKey: channel.channelKey,
      channelName: channel.channelName,
      status: channel.status,
      scannedCount: channel.scannedCount,
      recentCount: channel.recentCount,
      detail: channel.detail,
    })),
    transcripts: intake.transcripts,
    deferredVideoIds: intake.deferredVideoIds,
  }, intake.status === "attention" ? 207 : 200);
}

/** Shared public and Vercel-cron handler; a forced slot never relies on a query string. */
export async function handleVideoIntakeRequest(
  request: Request,
  forcedSlot?: ScheduledVideoSlot,
  dependencyOverrides: Partial<VideoIntakeHandlerDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  if (!dependencies.authenticate(request)) return response({ error: "Unauthorized video intake request." }, 401);
  try {
    const target = forcedSlot ? null : await targetFromRequest(request);
    return target
      ? await runTarget(target, dependencies)
      : await runDiscovery(request, dependencies, forcedSlot);
  } catch (error) {
    return response({
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown video intake failure.",
    }, 500);
  }
}
