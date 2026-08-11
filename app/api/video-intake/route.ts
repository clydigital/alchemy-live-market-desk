import { NextResponse } from "next/server";

import { retrieveAndPersistTranscript } from "@/lib/transcript-pipeline";
import { retrieveTranscriptApiVideo } from "@/lib/transcriptapi";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { runScheduledVideoIntake } from "@/lib/video-intake-service";
import { SupabaseTranscriptStore, type VideoResearchSlot } from "@/lib/youtube-transcript-persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authenticated(request: Request) {
  return acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.RESEARCH_UPDATE_TOKEN,
    process.env.CRON_SECRET,
    process.env.VERCEL_ENV === "production" ? null : process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ]);
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function localParts(now: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

function selectedSlot(now: Date, supplied: string | null): VideoResearchSlot {
  if (supplied === "video_midnight" || supplied === "video_late_morning") return supplied;
  return localParts(now).hour < 6 ? "video_midnight" : "video_late_morning";
}

function scheduledFor(date: string, slot: VideoResearchSlot) {
  const time = slot === "video_midnight" ? "00:40:00" : "11:30:00";
  return `${date}T${time}+08:00`;
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

async function processVideo(videoId: string, store: SupabaseTranscriptStore) {
  const transcriptApiKey = process.env.TRANSCRIPT_API_KEY?.trim() || "";
  return retrieveAndPersistTranscript({
    videoId,
    store,
    retrieve: (id) => retrieveTranscriptApiVideo(id, transcriptApiKey),
  });
}

async function runTarget(videoId: string) {
  if (!validVideoId(videoId)) {
    return response({ status: "failed", videoId, errorCode: "invalid_video_url" }, 400);
  }
  const result = await processVideo(videoId, new SupabaseTranscriptStore());
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

async function runDiscovery(request: Request) {
  const startedAt = new Date();
  const requestUrl = new URL(request.url);
  const slot = selectedSlot(startedAt, requestUrl.searchParams.get("slot"));
  const local = localParts(startedAt);
  const runKey = `${slot}-${local.date}`;
  const intake = await runScheduledVideoIntake({
    slot,
    runKey,
    scheduledFor: scheduledFor(local.date, slot),
    now: startedAt,
  });
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
      transcriptProvider: "TranscriptAPI v2",
      transcriptOrder: ["/youtube/info", "/youtube/transcript"],
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

async function run(request: Request) {
  if (!authenticated(request)) return response({ error: "Unauthorized video intake request." }, 401);
  try {
    const target = await targetFromRequest(request);
    return target ? runTarget(target) : runDiscovery(request);
  } catch (error) {
    return response({
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown video intake failure.",
    }, 500);
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
