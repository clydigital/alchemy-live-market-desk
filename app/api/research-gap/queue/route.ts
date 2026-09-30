import { NextResponse } from "next/server";

import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { loadLatestResearchGapWorkQueue } from "@/lib/research-gap-worker";

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
    return response({ error: "Unauthorized Research Gap worker." }, 401);
  }

  try {
    const queue = await loadLatestResearchGapWorkQueue();
    if (!queue) {
      return response({
        status: "empty",
        detail: "No persisted Market Dossier V2 is available to seed Research Gap work.",
      }, 404);
    }
    return response({
      status: "ready",
      queue,
    });
  } catch (error) {
    return response({
      error: "Research Gap worker could not read the latest Dossier.",
      detail: error instanceof Error ? error.message.slice(0, 500) : "Unknown queue-read failure.",
    }, 500);
  }
}
