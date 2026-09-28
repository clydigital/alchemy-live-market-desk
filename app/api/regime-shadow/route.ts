import { NextResponse } from "next/server";

import {
  getRegimeShadowHealth,
  persistRegimeShadowProjectionSafely,
} from "@/lib/regime-engine";
import { acceptsResearchAuthorization } from "@/lib/research-auth";

export const dynamic = "force-dynamic";

function authorize(request: Request) {
  return acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.RESEARCH_UPDATE_TOKEN,
    process.env.CRON_SECRET,
  ]);
}

export async function GET(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const health = await getRegimeShadowHealth();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: "shadow",
    health,
    note: "This endpoint exposes Regime projection health only. Private evidence and prompt payloads are omitted.",
  });
}

export async function POST(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { triggerRef?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await persistRegimeShadowProjectionSafely({
    trigger: "manual",
    triggerRef: typeof body.triggerRef === "string" ? body.triggerRef : "manual-api",
  });

  const status = result.warnings.length && !result.runId ? 503 : 200;
  return NextResponse.json(result, { status });
}
