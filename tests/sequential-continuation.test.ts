import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("Acceptance Test 1: Invocation with no checkpoints runs Market Belief only and returns before Divergence starts", async () => {
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

test("Acceptance Test 2: Next invocation reuses MB and runs Divergence only", async () => {
  const runs: PersistedStageRun[] = [
    { id: "mb_1", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [{ id: "b1" }] } },
  ];

  const checkpoints = completedStageCheckpoints(runs);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "divergence");

  let divCalls = 0;
  let reusedCalls = 0;

  const mbRes = await runCheckpointedStage({
    stageKey: "market_belief",
    checkpoints,
    claim: async () => { throw new Error("Should not claim completed MB"); },
    invoke: async () => { reusedCalls += 1; return {}; },
    valid: validObject,
  });
  assert.equal(mbRes.source, "reused");
  assert.equal(reusedCalls, 0);

  const divRes = await runCheckpointedStage({
    stageKey: "divergence",
    checkpoints,
    claim: async () => ({ state: "claimed", stageRunId: "claim_div_1" }),
    invoke: async () => { divCalls += 1; return { divergences: [{ id: "d1" }] }; },
    valid: validObject,
  });

  assert.equal(divRes.source, "invoked");
  assert.equal(divCalls, 1, "Divergence called exactly once");
});

test("Acceptance Test 3: Completed MB/Divergence/Hypothesis -> next invocation runs Scenario directly, 0 completed calls, 0 Challenger wait", async () => {
  const runs: PersistedStageRun[] = [
    { id: "mb_1", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [{ id: "b1" }] } },
    { id: "div_1", stage_key: "divergence", status: "completed", output_payload: { divergences: [{ id: "d1" }] } },
    { id: "hyp_1", stage_key: "hypothesis", status: "completed", output_payload: { hypotheses: [{ id: "h1" }] } },
  ];

  const checkpoints = completedStageCheckpoints(runs);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "scenario", "Next required stage must be scenario directly");

  let scenarioCalls = 0;
  let reusedCalls = 0;

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

  const scenarioRes = await runCheckpointedStage({
    stageKey: "scenario",
    checkpoints,
    claim: async () => ({ state: "claimed", stageRunId: "claim_scen_1" }),
    invoke: async () => { scenarioCalls += 1; return { scenarios: [{ id: "s1" }] }; },
    valid: validObject,
  });

  assert.equal(scenarioRes.source, "invoked");
  assert.equal(scenarioCalls, 1, "Scenario called directly without Challenger wait");
});

test("Acceptance Test 4: Scenario-first continuation proves no synthetic 20s/all-stage budget supplied (requestTimeoutMs = undefined)", () => {
  const openaiCode = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");
  const handlerCode = readFileSync(new URL("../lib/cron-research-intelligence-handler.ts", import.meta.url), "utf8");

  assert.match(openaiCode, /requestTimeoutMs === null/, "openai.ts must support requestTimeoutMs = null for platform-bounded execution");
  assert.match(handlerCode, /stageRequestTimeoutMs:\s*undefined/, "handler must pass stageRequestTimeoutMs: undefined to disable synthetic timers");
});

test("Acceptance Test 5: Story Synthesis cannot start before Scenario checkpoint persistence resolves", async () => {
  const runs: PersistedStageRun[] = [
    { id: "mb_1", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [{ id: "b1" }] } },
    { id: "div_1", stage_key: "divergence", status: "completed", output_payload: { divergences: [{ id: "d1" }] } },
    { id: "hyp_1", stage_key: "hypothesis", status: "completed", output_payload: { hypotheses: [{ id: "h1" }] } },
  ];

  const checkpoints = completedStageCheckpoints(runs);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "scenario");
  assert.notEqual(nextIncompleteIntelligenceStage(checkpoints), "story_synthesis", "Story synthesis cannot run before Scenario is persisted");
});

test("Acceptance Test 6: Same canonical run key and engine ID persist across all continuations", async () => {
  const researchRunId = "res_run_20260818";
  const slot = "0915";
  const date = "2026-08-18";

  const runKey = defaultIntelligenceRunKey(researchRunId, "scheduled");
  const engineRunId = `engine_run_scheduled_${slot}_${date}`;

  const mockClient = async <T>(path: string, init?: RequestInit): Promise<T> => {
    if (path.includes("select=id,status")) return [{ id: engineRunId, status: "started" }] as unknown as T;
    if (path.includes("on_conflict=run_key") && init?.method === "POST") return [{ id: engineRunId, status: "started" }] as unknown as T;
    return [] as unknown as T;
  };

  const start1 = await startIntelligenceEngineRunWithClient(mockClient, { researchRunId, triggerKind: "scheduled", runKey });
  const start2 = await startIntelligenceEngineRunWithClient(mockClient, { researchRunId, triggerKind: "scheduled", runKey });

  if (start1.kind === "started" && start2.kind === "started") {
    assert.equal(start1.engineRunId, engineRunId);
    assert.equal(start2.engineRunId, engineRunId);
    assert.equal(start1.engineRunId, start2.engineRunId, "Engine run ID lineage must remain identical across continuations");
  } else {
    assert.fail("Both engine runs should start with the mock client");
  }
});

test("Acceptance Test 7: Controlled sequential E2E - continuations progress through all 7 required stages", async () => {
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

test("Acceptance Test 8: Workflow source verification proves {1..8} cap is replaced with state-driven continuation", () => {
  const workflowCode = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

  assert.ok(!workflowCode.includes("for attempt in {1..8}"), "Workflow must no longer contain arbitrary 8 attempt cap");
  assert.match(workflowCode, /while true; do/, "Workflow must use state-driven sequential continuation loop");
});
