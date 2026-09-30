import assert from "node:assert/strict";
import test from "node:test";

import { buildCanonicalEditionHealth } from "../lib/canonical-edition-health.ts";

const expectedAt = "2026-09-06T01:30:00.000Z";
const now = new Date("2026-09-06T03:00:00.000Z");
const completedRun = {
  id: "run-morning",
  schedule_slot: "morning",
  scheduled_for: expectedAt,
  status: "completed",
  started_at: "2026-09-06T01:35:00.000Z",
  completed_at: "2026-09-06T02:00:00.000Z",
  warnings: [],
};
const matchingEdition = {
  snapshotId: "edition-morning",
  publishedAt: "2026-09-06T02:01:00.000Z",
  slot: "morning",
  scheduledFor: expectedAt,
  researchRunId: completedRun.id,
};

function health(overrides: Partial<Parameters<typeof buildCanonicalEditionHealth>[0]> = {}) {
  return buildCanonicalEditionHealth({
    now,
    researchRuns: [completedRun],
    editions: [matchingEdition],
    intelligenceRuns: [],
    intelligenceStages: [],
    ...overrides,
  });
}

test("healthy means the latest expected persisted cycle has its matching terminal edition", () => {
  assert.equal(health().state, "healthy");
  assert.equal(health().latestExpectedCycle.expectedAt, expectedAt);
});

test("an old persisted snapshot is stale when the latest expected cycle is missing", () => {
  const result = health({ researchRuns: [], editions: [{ ...matchingEdition, publishedAt: "2026-09-05T02:01:00.000Z" }] });
  assert.equal(result.state, "stale");
  assert.equal(result.stale, true);
});

test("a failed latest cycle remains failed even when an older persisted edition exists", () => {
  const failed = { ...completedRun, status: "failed" };
  const result = health({
    researchRuns: [failed],
    editions: [{ ...matchingEdition, researchRunId: "older-run", scheduledFor: "2026-09-05T01:15:00.000Z" }],
    intelligenceRuns: [{ id: "engine-1", research_run_id: failed.id, status: "failed", failure_detail: "candidate contract rejected" }],
    intelligenceStages: [{ engine_run_id: "engine-1", stage_key: "story_synthesis", status: "failed", failure_code: "unknown_evidence" }],
  });

  assert.equal(result.state, "failed");
  assert.equal(result.failure?.code, "unknown_evidence");
  assert.equal(result.stale, true);
});

test("a completed latest cycle without its terminal canonical edition is failed, not current", () => {
  const result = health({ editions: [] });
  assert.equal(result.state, "failed");
  assert.match(result.reason, /no matching terminal canonical edition/i);
});


test("a cycle that starts well after the slot is explicitly degraded as late", () => {
  const lateRun = {
    ...completedRun,
    started_at: "2026-09-06T06:53:00.000Z",
    completed_at: "2026-09-06T07:01:00.000Z",
  };
  const result = health({
    researchRuns: [lateRun],
    editions: [{ ...matchingEdition, publishedAt: "2026-09-06T07:01:00.000Z", researchRunId: lateRun.id }],
  });
  assert.equal(result.state, "degraded");
  assert.equal(result.slotTiming.status, "late");
  assert.equal(result.slotTiming.startDelayMinutes, 323);
  assert.match(result.reason, /323 minutes after/i);
});

test("a missing evening cycle becomes an explicit missed trigger after the grace window", () => {
  const result = health({
    now: new Date("2026-09-06T14:15:00.000Z"),
    researchRuns: [completedRun],
    editions: [matchingEdition],
  });
  assert.equal(result.latestExpectedCycle.slot, "evening");
  assert.equal(result.latestExpectedCycle.expectedAt, "2026-09-06T13:30:00.000Z");
  assert.equal(result.slotTiming.status, "missed");
  assert.equal(result.slotTiming.missedExpectedTrigger, true);
  assert.equal(result.state, "stale");
  assert.match(result.reason, /missed its start grace window/i);
});


test("before the morning slot, prior-day evening health still resolves to 21:30 MYT", () => {
  const result = health({
    now: new Date("2026-09-07T00:06:00.000Z"),
    researchRuns: [],
    editions: [matchingEdition],
  });
  assert.equal(result.latestExpectedCycle.slot, "evening");
  assert.equal(result.latestExpectedCycle.expectedAt, "2026-09-06T13:30:00.000Z");
});
