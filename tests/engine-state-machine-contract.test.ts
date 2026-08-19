import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_REASONING_STAGES,
  continueContractRun,
  createContractRun,
  type EngineContractDeps,
  type EngineContractRun,
  type ReasoningStage,
} from "./helpers/engine-state-machine-contract.ts";

function makeRun() {
  return createContractRun({
    runId: "run-1",
    startedAt: "2026-08-19T08:00:00.000Z",
    inputManifest: {
      evidenceIds: ["e1", "e2"],
      storyVersionIds: ["sv1"],
      macroSnapshotIds: ["macro-a"],
      analysisTimestamp: "2026-08-19T08:00:00.000Z",
    },
  });
}

function makeDeps(input: {
  failures?: Partial<Record<ReasoningStage | "story" | "snapshot", number>>;
  stageCalls?: ReasoningStage[];
  seenInputs?: Array<unknown>;
  writes?: { story: number; snapshot: number };
} = {}): EngineContractDeps {
  const remainingFailures = { ...(input.failures ?? {}) };
  const stageCalls = input.stageCalls ?? [];
  const seenInputs = input.seenInputs ?? [];
  const writes = input.writes ?? { story: 0, snapshot: 0 };

  function shouldFail(key: ReasoningStage | "story" | "snapshot") {
    const remaining = remainingFailures[key] ?? 0;
    if (remaining <= 0) return false;
    remainingFailures[key] = remaining - 1;
    return true;
  }

  return {
    async runStage(stage, frozenInput) {
      stageCalls.push(stage);
      seenInputs.push(frozenInput);
      if (shouldFail(stage)) throw new Error(`${stage} failed`);
      return { stage, ok: true };
    },
    async persistStory(_run: EngineContractRun) {
      writes.story += 1;
      if (shouldFail("story")) throw new Error("story finalisation failed");
    },
    async persistSnapshot(_run: EngineContractRun) {
      writes.snapshot += 1;
      if (shouldFail("snapshot")) throw new Error("snapshot finalisation failed");
    },
  };
}

test("state machine executes exactly one reasoning stage per continuation, then finalises", async () => {
  const run = makeRun();
  const calls: ReasoningStage[] = [];
  const writes = { story: 0, snapshot: 0 };
  const deps = makeDeps({ stageCalls: calls, writes });

  for (const expected of REQUIRED_REASONING_STAGES) {
    const result = await continueContractRun(run, deps);
    assert.equal(result.state, "CONTINUE");
    assert.equal(result.stage, expected);
    assert.equal(calls.at(-1), expected);
    assert.equal(calls.length, run.completedStages.length);
    assert.equal(writes.story, 0);
    assert.equal(writes.snapshot, 0);
  }

  const final = await continueContractRun(run, deps);
  assert.deepEqual(final, { state: "COMPLETED", stage: "finalise" });
  assert.equal(run.status, "completed");
  assert.equal(writes.story, 1);
  assert.equal(writes.snapshot, 1);
  assert.deepEqual(calls, [...REQUIRED_REASONING_STAGES]);
});

test("a failed stage retries only itself and never reruns completed upstream stages", async () => {
  const run = makeRun();
  const calls: ReasoningStage[] = [];
  const deps = makeDeps({ failures: { scenario: 1 }, stageCalls: calls });

  for (let i = 0; i < 3; i += 1) {
    const result = await continueContractRun(run, deps);
    assert.equal(result.state, "CONTINUE");
  }

  const failed = await continueContractRun(run, deps);
  assert.equal(failed.state, "RETRY_STAGE");
  assert.equal(failed.stage, "scenario");
  assert.deepEqual(run.completedStages, ["market_belief", "divergence", "hypothesis"]);

  const retried = await continueContractRun(run, deps);
  assert.equal(retried.state, "CONTINUE");
  assert.equal(retried.stage, "scenario");
  assert.deepEqual(calls, ["market_belief", "divergence", "hypothesis", "scenario", "scenario"]);
});

