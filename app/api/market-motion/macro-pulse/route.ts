import { NextResponse } from "next/server";

import {
  MacroPulseMotionInputError,
  persistMarketMotionFromMacroPulseCandidates,
  type MacroPulseMotionSubmission,
} from "@/lib/market-motion-ingestion";
import { acceptsResearchAuthorization } from "@/lib/research-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

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

export async function POST(request: Request) {
  if (!authenticated(request)) {
    return response({ error: "Unauthorized Macro Pulse Motion bridge." }, 401);
  }

  let submission: MacroPulseMotionSubmission;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "A Macro Pulse Motion submission object is required." }, 400);
    }
    submission = body as MacroPulseMotionSubmission;
  } catch {
    return response({ error: "The Macro Pulse Motion request body is not valid JSON." }, 400);
  }

  try {
    const result = await persistMarketMotionFromMacroPulseCandidates({ submission });
    return response({
      status: "accepted",
      contractVersion: "macro-pulse-motion-candidate/v1",
      discoveryOnly: true,
      canonicalMutation: false,
      result,
    });
  } catch (error) {
    if (error instanceof MacroPulseMotionInputError) {
      return response({
        error: "Macro Pulse Motion candidate validation failed.",
        errors: error.errors,
      }, 422);
    }
    return response({
      error: "Macro Pulse Motion bridge failed.",
      detail: error instanceof Error ? error.message.slice(0, 500) : "Unknown Macro Pulse Motion failure.",
    }, 500);
  }
}
