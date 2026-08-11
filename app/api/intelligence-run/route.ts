import { NextResponse } from "next/server";

import { runIntelligenceEngine, type IntelligenceTriggerKind } from "@/lib/intelligence/runtime";
import { intelligenceRest } from "@/lib/intelligence/supabase";

export const dynamic = "force-dynamic";

const VALID_TRIGGER_KINDS = new Set<IntelligenceTriggerKind>([
  "scheduled",
  "new_evidence",
  "manual",
  "targeted_reevaluation",
  "api",
]);

function authorize(request: Request) {
  const expected = process.env.RESEARCH_UPDATE_TOKEN || process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const runs = await intelligenceRest<Array<Record<string, unknown>>>(
      "intelligence_engine_runs?select=id,research_run_id,trigger_kind,status,stories_considered,stories_published,warnings,failure_detail,started_at,completed_at,metadata&order=started_at.desc&limit=10",
    );
    const stages = await intelligenceRest<Array<Record<string, unknown>>>(
      "intelligence_stage_runs?select=id,engine_run_id,stage_key,status,model_name,provider_request_id,input_tokens,output_tokens,failure_code,failure_detail,started_at,completed_at&order=started_at.desc&limit=60",
    );
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      runtime: "openai-responses-v1",
      runs,
      stages,
      note: "Stage payloads and private evidence are intentionally omitted from this operations endpoint.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load intelligence runtime status." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    researchRunId?: string | null;
    triggerKind?: IntelligenceTriggerKind;
    runKey?: string;
    dryRun?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const triggerKind = body.triggerKind && VALID_TRIGGER_KINDS.has(body.triggerKind) ? body.triggerKind : "api";
  const result = await runIntelligenceEngine({
    researchRunId: typeof body.researchRunId === "string" ? body.researchRunId : null,
    triggerKind,
    runKey: typeof body.runKey === "string" ? body.runKey : undefined,
    dryRun: body.dryRun === true,
  });
  const status = result.status === "failed" ? 500 : result.status === "blocked" ? 503 : 200;
  return NextResponse.json(result, { status });
}
