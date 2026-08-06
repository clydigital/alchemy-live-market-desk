import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { scanXwadaVideoChannels, xwadaSummary } from "@/lib/youtube-reliability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const updateToken = process.env.RESEARCH_UPDATE_TOKEN;

function authenticated(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!updateToken || supplied.length !== updateToken.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(updateToken));
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

async function run(request: Request) {
  if (!authenticated(request)) return response({ error: "Unauthorized video intake request." }, 401);

  const startedAt = new Date();
  const channels = await scanXwadaVideoChannels(startedAt);
  const summary = xwadaSummary(channels);
  const failed = channels.filter((channel) => !["checked", "no_recent_videos"].includes(channel.status));

  return response({
    engine: "XWADA",
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kuala_Lumpur",
    policy: {
      discovery: "YouTube Data API uploads playlist",
      uploadsPerChannel: 10,
      backfillHours: 72,
      transcriptProvider: "TranscriptAPI",
      failureRule: "Discovery and provider errors are reported explicitly and never converted to no_recent_videos.",
    },
    status: failed.length ? "attention" : "healthy",
    summary,
    channels,
  }, failed.length ? 207 : 200);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
