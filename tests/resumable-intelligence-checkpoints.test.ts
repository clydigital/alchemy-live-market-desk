import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  completedStageCheckpoints,
  nextIncompleteIntelligenceStage,
  runCheckpointedStage,
  type PersistedStageRun,
  type StageClaim,
} from "../lib/intelligence/resumable-checkpoints.ts";

function completed(id: string, stageKey: string, outputPayload: unknown): PersistedStageRun {
  return { id, stage_key: stageKey, status: "completed", output_payload: outputPayload };
}

const MARKET_BELIEF = { beliefs: [{ id: "belief-1", statement: "Rates fall", affectedAssets: [] }] };
const DIVERGENCE = { divergences: [{ id: "divergence-1", marketBeliefId: "belief-1" }] };
const HYPOTHESIS = { hypotheses: [{ id: "hypothesis-1", divergenceId: "divergence-1" }] };
const CHALLENGER = { assessments: [{ hypothesisId: "hypothesis-1", verdict: "watch" }] };
const SCENARIO = { scenarios: [{ hypothesisId: "hypothesis-1", asset: "SPX" }] };

const validObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");

test("completed Market Belief, Divergence, and Hypothesis are reused and Scenario is next", async () => {
  const checkpoints = completedStageCheckpoints([
    completed("market-1", "market_belief", MARKET_BELIEF),
    completed("divergence-1", "divergence", DIVERGENCE),
    completed("hypothesis-1", "hypothesis", HYPOTHESIS),
    { id: "challenger-failed-1", stage_key: "challenger", status: "failed", output_payload: {} },
  ]);
  let modelCalls = 0;
  const reuse = async (stageKey: string) => runCheckpointedStage({
    stageKey,
    checkpoints,
    claim: async (): Promise<StageClaim> => {
      throw new Error(`A completed ${stageKey} checkpoint must never be claimed again.`);
    },
    invoke: async () => {
      modelCalls += 1;
      return { unexpected: true };
    },
    valid: validObject,
  });

  const [belief, divergence, hypothesis] = await Promise.all([
    reuse("market_belief"),
    reuse("divergence"),
    reuse("hypothesis"),
  ]);

  assert.equal(belief.source, "reused");
  assert.equal(divergence.source, "reused");
  assert.equal(hypothesis.source, "reused");
  assert.deepEqual(belief.data, MARKET_BELIEF);
  assert.deepEqual(divergence.data, DIVERGENCE);
  assert.deepEqual(hypothesis.data, HYPOTHESIS);
  assert.equal(modelCalls, 0, "upstream OpenAI calls must not be duplicated");
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "scenario");
});

test("a failed Scenario attempt is retried from Scenario with persisted upstream payload", async () => {
  const checkpoints = completedStageCheckpoints([
    completed("market-1", "market_belief", MARKET_BELIEF),
    completed("divergence-1", "divergence", DIVERGENCE),
    completed("hypothesis-1", "hypothesis", HYPOTHESIS),
  ]);
  let scenarioCalls = 0;

  await assert.rejects(() => runCheckpointedStage({
    stageKey: "scenario",
    checkpoints,
    claim: async () => ({ state: "claimed", stageRunId: "scenario-attempt-1" }),
    invoke: async () => {
      scenarioCalls += 1;
      throw new Error("timeout");
    },
    valid: validObject,
  }), /timeout/);

  const resumed = await runCheckpointedStage({
    stageKey: "scenario",
    checkpoints,
    claim: async () => ({ state: "claimed", stageRunId: "scenario-attempt-2" }),
    invoke: async () => {
      scenarioCalls += 1;
      return SCENARIO;
    },
    valid: validObject,
  });

  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "scenario");
  assert.equal(resumed.source, "invoked");
  assert.deepEqual(resumed.data, SCENARIO);
  assert.equal(scenarioCalls, 2, "only Scenario receives a new attempt after its failure");
  assert.deepEqual(checkpoints.get("hypothesis")?.outputPayload, HYPOTHESIS, "downstream work receives the persisted hypothesis output");
});

test("historic Challenger checkpoints remain readable but never alter canonical next-stage order", () => {
  const checkpoints = completedStageCheckpoints([
    completed("market-1", "market_belief", MARKET_BELIEF),
    completed("divergence-1", "divergence", DIVERGENCE),
    completed("hypothesis-1", "hypothesis", HYPOTHESIS),
    completed("challenger-1", "challenger", CHALLENGER),
  ]);
  assert.deepEqual(checkpoints.get("challenger")?.outputPayload, CHALLENGER);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "scenario");
});

test("concurrent continuation claims allow only one model invocation for a required stage", async () => {
  let active = false;
  let stageCalls = 0;
  const claim = async (): Promise<StageClaim> => {
    if (active) return { state: "busy", stageRunId: "scenario-attempt-1" };
    active = true;
    return { state: "claimed", stageRunId: "scenario-attempt-1" };
  };
  const invoke = async () => {
    stageCalls += 1;
    await Promise.resolve();
    return SCENARIO;
  };
  const checkpoints = new Map();
  const [first, second] = await Promise.all([
    runCheckpointedStage({ stageKey: "scenario", checkpoints, claim, invoke, valid: validObject }),
    runCheckpointedStage({ stageKey: "scenario", checkpoints, claim, invoke, valid: validObject }),
  ]);

  assert.deepEqual([first.source, second.source].sort(), ["busy", "invoked"]);
  assert.equal(stageCalls, 1);
});

test("a final recovered checkpoint still proceeds to normal Story persistence/publication work", async () => {
  const checkpoints = completedStageCheckpoints([
    completed("market-1", "market_belief", MARKET_BELIEF),
    completed("divergence-1", "divergence", DIVERGENCE),
    completed("hypothesis-1", "hypothesis", HYPOTHESIS),
    completed("scenario-1", "scenario", { scenarios: [] }),
    completed("synthesis-1", "story_synthesis", { candidates: [{ primaryHypothesisId: "hypothesis-1" }] }),
    completed("dedupe-1", "semantic_deduplication", { decisions: [] }),
    completed("lifecycle-1", "lifecycle", { decisions: [] }),
  ]);
  let modelCalls = 0;
  let persisted = 0;
  const lifecycle = await runCheckpointedStage({
    stageKey: "lifecycle",
    checkpoints,
    claim: async () => ({ state: "busy", stageRunId: "must-not-claim" }),
    invoke: async () => {
      modelCalls += 1;
      return { decisions: [] };
    },
    valid: validObject,
  });
  if (lifecycle.source === "reused") persisted += 1;

  assert.equal(modelCalls, 0);
  assert.equal(persisted, 1);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), null);
});

test("the database migration provides an atomic, auditable stage claim", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260817013000_resumable_intelligence_stage_claims.sql", import.meta.url), "utf8");

  assert.match(migration, /intelligence_stage_runs_one_active_claim_uidx/);
  assert.match(migration, /intelligence_challenger_assessments_stage_hypothesis_uidx/);
  assert.match(migration, /where status = 'started'/i);
  assert.match(migration, /create or replace function public\.claim_intelligence_stage/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /'busy'::text/i);
  assert.match(migration, /'completed'::text/i);
  assert.match(migration, /failure_code = 'abandoned_claim'/i);
});
