export const REQUIRED_CANONICAL_INTELLIGENCE_STAGES = [
  "market_belief",
  "divergence",
  "hypothesis",
  "scenario",
  "story_synthesis",
  "semantic_deduplication",
  "lifecycle",
] as const;

export const CHECKPOINTED_INTELLIGENCE_STAGES = [
  ...REQUIRED_CANONICAL_INTELLIGENCE_STAGES,
  "challenger",
] as const;

export type RequiredCanonicalIntelligenceStage = (typeof REQUIRED_CANONICAL_INTELLIGENCE_STAGES)[number];
export type CheckpointedIntelligenceStage = (typeof CHECKPOINTED_INTELLIGENCE_STAGES)[number];

export type PersistedStageRun = {
  id: string;
  stage_key: string;
  status: string;
  output_payload: unknown;
  started_at?: string | null;
  completed_at?: string | null;
};

export type StageCheckpoint = {
  stageRunId: string;
  stageKey: string;
  outputPayload: unknown;
};

export type StageClaim =
  | { state: "claimed"; stageRunId: string }
  | { state: "completed"; stageRunId: string; outputPayload: unknown }
  | { state: "busy"; stageRunId: string };

function objectWithArray(value: unknown, key: string) {
  return Boolean(value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key]));
}

/**
 * A completed stage is reusable only when it still has the minimum structured
 * shape required by its downstream stage. This deliberately validates the
 * persisted checkpoint, rather than treating a completed status as proof that
 * it is safe to use.
 */
export function hasReusableStagePayload(stageKey: string, payload: unknown) {
  switch (stageKey) {
    case "market_belief": return objectWithArray(payload, "beliefs");
    case "divergence": return objectWithArray(payload, "divergences");
    case "hypothesis": return objectWithArray(payload, "hypotheses");
    case "challenger": return objectWithArray(payload, "assessments");
    case "scenario": return objectWithArray(payload, "scenarios");
    case "story_synthesis": return objectWithArray(payload, "candidates");
    case "semantic_deduplication": return objectWithArray(payload, "decisions");
    case "lifecycle": return objectWithArray(payload, "decisions");
    default: return false;
  }
}

/** Latest valid completed attempt wins; failed attempts remain audit history. */
export function completedStageCheckpoints(rows: PersistedStageRun[]) {
  const checkpoints = new Map<string, StageCheckpoint>();
  for (const row of rows) {
    if (row.status !== "completed" || checkpoints.has(row.stage_key)) continue;
    if (!hasReusableStagePayload(row.stage_key, row.output_payload)) continue;
    checkpoints.set(row.stage_key, {
      stageRunId: row.id,
      stageKey: row.stage_key,
      outputPayload: row.output_payload,
    });
  }
  return checkpoints;
}

export function nextIncompleteIntelligenceStage(
  checkpoints: ReadonlyMap<string, StageCheckpoint>,
  stagesToEvaluate: readonly string[] = REQUIRED_CANONICAL_INTELLIGENCE_STAGES,
) {
  return stagesToEvaluate.find((stageKey) => !checkpoints.has(stageKey)) ?? null;
}

/**
 * Keeps the reuse/claim boundary testable. The production runtime supplies the
 * database-backed atomic claim and invokes OpenAI only from the claimed branch.
 */
export async function runCheckpointedStage<T>(input: {
  stageKey: string;
  checkpoints: ReadonlyMap<string, StageCheckpoint>;
  claim: () => Promise<StageClaim>;
  invoke: () => Promise<T>;
  valid: (payload: unknown) => payload is T;
}): Promise<{ source: "reused" | "invoked" | "busy"; data?: T; stageRunId: string }> {
  const checkpoint = input.checkpoints.get(input.stageKey);
  if (checkpoint && input.valid(checkpoint.outputPayload)) {
    return { source: "reused", data: checkpoint.outputPayload, stageRunId: checkpoint.stageRunId };
  }

  const claim = await input.claim();
  if (claim.state === "busy") return { source: "busy", stageRunId: claim.stageRunId };
  if (claim.state === "completed") {
    if (!input.valid(claim.outputPayload)) {
      throw new Error(`Completed intelligence checkpoint ${input.stageKey} has an invalid persisted payload.`);
    }
    return { source: "reused", data: claim.outputPayload, stageRunId: claim.stageRunId };
  }
  return { source: "invoked", data: await input.invoke(), stageRunId: claim.stageRunId };
}
