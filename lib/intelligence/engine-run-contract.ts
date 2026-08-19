export type EngineRunRow = {
  id: string;
  status?: string;
  stories_considered?: number;
  stories_published?: number;
  warnings?: string[];
  metadata?: Record<string, unknown>;
  started_at?: string | null;
};

export type StartIntelligenceEngineRunResult =
  | { kind: "reused_completed"; runKey: string; run: EngineRunRow }
  | { kind: "started"; runKey: string; engineRunId: string; reusedExisting: boolean; run: EngineRunRow };

type StartIntelligenceEngineRunInput = {
  researchRunId?: string | null;
  triggerKind: string;
  runKey?: string;
  dryRun?: boolean;
};

type IntelligenceRest = <T>(path: string, init?: RequestInit) => Promise<T>;

const RUN_KEY_SCHEMA_GUIDANCE =
  "Schema drift: public.intelligence_engine_runs.run_key must exist as a non-null text column with a unique constraint usable by PostgREST on_conflict=run_key.";

export function defaultIntelligenceRunKey(researchRunId: string | null | undefined, triggerKind: string) {
  return `intelligence:${researchRunId || triggerKind}:${new Date().toISOString().slice(0, 16)}`;
}

export function annotateRunKeySchemaDrift(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/42P10/.test(message) || !/ON CONFLICT/i.test(message)) return error;
  return new Error(`${message} ${RUN_KEY_SCHEMA_GUIDANCE} Apply the forward schema-parity migration before rerunning the canonical cycle.`);
}

export async function startIntelligenceEngineRunWithClient(
  intelligenceRest: IntelligenceRest,
  {
    researchRunId = null,
    triggerKind,
    runKey,
    dryRun = false,
  }: StartIntelligenceEngineRunInput,
): Promise<StartIntelligenceEngineRunResult> {
  const effectiveRunKey = runKey || defaultIntelligenceRunKey(researchRunId, triggerKind);
  const priorRuns = await intelligenceRest<EngineRunRow[]>(
    `intelligence_engine_runs?select=id,status,stories_considered,stories_published,warnings,metadata,started_at&run_key=eq.${encodeURIComponent(effectiveRunKey)}&limit=1`,
  );
  const prior = priorRuns[0] ?? null;
  if (prior?.status === "completed") {
    return {
      kind: "reused_completed",
      runKey: effectiveRunKey,
      run: prior,
    };
  }

  // Continuation means reuse the exact engine row. The old upsert path rewrote
  // started_at and metadata every time the run resumed, corrupting lineage and
  // making a coherent frozen-input contract impossible.
  if (prior?.id) {
    return {
      kind: "started",
      runKey: effectiveRunKey,
      engineRunId: prior.id,
      reusedExisting: true,
      run: prior,
    };
  }

  let engineRows: EngineRunRow[];
  try {
    engineRows = await intelligenceRest<EngineRunRow[]>("intelligence_engine_runs?on_conflict=run_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        research_run_id: researchRunId,
        trigger_kind: triggerKind,
        status: "started",
        run_key: effectiveRunKey,
        warnings: [],
        metadata: { dryRun, runtime: "openai-responses-v1" },
        started_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    throw annotateRunKeySchemaDrift(error);
  }

  const run = engineRows[0];
  if (!run?.id) throw new Error("Intelligence engine run did not return an id.");
  return {
    kind: "started",
    runKey: effectiveRunKey,
    engineRunId: run.id,
    reusedExisting: false,
    run,
  };
}
