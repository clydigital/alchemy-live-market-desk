import assert from "node:assert/strict";
import test from "node:test";

import {
  INTELLIGENCE_CONTINUATION_CLAIM_STALE_MS,
  evaluateScheduledIntelligenceContinuation,
  finalScheduledResearchStatus,
  intelligenceContinuationClaimWarning,
  latestIntelligenceContinuationClaimAt,
  mergeScheduledWarnings,
  type ScheduledContinuationRun,
} from "../lib/scheduled-intelligence-continuation.ts";

const NOW = new Date("2026-08-17T01:25:00.000Z");

function run(overrides: Partial<ScheduledContinuationRun> = {}): ScheduledContinuationRun {
  return {
    id: "run-1",
    status: "running",
    accuracy_gate: "ready",
    source_checks: [{ source: "axios", status: "ready" }],
    warnings: [],
    summary: "Morning research",
    updates_published: 0,
    updated_at: "2026-08-17T01:24:00.000Z",
    ...overrides,
  };
}

test("continuation waits until acquisition has persisted its source-check handoff", () => {
  assert.equal(evaluateScheduledIntelligenceContinuation(null, NOW).state, "missing");
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ source_checks: [] }), NOW).state,
    "acquisition_pending",
  );
  assert.equal(evaluateScheduledIntelligenceContinuation(run(), NOW).state, "ready");
});

test("completed and terminal research runs never restart model work", () => {
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ status: "completed" }), NOW).state,
    "completed",
  );
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ status: "failed" }), NOW).state,
    "terminal",
  );
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ status: "blocked" }), NOW).state,
    "terminal",
  );
});

test("a fresh continuation claim suppresses a racing watchdog and a stale claim can recover", () => {
  const freshClaim = intelligenceContinuationClaimWarning(new Date(NOW.getTime() - 60_000));
  const staleClaim = intelligenceContinuationClaimWarning(
    new Date(NOW.getTime() - INTELLIGENCE_CONTINUATION_CLAIM_STALE_MS - 1),
  );

  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ warnings: [freshClaim] }), NOW).state,
    "intelligence_running",
  );
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ warnings: [staleClaim] }), NOW).state,
    "ready",
  );
  assert.equal(latestIntelligenceContinuationClaimAt([freshClaim]), Date.parse(freshClaim.split(" at ")[1]));
});

test("research final status preserves structural blocking and intelligence failures", () => {
  assert.equal(finalScheduledResearchStatus("ready", "completed"), "completed");
  assert.equal(finalScheduledResearchStatus("review", "completed"), "completed");
  assert.equal(finalScheduledResearchStatus("blocked", "completed"), "blocked");
  assert.equal(finalScheduledResearchStatus("ready", "failed"), "failed");
  assert.equal(finalScheduledResearchStatus("ready", "blocked"), "blocked");
  assert.equal(finalScheduledResearchStatus("ready", "skipped"), "blocked");
});

test("warning merge is stable and deduplicated", () => {
  assert.deepEqual(
    mergeScheduledWarnings(["one", "two"], ["two", "three"], null),
    ["one", "two", "three"],
  );
});
