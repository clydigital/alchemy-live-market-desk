import "server-only";

import {
  currentIntelligenceInvocation,
  frozenRead,
  frozenStoryReviewTargets,
  rememberFrozenRead,
  rememberFrozenStoryReviewTargets,
  shouldDeferStageClaim,
} from "./invocation-context.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function intelligenceDatabaseConfigured() {
  return Boolean(supabaseUrl && serviceKey);
}

async function rawIntelligenceRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !serviceKey) throw new Error("Intelligence database credentials are not configured.");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Intelligence database request failed (${response.status}): ${detail.slice(0, 800)}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function frozenReadKind(path: string): "stories" | "evidence" | "researchDebt" | null {
  if (path.startsWith("stories?select=id,slug,title,thesis,status,confidence,market_question")) return "stories";
  if (path.startsWith("intelligence_evidence?select=id,source_id,claim_text,summary,evidence_class")) return "evidence";
  if (path.startsWith("research_debt?select=debt_key,severity,reason,next_action,next_check_at")) return "researchDebt";
  return null;
}

async function persistFrozenInputs() {
  const state = currentIntelligenceInvocation();
  if (!state?.engineRunId || !state.frozenInputs) return;
  const rows = await rawIntelligenceRest<Array<{ metadata: Record<string, unknown> | null }>>(
    `intelligence_engine_runs?select=metadata&id=eq.${encodeURIComponent(state.engineRunId)}&limit=1`,
  );
  const metadata = rows[0]?.metadata ?? {};
  await rawIntelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(state.engineRunId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ metadata: { ...metadata, frozenInputs: state.frozenInputs } }),
  });
}

function withFrozenAnalysisTimestamp(path: string, init: RequestInit) {
  const analysisAsOf = currentIntelligenceInvocation()?.frozenInputs?.analysisAsOf;
  if (!analysisAsOf || typeof init.body !== "string") return init;
  let payload: unknown;
  try {
    payload = JSON.parse(init.body);
  } catch {
    return init;
  }
  const rows = Array.isArray(payload) ? payload : [payload];
  let matched = false;
  const patched = rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const value = { ...(row as Record<string, unknown>) };
    if (path.startsWith("intelligence_market_beliefs?on_conflict=belief_key")) {
      value.observed_at = analysisAsOf;
      value.updated_at = analysisAsOf;
      matched = true;
    } else if (path.startsWith("intelligence_divergences?on_conflict=divergence_key")) {
      value.detected_at = analysisAsOf;
      value.updated_at = analysisAsOf;
      matched = true;
    } else if (path.startsWith("intelligence_hypotheses?on_conflict=hypothesis_key")) {
      value.last_evaluated_at = analysisAsOf;
      value.updated_at = analysisAsOf;
      matched = true;
    } else if (path.startsWith("intelligence_scenarios?on_conflict=")) {
      value.updated_at = analysisAsOf;
      matched = true;
    } else if (path.startsWith("intelligence_challenger_assessments?on_conflict=")) {
      value.assessed_at = analysisAsOf;
      matched = true;
    }
    return value;
  });
  if (!matched) return init;
  return {
    ...init,
    body: JSON.stringify(Array.isArray(payload) ? patched : patched[0]),
  };
}

export async function intelligenceRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();

  // A successful model-stage handoff is not a retry failure. Once one model
  // stage has run in this serverless invocation, do not even create/claim the
  // next stage row. Return the same shape as a competing DB claim so the legacy
  // runtime exits through its already-resumable path without another model call.
  if (path === "rpc/claim_intelligence_stage" && method === "POST" && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body) as { p_stage_key?: string };
      const stageKey = body.p_stage_key?.trim();
      if (stageKey && shouldDeferStageClaim(stageKey)) {
        return [{
          stage_run_id: "00000000-0000-0000-0000-000000000000",
          claim_state: "busy",
          output_payload: {},
        }] as T;
      }
    } catch {
      // Let the canonical database path validate malformed claim payloads.
    }
  }

  const readKind = method === "GET" ? frozenReadKind(path) : null;
  if (readKind) {
    const state = currentIntelligenceInvocation();
    const existing = frozenRead(readKind);
    if (state?.frozenInputs && existing !== null) return structuredClone(existing) as T;
  }

  const effectiveInit = withFrozenAnalysisTimestamp(path, init);
  const result = await rawIntelligenceRest<T>(path, effectiveInit);

  if (readKind && Array.isArray(result)) {
    const state = currentIntelligenceInvocation();
    if (state?.engineRunId && state.frozenInputs && frozenRead(readKind) === null) {
      rememberFrozenRead(readKind, result);
      await persistFrozenInputs();
    }
  }

  return result;
}

export function restSelect(value: string) {
  return encodeURIComponent(value).replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")");
}

export async function freezeStoryReviewTargets(targets: unknown[]) {
  const existing = frozenStoryReviewTargets();
  if (existing !== null) return structuredClone(existing);

  const state = currentIntelligenceInvocation();
  if (!state?.engineRunId) return targets;
  const rows = await rawIntelligenceRest<Array<{ targets: unknown[] }>>("rpc/freeze_intelligence_story_review_targets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_engine_run_id: state.engineRunId,
      p_targets: targets,
    }),
  });
  const frozen = Array.isArray(rows[0]?.targets) ? rows[0].targets : targets;
  rememberFrozenStoryReviewTargets(frozen);
  return structuredClone(frozen);
}
