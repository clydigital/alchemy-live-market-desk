import "server-only";

import {
  attachEngineRunToInvocation,
  setFrozenIntelligenceInputs,
  type FrozenIntelligenceInputs,
} from "./invocation-context.ts";
import { intelligenceRest } from "./supabase.ts";
export {
  annotateRunKeySchemaDrift,
  defaultIntelligenceRunKey,
  type EngineRunRow,
  type StartIntelligenceEngineRunResult,
  startIntelligenceEngineRunWithClient,
} from "./engine-run-contract.ts";
import { startIntelligenceEngineRunWithClient } from "./engine-run-contract.ts";

function validFrozenInputs(value: unknown): value is FrozenIntelligenceInputs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Partial<FrozenIntelligenceInputs>;
  return typeof input.analysisAsOf === "string"
    && (input.macroSnapshotId === null || typeof input.macroSnapshotId === "string")
    && (input.stories === null || Array.isArray(input.stories))
    && (input.evidence === null || Array.isArray(input.evidence))
    && (input.researchDebt === null || Array.isArray(input.researchDebt));
}

async function initialFrozenInputs(input: {
  engineRunId: string;
  researchRunId: string | null;
  metadata: Record<string, unknown> | undefined;
  startedAt: string | null | undefined;
}) {
  const existing = input.metadata?.frozenInputs;
  if (validFrozenInputs(existing)) return existing;

  let macroSnapshotId: string | null = null;
  if (input.researchRunId) {
    const rows = await intelligenceRest<Array<{ macro_snapshot_id: string | null }>>(
      `research_runs?select=macro_snapshot_id&id=eq.${encodeURIComponent(input.researchRunId)}&limit=1`,
    ).catch(() => []);
    macroSnapshotId = rows[0]?.macro_snapshot_id ?? null;
  }

  const frozen: FrozenIntelligenceInputs = {
    analysisAsOf: input.startedAt || new Date().toISOString(),
    macroSnapshotId,
    stories: null,
    evidence: null,
    researchDebt: null,
  };
  await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(input.engineRunId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      metadata: {
        ...(input.metadata ?? {}),
        frozenInputs: frozen,
      },
    }),
  });
  return frozen;
}

export async function startIntelligenceEngineRun(input: {
  researchRunId?: string | null;
  triggerKind: string;
  runKey?: string;
  dryRun?: boolean;
}) {
  const result = await startIntelligenceEngineRunWithClient(intelligenceRest, input);
  if (result.kind === "reused_completed") return result;

  attachEngineRunToInvocation(result.engineRunId);
  const frozen = await initialFrozenInputs({
    engineRunId: result.engineRunId,
    researchRunId: input.researchRunId ?? null,
    metadata: result.run.metadata,
    startedAt: result.run.started_at,
  });
  setFrozenIntelligenceInputs(frozen);
  return result;
}
