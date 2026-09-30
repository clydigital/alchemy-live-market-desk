import { NextResponse } from "next/server";

import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { loadPrioritisedResearchGapWork } from "@/lib/research-gap-prioritizer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function authenticated(request: Request) {
  return acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [process.env.RESEARCH_UPDATE_TOKEN, process.env.CRON_SECRET],
  );
}

export async function GET(request: Request) {
  if (!authenticated(request)) {
    return response({ error: "Unauthorized Research Gap prioritizer." }, 401);
  }

  try {
    const priorityQueue = await loadPrioritisedResearchGapWork();
    if (!priorityQueue) {
      return response({
        status: "empty",
        detail: "No persisted Market Dossier V2 is available to prioritise.",
      }, 404);
    }

    return response({
      status: "ready",
      priorityQueue,
    });
  } catch (error) {
    return response({
      error: "Research Gap prioritization failed.",
      detail: error instanceof Error ? error.message.slice(0, 500) : "Unknown prioritization failure.",
    }, 500);
  }
}
