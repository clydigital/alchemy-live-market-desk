import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CHECKPOINTED_INTELLIGENCE_STAGES,
  completedStageCheckpoints,
  nextIncompleteIntelligenceStage,
} from "../lib/intelligence/resumable-checkpoints.ts";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("canonical required-stage order excludes Challenger", () => {
  assert.deepEqual(CHECKPOINTED_INTELLIGENCE_STAGES, [
    "market_belief",
    "divergence",
    "hypothesis",
    "scenario",
    "story_synthesis",
    "semantic_deduplication",
    "lifecycle",
  ]);
  assert.equal(CHECKPOINTED_INTELLIGENCE_STAGES.includes("challenger" as never), false);
});

test("next continuation resumes from the first incomplete required stage", () => {
  const checkpoints = completedStageCheckpoints([
    { id: "belief", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [] } },
    { id: "divergence", stage_key: "divergence", status: "completed", output_payload: { divergences: [] } },
  ]);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "hypothesis");
});

test("historic Challenger checkpoints remain readable but never become required", () => {
  const checkpoints = completedStageCheckpoints([
    { id: "belief", stage_key: "market_belief", status: "completed", output_payload: { beliefs: [] } },
    { id: "challenger", stage_key: "challenger", status: "completed", output_payload: { assessments: [] } },
  ]);
  assert.equal(checkpoints.has("challenger"), true);
  assert.equal(nextIncompleteIntelligenceStage(checkpoints), "divergence");
});

test("scheduled intelligence gives one model stage to one invocation", () => {
  const handler = source("../lib/cron-research-intelligence-handler.ts");
  assert.match(handler, /runWithIntelligenceInvocation\(\{ oneModelStage: true \}/);
  assert.match(handler, /stageMaxAttempts:\s*1/);
  assert.doesNotMatch(handler, /scheduledExecutionStartedAtMs:/);
  assert.match(handler, /continuation:\s*invocation\.summary\.deferredStage\s*\?\s*"CONTINUE"\s*:\s*"RETRY_STAGE"/);
  assert.match(handler, /continuation:\s*finalStatus === "completed" \? "COMPLETED" : "TERMINAL_FAILURE"/);
});

test("provider request timeout is a safety ceiling, not a cognitive-stage stopwatch", () => {
  const openai = source("../lib/intelligence/openai.ts");
  assert.match(openai, /MAX_STAGE_REQUEST_TIMEOUT_MS = 240_000/);
  assert.match(openai, /boundedInteger\(requestTimeoutMs, MAX_STAGE_REQUEST_TIMEOUT_MS, 1_000, MAX_STAGE_REQUEST_TIMEOUT_MS\)/);
  assert.doesNotMatch(openai, /boundedInteger\(requestTimeoutMs, 60_000/);
});

test("frozen-input lineage includes the run-pinned macro snapshot", () => {
  const engineRun = source("../lib/intelligence/engine-run.ts");
  const invocation = source("../lib/intelligence/invocation-context.ts");
  assert.match(engineRun, /select=macro_snapshot_id/);
  assert.match(engineRun, /macroSnapshotId/);
  assert.match(invocation, /analysisAsOf/);
  assert.match(invocation, /stories: unknown\[\] \| null/);
  assert.match(invocation, /evidence: unknown\[\] \| null/);
  assert.match(invocation, /researchDebt: unknown\[\] \| null/);
});
