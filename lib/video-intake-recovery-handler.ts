import { NextResponse } from "next/server.js";

import { acceptsResearchAuthorization } from "./research-auth.ts";
import { ensureScheduledVideoDiscovery } from "./scheduled-video-recovery.ts";
import type { ScheduledVideoSlot } from "./scheduled-video-identity.ts";

function authenticated(request: Request) {
  return acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.RESEARCH_UPDATE_TOKEN,
    process.env.CRON_SECRET,
    process.env.VERCEL_ENV === "production" ? null : process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ]);
}

export async function handleScheduledVideoRecoveryRequest(
  request: Request,
  slot: ScheduledVideoSlot,
) {
  if (!authenticated(request)) {
    return NextResponse.json(
      { status: "unauthorized", slot },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await ensureScheduledVideoDiscovery(slot);
  console.info(JSON.stringify({
    event: "scheduled_video_discovery_recovery",
    slot,
    action: result.action,
    runKey: result.runKey,
    runId: result.runId,
    detail: result.detail,
  }));

  return NextResponse.json(result, {
    status: result.action === "failed" ? 503 : 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
