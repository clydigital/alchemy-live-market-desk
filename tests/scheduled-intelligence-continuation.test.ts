import assert from "node:assert/strict";
import test from "node:test";

import {
  INTELLIGENCE_CONTINUATION_CLAIM_STALE_MS,
  MANUAL_RETRY_SUPERSESSION_STALE_MS,
  evaluateScheduledIntelligenceContinuation,
  finalScheduledResearchStatus,
  intelligenceContinuationClaimWarning,
  intelligenceContinuationReleaseWarning,
  latestIntelligenceContinuationClaimAt,
  mergeScheduledWarnings,
  staleManualRetryCanBeSuperseded,
  supersedingRetryMatches,
  type ScheduledContinuationRun,
} from "../lib/scheduled-intelligence-continuation.ts";

const NOW = new Date("2026-08-17T01:25:00.000Z");

function run(overrides: Partial<ScheduledContinuationRun> = {}): ScheduledContinuationRun {
  return {
    id: "run-1",
    run_key: "cron-v1:morning:2026-08-17",
    schedule_slot: "morning",
    scheduled_for: "2026-08-17T01:30:00.000Z",
    started_at: "2026-08-17T01:20:00.000Z",
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

test("only stale explicit retries without completed engine work are supersession candidates", () => {
  const staleUpdatedAt = new Date(NOW.getTime() - MANUAL_RETRY_SUPERSESSION_STALE_MS - 1).toISOString();
  const retry = run({
    run_key: "cron-v1:morning:2026-08-17:retry:manual-fix",
    updated_at: staleUpdatedAt,
  });

  assert.equal(staleManualRetryCanBeSuperseded(retry, NOW), true);
  assert.equal(
    staleManualRetryCanBeSuperseded(run({ updated_at: staleUpdatedAt }), NOW),
    false,
    "canonical scheduled rows are never superseded by retry hygiene",
  );
  assert.equal(
    staleManualRetryCanBeSuperseded(retry, NOW, {
      engineStatus: "completed",
      storySnapshotCount: 0,
      baseEditionId: null,
      composedEditionId: null,
    }),
    false,
    "completed engine work must remain resumable for publication",
  );
  assert.equal(
    staleManualRetryCanBeSuperseded(
      { ...retry, updated_at: new Date(NOW.getTime() - 60_000).toISOString() },
      NOW,
    ),
    false,
    "recent retries are not stale",
  );
});

test("superseding retry must be a newer completed sibling for the exact slot occurrence", () => {
  const retry = run({
    id: "old",
    run_key: "cron-v1:evening:2026-08-17:retry:old",
    schedule_slot: "evening",
    scheduled_for: "2026-08-17T13:30:00.000Z",
    started_at: "2026-08-17T14:00:00.000Z",
  });
  const sibling = {
    id: "new",
    run_key: "cron-v1:evening:2026-08-17:retry:new",
    schedule_slot: "evening",
    scheduled_for: "2026-08-17T13:30:00.000Z",
    status: "completed",
    started_at: "2026-08-17T14:15:00.000Z",
  };

  assert.equal(supersedingRetryMatches(retry, sibling), true);
  assert.equal(supersedingRetryMatches(retry, { ...sibling, status: "running" }), false);
  assert.equal(supersedingRetryMatches(retry, { ...sibling, schedule_slot: "morning" }), false);
  assert.equal(
    supersedingRetryMatches(retry, { ...sibling, scheduled_for: "2026-08-18T13:30:00.000Z" }),
    false,
  );
  assert.equal(
    supersedingRetryMatches(retry, { ...sibling, started_at: "2026-08-17T13:59:00.000Z" }),
    false,
  );
});

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

test("durable completed-engine artifacts override a lossy failed outer status", () => {
  const completedEngine = {
    engineStatus: "completed",
    storySnapshotCount: 0,
    baseEditionId: null,
    composedEditionId: null,
  };
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ status: "failed" }), NOW, completedEngine).state,
    "publication_pending",
  );
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ status: "failed" }), NOW, {
      ...completedEngine,
      storySnapshotCount: 3,
      baseEditionId: "base-1",
    }).state,
    "composition_pending",
  );
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ status: "running" }), NOW, {
      ...completedEngine,
      baseEditionId: "base-1",
      composedEditionId: "composed-1",
    }).state,
    "publication_complete",
  );
});

test("failed research without a completed engine remains terminal", () => {
  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ status: "failed" }), NOW, {
      engineStatus: "failed",
      storySnapshotCount: 0,
      baseEditionId: null,
      composedEditionId: null,
    }).state,
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

test("a bounded partial continuation releases its orchestration claim for a later resume", () => {
  const claim = intelligenceContinuationClaimWarning(NOW);
  const release = intelligenceContinuationReleaseWarning(NOW);

  assert.equal(
    evaluateScheduledIntelligenceContinuation(run({ warnings: [claim, release] }), NOW).state,
    "ready",
  );
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