test("run input is frozen at creation and later caller mutation cannot drift subsequent stages", async () => {
  const mutableInput = {
    evidenceIds: ["e1"],
    storyVersionIds: ["sv1"],
    macroSnapshotIds: ["macro-a"],
    analysisTimestamp: "2026-08-19T08:00:00.000Z",
  };
  const run = createContractRun({
    runId: "run-frozen",
    startedAt: "2026-08-19T08:00:00.000Z",
    inputManifest: mutableInput,
  });
  const seenInputs: Array<unknown> = [];
  const deps = makeDeps({ seenInputs });

  mutableInput.evidenceIds.push("late-evidence");
  mutableInput.storyVersionIds[0] = "sv-new";
  mutableInput.macroSnapshotIds.push("macro-b");
  mutableInput.analysisTimestamp = "2026-08-19T09:00:00.000Z";

  await continueContractRun(run, deps);
  await continueContractRun(run, deps);

  assert.deepEqual(run.frozenInput, {
    evidenceIds: ["e1"],
    storyVersionIds: ["sv1"],
    macroSnapshotIds: ["macro-a"],
    analysisTimestamp: "2026-08-19T08:00:00.000Z",
  });
  assert.equal(seenInputs[0], run.frozenInput);
  assert.equal(seenInputs[1], run.frozenInput);
});

test("finalisation resumes after snapshot failure without duplicating Story persistence", async () => {
  const run = makeRun();
  run.completedStages = [...REQUIRED_REASONING_STAGES];
  const writes = { story: 0, snapshot: 0 };
  const deps = makeDeps({ failures: { snapshot: 1 }, writes });

  const first = await continueContractRun(run, deps);
  assert.equal(first.state, "RETRY_STAGE");
  assert.equal(first.stage, "finalise");
  assert.equal(run.finalisation.storyPersisted, true);
  assert.equal(run.finalisation.snapshotPersisted, false);
  assert.equal(writes.story, 1);
  assert.equal(writes.snapshot, 1);

  const second = await continueContractRun(run, deps);
  assert.equal(second.state, "COMPLETED");
  assert.equal(run.finalisation.storyPersisted, true);
  assert.equal(run.finalisation.snapshotPersisted, true);
  assert.equal(writes.story, 1);
  assert.equal(writes.snapshot, 2);

  const noop = await continueContractRun(run, deps);
  assert.deepEqual(noop, { state: "COMPLETED", stage: null });
  assert.equal(writes.story, 1);
  assert.equal(writes.snapshot, 2);
});

test("there is no arbitrary global continuation cap; repeated same-stage failures remain resumable", async () => {
  const run = makeRun();
  run.completedStages = ["market_belief", "divergence", "hypothesis"];
  const calls: ReasoningStage[] = [];
  const deps = makeDeps({ failures: { scenario: 9 }, stageCalls: calls });

  for (let attempt = 1; attempt <= 9; attempt += 1) {
    const result = await continueContractRun(run, deps);
    assert.equal(result.state, "RETRY_STAGE");
    assert.equal(result.stage, "scenario");
  }

  const success = await continueContractRun(run, deps);
  assert.equal(success.state, "CONTINUE");
  assert.equal(success.stage, "scenario");
  assert.equal(run.stageAttempts.scenario, 10);
  assert.equal(calls.filter((stage) => stage === "scenario").length, 10);
});

test("Challenger is not part of the required blocking stage sequence", () => {
  assert.equal(REQUIRED_REASONING_STAGES.includes("challenger" as ReasoningStage), false);
  assert.deepEqual(REQUIRED_REASONING_STAGES, [
    "market_belief",
    "divergence",
    "hypothesis",
    "scenario",
    "story_synthesis",
    "semantic_deduplication",
    "lifecycle",
  ]);
});

test("an active claim returns BUSY without invoking model or finalisation work", async () => {
  const run = makeRun();
  run.activeClaim = "market_belief";
  const calls: ReasoningStage[] = [];
  const writes = { story: 0, snapshot: 0 };
  const result = await continueContractRun(run, makeDeps({ stageCalls: calls, writes }));

  assert.deepEqual(result, { state: "BUSY", stage: "market_belief" });
  assert.deepEqual(calls, []);
  assert.deepEqual(writes, { story: 0, snapshot: 0 });
});
