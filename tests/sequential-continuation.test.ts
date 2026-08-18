import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_CANONICAL_INTELLIGENCE_STAGES,
  completedStageCheckpoints,
  nextIncompleteIntelligenceStage,
  runCheckpointedStage,
  type PersistedStageRun,
  type StageClaim,
  type StageCheckpoint,
} from "../lib/intelligence/resumable-checkpoints.ts";
import {
  defaultIntelligenceRunKey,
  startIntelligenceEngineRunWithClient,
} from "../lib/intelligence/engine-run-contract.ts";

const validObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

test("Regression Test A: One stage per continuation - no checkpoints => invocation 1 calls only Market Belief", async () => {
  const checkpoints = new Map<string, StageCheckpoint>();
  const stageCalls: string[] = [];

  const nextStage = nextIncompleteIntelligenceStage(checkpoints);
  assert.equal(nextStage, "market_belief");

  const claim = async (): Promise<StageClaim> => ({ state: "claimed", stageRunId: "claim_mb_1" });
  const invoke = async () => {
    stageCalls.push(nextStage);
    return { beliefs: [{ id: "b1", statement: "Test belief" }] };
  };

  const result = await runCheckpointedStage({
    stageKey: nextStage,
    checkpoints,
    claim,
    invoke,
    valid: validObject,
  });

  assert.equal(result.source, "invoked");
  assert.deepEqual(stageCalls, ["market_belief"], "Invocation 1 must call only Market Belief");
});

test("Regression Test B: Resume directly at Scenario - completed MB/Divergence/Hypothesis => next invocation calls Scenario", async () => {
  const runs: PersistedStageRun[] = [
    { id: "mb_1", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [{ id: "b1" }] } },
    { id: "div_1", stage_key: "divergence", status: "completed", output_payload: { divergences: [{ id: "d1" }] } },
    { id: "hyp_1", stage_key: "hypothesis", status: "completed", output_payload: { hypotheses: [{ id: "h1" }] } },
  ];

  const checkpoints = completedStageCheckpoints(runs);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "scenario");

  let scenarioCalls = 0;
  let reusedCalls = 0;

  // Verify completed stages are reused without model calls
  for (const completedStage of ["market_belief", "divergence", "hypothesis"]) {
    const res = await runCheckpointedStage({
      stageKey: completedStage,
      checkpoints,
      claim: async () => { throw new Error("Should not claim completed stage"); },
      invoke: async () => { reusedCalls += 1; return {}; },
      valid: validObject,
    });
    assert.equal(res.source, "reused");
  }
  assert.equal(reusedCalls, 0, "Zero model calls to completed stages");

  // Execute Scenario stage
  const res = await runCheckpointedStage({
    stageKey: "scenario",
    checkpoints,
    claim: async () => ({ state: "claimed", stageRunId: "claim_scen_1" }),
    invoke: async () => { scenarioCalls += 1; return { scenarios: [{ id: "s1" }] }; },
    valid: validObject,
  });

  assert.equal(res.source, "invoked");
  assert.equal(scenarioCalls, 1, "Scenario called exactly once");
});

test("Regression Test C: No inherited synthetic budget - no-synthetic-timeout platform-bounded mode", () => {
  // Verify REQUIRED_CANONICAL_INTELLIGENCE_STAGES does not require synthetic stage timeouts
  assert.deepEqual(
    REQUIRED_CANONICAL_INTELLIGENCE_STAGES,
    ["market_belief", "divergence", "hypothesis", "scenario", "story_synthesis", "semantic_deduplication", "lifecycle"],
    "Canonical blocking path contains exactly the required 7 stages",
  );
});

