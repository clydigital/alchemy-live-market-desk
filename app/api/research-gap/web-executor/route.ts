import { NextResponse } from "next/server";

import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { getResearchGapCaseById } from "@/lib/research-gap-lifecycle";
import { isResearchGapPlan, isResearchGapVerdict } from "@/lib/research-gap-plan";
import {
  buildCompletedResearchGapHandoff,
  executeOneResearchGapWebCase,
} from "@/lib/research-gap-web-executor";
import { handleAutomaticResearchGapHandoff } from "@/lib/research-gap-auto-handoff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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
    return {};
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function submitHandoff(request: Request, result: ReturnType<typeof buildCompletedResearchGapHandoff>) {
  const authorization = request.headers.get("authorization");
  const handoffRequest = new Request(new URL("/api/research-gap/handoff", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(result),
  });
  const handoffResponse = await handleAutomaticResearchGapHandoff(handoffRequest);
  const text = await handoffResponse.text();
  let parsed: unknown = null;
  try {
    parsed = text.trim() ? JSON.parse(text) : null;
  } catch {
    parsed = { error: "Research Gap handoff returned non-JSON.", detail: text.slice(0, 500) };
  }
  return {
    ok: handoffResponse.ok,
    status: handoffResponse.status,
    body: parsed,
  };
}

export async function POST(request: Request) {
  if (!authenticated(request)) {
    return response({ error: "Unauthorized Research Gap web executor request." }, 401);
  }

  const input = await body(request);
  const action = clean(input.action) || "run";

  try {
    if (action === "run") {
      const execution = await executeOneResearchGapWebCase({
        workerId: clean(input.workerId) || undefined,
      });
      if (execution.status !== "completed" || !execution.handoff) {
        return response({
          ...execution,
          canonicalHandoff: null,
        });
      }

      const canonicalHandoff = await submitHandoff(request, execution.handoff);
      return response({
        ...execution,
        canonicalHandoff,
      }, canonicalHandoff.ok ? 200 : 502);
    }

    if (action === "retry_handoff") {
      const caseId = clean(input.caseId);
      if (!caseId) return response({ error: "caseId is required for retry_handoff." }, 400);
      const gap = await getResearchGapCaseById(caseId);
      if (!gap || !["COMPLETED", "HANDED_OFF"].includes(gap.status)) {
        return response({ error: "Research Gap case is not completed and cannot be handed off.", caseId }, 409);
      }
      if (!isResearchGapPlan(gap.research_plan) || !isResearchGapVerdict(gap.verdict)) {
        return response({
          error: "Research Gap case lacks a replayable plan/verdict evidence packet.",
          caseId,
        }, 409);
      }
      const handoff = buildCompletedResearchGapHandoff({
        gap,
        plan: gap.research_plan,
        verdict: gap.verdict,
      });
      const canonicalHandoff = await submitHandoff(request, handoff);
      return response({
        status: canonicalHandoff.ok ? "handed_off" : "handoff_failed",
        caseId,
        handoff,
        canonicalHandoff,
      }, canonicalHandoff.ok ? 200 : 502);
    }

    return response({ error: "Unsupported Research Gap web executor action." }, 400);
  } catch (error) {
    return response({
      error: "Research Gap web executor failed.",
      detail: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown executor failure.",
    }, 500);
  }
}
