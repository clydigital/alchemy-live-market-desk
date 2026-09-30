import { NextResponse } from "next/server";

import { acceptsResearchAuthorization } from "@/lib/research-auth";
import {
  completeResearchGapCase,
  getOwnedResearchGapCase,
  startResearchGapCase,
} from "@/lib/research-gap-lifecycle";
import {
  buildResearchGapPlan,
  evaluateResearchGapEvidence,
  isResearchGapPlan,
  validateResearchGapEvidenceAssessments,
  type ResearchGapEvidenceAssessment,
} from "@/lib/research-gap-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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

async function readBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!authenticated(request)) {
    return response({ error: "Unauthorized Research Gap execution request." }, 401);
  }

  const input = await readBody(request);
  if (!input || typeof input.action !== "string") {
    return response({ error: "A Research Gap execution action is required." }, 400);
  }

  const caseId = text(input.caseId);
  const claimToken = text(input.claimToken);
  if (!caseId || !claimToken) {
    return response({ error: "caseId and claimToken are required." }, 400);
  }

  try {
    if (input.action === "start") {
      const gap = await getOwnedResearchGapCase({
        caseId,
        claimToken,
        statuses: ["CLAIMED", "RESEARCHING"],
      });
      if (!gap) {
        return response({
          error: "The Research Gap case is not owned by this claim or its lease is no longer active.",
        }, 409);
      }

      if (gap.status === "RESEARCHING" && isResearchGapPlan(gap.research_plan)) {
        return response({
          status: "researching",
          replayed: true,
          case: gap,
          plan: gap.research_plan,
        });
      }

      const plan = buildResearchGapPlan(gap);
      const started = await startResearchGapCase({
        caseId,
        claimToken,
        planVersion: plan.contractVersion,
        plan,
      });
      if (!started) {
        return response({
          error: "Research Gap start lost claim ownership or the lease expired.",
        }, 409);
      }

      return response({
        status: "researching",
        replayed: false,
        case: started,
        plan,
      });
    }

    if (input.action === "evaluate") {
      const gap = await getOwnedResearchGapCase({
        caseId,
        claimToken,
        statuses: ["RESEARCHING"],
      });
      if (!gap) {
        return response({
          error: "The Research Gap case is not in an owned RESEARCHING state.",
        }, 409);
      }
      if (!isResearchGapPlan(gap.research_plan)) {
        return response({
          error: "The Research Gap case has no valid persisted research plan.",
        }, 409);
      }

      const rawEvidence = input.evidence;
      const validationErrors = validateResearchGapEvidenceAssessments(
        gap.research_plan,
        rawEvidence,
      );
      if (validationErrors.length) {
        return response({
          error: "Research Gap evidence assessment validation failed.",
          errors: validationErrors,
        }, 422);
      }

      const branchCount = typeof input.branchCount === "number"
        ? input.branchCount
        : undefined;
      const verdict = evaluateResearchGapEvidence({
        plan: gap.research_plan,
        evidence: rawEvidence as ResearchGapEvidenceAssessment[],
        branchCount,
      });

      if (!verdict.shouldStop) {
        return response({
          status: "researching",
          completed: false,
          caseId,
          verdict,
        });
      }

      const completed = await completeResearchGapCase({
        caseId,
        claimToken,
        outcome: verdict.outcome,
        verdictVersion: verdict.contractVersion,
        verdict,
        completedAt: verdict.evaluatedAt,
      });
      if (!completed) {
        return response({
          error: "Research Gap completion lost claim ownership or the lease expired.",
        }, 409);
      }

      return response({
        status: "completed",
        completed: true,
        case: completed,
        verdict,
      });
    }

    return response({ error: "Unsupported Research Gap execution action." }, 400);
  } catch (error) {
    return response({
      error: "Research Gap execution failed.",
      detail: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown execution failure.",
    }, 500);
  }
}