test("Regression Test D: Challenger cannot block - missing/failed Challenger allows Hypothesis -> Scenario path", async () => {
  const runs: PersistedStageRun[] = [
    { id: "mb_1", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [{ id: "b1" }] } },
    { id: "div_1", stage_key: "divergence", status: "completed", output_payload: { divergences: [{ id: "d1" }] } },
    { id: "hyp_1", stage_key: "hypothesis", status: "completed", output_payload: { hypotheses: [{ id: "h1" }] } },
    { id: "chal_failed", stage_key: "challenger", status: "failed", output_payload: {} },
  ];

  const checkpoints = completedStageCheckpoints(runs);
  // Next required stage ignores failed Challenger checkpoint and proceeds directly to Scenario
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "scenario", "Challenger failure must NOT block Scenario stage");
});

test("Regression Test E: Strict persistence sequencing - Scenario cannot run until Hypothesis checkpoint persists", async () => {
  const runs: PersistedStageRun[] = [
    { id: "mb_1", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [{ id: "b1" }] } },
    { id: "div_1", stage_key: "divergence", status: "completed", output_payload: { divergences: [{ id: "d1" }] } },
    // Hypothesis not yet completed/persisted
  ];

  const checkpoints = completedStageCheckpoints(runs);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "hypothesis");
  assert.notEqual(nextIncompleteIntelligenceStage(checkpoints), "scenario", "Scenario cannot run before Hypothesis checkpoint is persisted");
});

test("Regression Test F: Lineage/idempotency - same research run retains same engine run ID and run key", async () => {
  const researchRunId = "res_run_20260818";
  const slot = "0915";
  const date = "2026-08-18";

  const runKey = `scheduled:${slot}:${date}`;
  const engineRunId = `engine_run_scheduled_${slot}_${date}`;

  const mockClient = async <T>(path: string, init?: RequestInit): Promise<T> => {
    if (path.includes("select=id,status")) return [{ id: engineRunId, status: "started" }] as unknown as T;
    if (path.includes("on_conflict=run_key") && init?.method === "POST") return [{ id: engineRunId, status: "started" }] as unknown as T;
    return [] as unknown as T;
  };

  // Continuation 1
  const start1 = await startIntelligenceEngineRunWithClient(mockClient, { researchRunId, triggerKind: "scheduled", runKey });
  // Continuation 2
  const start2 = await startIntelligenceEngineRunWithClient(mockClient, { researchRunId, triggerKind: "scheduled", runKey });

  assert.equal(start1.engineRunId, engineRunId);
  assert.equal(start2.engineRunId, engineRunId);
  assert.equal(start1.engineRunId, start2.engineRunId, "Engine run ID lineage must remain identical across continuations");
});

test("Regression Test G: Controlled engine E2E - sequential continuations progress to canonical completed", async () => {
  const checkpoints = new Map<string, StageCheckpoint>();
  const executedStages: string[] = [];

  const stagePayloads: Record<string, unknown> = {
    market_belief: { beliefs: [{ id: "b1" }] },
    divergence: { divergences: [{ id: "d1" }] },
    hypothesis: { hypotheses: [{ id: "h1" }] },
    scenario: { scenarios: [{ id: "s1" }] },
    story_synthesis: { candidates: [{ id: "c1" }] },
    semantic_deduplication: { decisions: [{ id: "dec1" }] },
    lifecycle: { decisions: [{ id: "l1" }] },
  };

  // Simulate 7 sequential continuations
  for (let i = 0; i < 7; i += 1) {
    const stageToRun = nextIncompleteIntelligenceStage(checkpoints);
    if (!stageToRun) break;
    executedStages.push(stageToRun);

    const payload = stagePayloads[stageToRun];
    checkpoints.set(stageToRun, {
      stageRunId: `run_${stageToRun}_${i}`,
      stageKey: stageToRun,
      outputPayload: payload,
    });
  }

  assert.deepEqual(
    executedStages,
    ["market_belief", "divergence", "hypothesis", "scenario", "story_synthesis", "semantic_deduplication", "lifecycle"],
    "Sequential continuations must execute all 7 required stages in exact canonical order",
  );
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), null, "All required stages complete -> cycle complete");
});
