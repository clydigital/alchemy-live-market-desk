import { NextResponse } from "next/server";

import { acceptsResearchAuthorization } from "@/lib/research-auth";
import {
  claimResearchGapCases,
  listResearchGapCases,
  releaseResearchGapCase,
  syncLatestPrioritisedResearchGapCases,
} from "@/lib/research-gap-lifecycle";

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

async function body(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!authenticated(request)) {
    return response({ error: "Unauthorized Research Gap lifecycle read." }, 401);
  }

  try {
    const cases = await listResearchGapCases();
    return response({
      status: "ready",
      contractVersion: "research-gap-lifecycle/1",
      cases,
    });
  } catch (error) {
    return response({
      error: "Research Gap lifecycle read failed.",
      detail: error instanceof Error ? error.message.slice(0, 500) : "Unknown lifecycle failure.",
    }, 500);
  }
}

export async function POST(request: Request) {
  if (!authenticated(request)) {
    return response({ error: "Unauthorized Research Gap lifecycle mutation." }, 401);
  }

  const input = await body(request);
  if (!input || typeof input.action !== "string") {
    return response({ error: "A lifecycle action is required." }, 400);
  }

  try {
    if (input.action === "sync") {
      const result = await syncLatestPrioritisedResearchGapCases();
      if (!result) {
        return response({
          status: "empty",
          detail: "No persisted Market Dossier V2 is available to synchronise.",
        }, 404);
      }
      return response({ status: "synced", result });
    }

    if (input.action === "claim") {
      const workerId = typeof input.workerId === "string" ? input.workerId : "";
      const batchSize = typeof input.batchSize === "number" ? input.batchSize : undefined;
      const leaseSeconds = typeof input.leaseSeconds === "number" ? input.leaseSeconds : undefined;
      const cases = await claimResearchGapCases({ workerId, batchSize, leaseSeconds });
      return response({
        status: cases.length > 0 ? "claimed" : "empty",
        cases,
      });
    }

    if (input.action === "release") {
      const caseId = typeof input.caseId === "string" ? input.caseId : "";
      const claimToken = typeof input.claimToken === "string" ? input.claimToken : "";
      if (!caseId || !claimToken) {
        return response({ error: "caseId and claimToken are required to release a case." }, 400);
      }
      const released = await releaseResearchGapCase({ caseId, claimToken });
      return response({ status: released ? "released" : "not_owned", released }, released ? 200 : 409);
    }

    return response({ error: "Unsupported Research Gap lifecycle action." }, 400);
  } catch (error) {
    return response({
      error: "Research Gap lifecycle action failed.",
      detail: error instanceof Error ? error.message.slice(0, 500) : "Unknown lifecycle failure.",
    }, 500);
  }
}
