import { NextResponse } from "next/server";

import {
  getRegimeShadowHealth,
  persistRegimeShadowProjectionSafely,
} from "@/lib/regime-engine";
import { verifyGitHubActionsManualLiveTrigger } from "@/lib/manual-live-trigger-auth";
import { acceptsResearchAuthorization } from "@/lib/research-auth";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  if (acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.RESEARCH_UPDATE_TOKEN,
    process.env.CRON_SECRET,
  ])) {
    return {
      authorized: true as const,
      transport: "static" as const,
      actor: "internal-static",
      githubRunId: null as string | null,
      workflowSha: null as string | null,
    };
  }

  const github = await verifyGitHubActionsManualLiveTrigger(request);
  if (!github.authorized) return { authorized: false as const };

  return {
    authorized: true as const,
    transport: "github-actions-oidc" as const,
    actor: github.actor,
    githubRunId: github.githubRunId,
    workflowSha: github.workflowSha,
  };
}

export async function GET(request: Request) {
  const authorization = await authorize(request);
  if (!authorization.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const health = await getRegimeShadowHealth();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: "shadow",
    health,
    note: "This endpoint exposes Regime projection health only. Private evidence and prompt payloads are omitted.",
  });
}

export async function POST(request: Request) {
  const authorization = await authorize(request);
  if (!authorization.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { triggerRef?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const triggerRef = typeof body.triggerRef === "string" && body.triggerRef.trim()
    ? body.triggerRef.trim().slice(0, 160)
    : authorization.githubRunId
      ? `github-actions:${authorization.githubRunId}`
      : "manual-api";

  console.info(JSON.stringify({
    event: "regime_shadow_manual_projection_authorized",
    transport: authorization.transport,
    actor: authorization.actor,
    githubRunId: authorization.githubRunId,
    workflowSha: authorization.workflowSha,
    triggerRef,
    vercelRequestId: request.headers.get("x-vercel-id") || undefined,
  }));

  const result = await persistRegimeShadowProjectionSafely({
    trigger: "manual",
    triggerRef,
  });

  const status = result.warnings.length && !result.runId ? 503 : 200;
  return NextResponse.json(result, { status });
}
