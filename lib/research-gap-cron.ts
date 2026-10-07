import {
  handleManualResearchGapSnapshotHandoff,
} from "./research-gap-manual-handoff-run.ts";
import {
  handleManualResearchGapWebRun,
} from "./research-gap-manual-web-run.ts";
import { acceptsResearchAuthorization } from "./research-auth.ts";

type ResearchGapCronDependencies = {
  authorised?: (request: Request) => boolean;
  handoff?: (request: Request) => Promise<Response>;
  research?: (request: Request) => Promise<Response>;
};

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function cronAuthorised(request: Request) {
  return acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [process.env.CRON_SECRET],
  );
}

function cronAuthorization() {
  return Promise.resolve({
    authorized: true as const,
    actor: "vercel-cron",
    githubRunId: "vercel-research-gap",
    workflowSha: process.env.VERCEL_GIT_COMMIT_SHA || "vercel-cron",
  });
}

function internalRequest(request: Request, body: Record<string, unknown> = {}) {
  return new Request(request.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function runScheduledHandoff(request: Request) {
  return handleManualResearchGapSnapshotHandoff(
    internalRequest(request),
    { authorize: cronAuthorization },
  );
}

async function runScheduledResearch(request: Request) {
  return handleManualResearchGapWebRun(
    internalRequest(request),
    { authorize: cronAuthorization },
  );
}

async function readJson(result: Response) {
  const raw = await result.text();
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return { status: "failed", error: "Research Gap cron dependency returned non-JSON output." };
  }
}

function authorisedOrResponse(
  request: Request,
  authorised: (request: Request) => boolean,
) {
  if (!process.env.CRON_SECRET?.trim()) {
    return response({ status: "unavailable", error: "CRON_SECRET is not configured." }, 503);
  }
  if (!authorised(request)) {
    return response({ status: "unauthorized", error: "Unauthorized Vercel Cron request." }, 401);
  }
  return null;
}

export async function handleScheduledResearchGapCycle(
  request: Request,
  dependencies: ResearchGapCronDependencies = {},
) {
  const authorised = dependencies.authorised ?? cronAuthorised;
  const authFailure = authorisedOrResponse(request, authorised);
  if (authFailure) return authFailure;

  const handoff = dependencies.handoff ?? runScheduledHandoff;
  const research = dependencies.research ?? runScheduledResearch;

  const handoffResponse = await handoff(request);
  const handoffBody = await readJson(handoffResponse);
  if (!handoffResponse.ok) {
    return response({
      status: "failed",
      stage: "handoff_retry",
      handoff: handoffBody,
    }, handoffResponse.status);
  }

  const handoffState = String(handoffBody?.status || "");
  if (handoffState === "handed_off") {
    return response({
      status: "completed",
      action: "handoff_only",
      handoff: handoffBody,
      research: null,
    });
  }
  if (!["empty", "closed_superseded"].includes(handoffState)) {
    return response({
      status: "failed",
      stage: "handoff_retry",
      handoff: handoffBody,
    }, 500);
  }

  const researchResponse = await research(request);
  const researchBody = await readJson(researchResponse);
  if (!researchResponse.ok) {
    return response({
      status: "failed",
      stage: "research",
      handoff: handoffBody,
      research: researchBody,
    }, researchResponse.status);
  }

  const researchState = String(researchBody?.status || "");
  if (researchState === "empty") {
    return response({
      status: "completed",
      action: handoffState === "closed_superseded"
        ? "closed_superseded_only"
        : "no_work",
      handoff: handoffBody,
      research: researchBody,
    });
  }
  if (researchState !== "completed") {
    return response({
      status: "failed",
      stage: "research",
      handoff: handoffBody,
      research: researchBody,
    }, 500);
  }

  // Canonical handoff is intentionally separated into the later Vercel cron
  // invocation. This keeps the web-research function bounded to one case and
  // preserves the durable COMPLETED retry boundary if canonical Live is down.
  return response({
    status: "completed",
    action: "researched_one",
    caseId: researchBody?.caseId ?? null,
    gapKey: researchBody?.gapKey ?? null,
    handoff: handoffBody,
    research: researchBody,
    canonicalHandoff: "pending_scheduled_retry",
  });
}

export async function handleScheduledResearchGapHandoff(
  request: Request,
  dependencies: ResearchGapCronDependencies = {},
) {
  const authorised = dependencies.authorised ?? cronAuthorised;
  const authFailure = authorisedOrResponse(request, authorised);
  if (authFailure) return authFailure;

  const handoff = dependencies.handoff ?? runScheduledHandoff;
  const handoffResponse = await handoff(request);
  const handoffBody = await readJson(handoffResponse);

  if (!handoffResponse.ok) {
    return response({
      status: "failed",
      stage: "handoff",
      handoff: handoffBody,
    }, handoffResponse.status);
  }

  const state = String(handoffBody?.status || "");
  if (!["handed_off", "empty", "closed_superseded"].includes(state)) {
    return response({
      status: "failed",
      stage: "handoff",
      handoff: handoffBody,
    }, 500);
  }

  return response({
    status: "completed",
    action: state,
    handoff: handoffBody,
  });
}
