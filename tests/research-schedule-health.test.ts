import assert from "node:assert/strict";
import test from "node:test";

import { getFourSlotResearchHealth } from "../lib/research-schedule-health.ts";

const pastRun = [{
  schedule_slot: "morning" as const,
  scheduled_for: "2026-08-10T00:30:00.000Z",
  completed_at: "2026-08-10T00:40:00.000Z",
  status: "completed" as const,
  warnings: [],
}];

test("disabled scheduling is reported as paused instead of missed", () => {
  const health = getFourSlotResearchHealth(pastRun, new Date("2026-08-12T04:00:00.000Z"), false);
  assert.equal(health.state, "disabled");
  assert.ok(health.slots.every((slot) => slot.status === "disabled"));
});

test("enabled scheduling retains real slot health", () => {
  const health = getFourSlotResearchHealth(pastRun, new Date("2026-08-12T04:00:00.000Z"), true);
  assert.notEqual(health.state, "disabled");
  assert.ok(health.slots.some((slot) => slot.status === "missed"));
});


test("auxiliary video runs do not make canonical Live research look fresher", () => {
  const health = getFourSlotResearchHealth([
    {
      schedule_slot: "morning",
      scheduled_for: "2026-09-30T01:30:00.000Z",
      completed_at: "2026-09-30T07:01:32.031Z",
      status: "completed",
      warnings: [],
    },
    {
      schedule_slot: "video_late_morning",
      scheduled_for: "2026-09-30T13:00:00.000Z",
      completed_at: "2026-09-30T13:55:27.186Z",
      status: "completed",
      warnings: [],
    },
  ], new Date("2026-09-30T16:10:00.000Z"), true);

  assert.equal(health.latestCompletedAt, "2026-09-30T07:01:32.031Z");
  assert.equal(health.slots.find((slot) => slot.key === "evening")?.status, "missed");
});

test("video-only history does not count as configured full-desk research", () => {
  const health = getFourSlotResearchHealth([
    {
      schedule_slot: "video_late_morning",
      scheduled_for: "2026-09-30T13:00:00.000Z",
      completed_at: "2026-09-30T13:55:27.186Z",
      status: "completed",
      warnings: [],
    },
  ], new Date("2026-09-30T16:10:00.000Z"), true);

  assert.equal(health.state, "not_configured");
  assert.equal(health.latestCompletedAt, null);
});

test("scheduled collection can complete while the freshness gate fails", () => {
  const health = getFourSlotResearchHealth([
    { schedule_slot: "morning", scheduled_for: "2026-10-20T01:30:00Z", completed_at: "2026-10-20T07:47:58Z",
      status: "completed", freshness_gate_passed: false, evidence_gate_passed: true, required_sources_complete: true, source_checks: [{ source: "fxstreet", status: "blocked" }], warnings: ["macro capture partial"], updates_published: 0 },
    { schedule_slot: "evening", scheduled_for: "2026-10-20T13:30:00Z", completed_at: "2026-10-20T14:41:22Z",
      status: "completed", freshness_gate_passed: false, evidence_gate_passed: true, required_sources_complete: true, source_checks: [{ source: "fxstreet", status: "blocked" }], warnings: ["macro source failed"], updates_published: 0 },
  ], new Date("2026-10-20T15:10:00Z"), true);
  assert.equal(health.state, "attention");
  assert.equal(health.completedCount, 0);
  assert.deepEqual(health.slots.map(item => item.status), ["degraded", "degraded"]);
});

test("a fully checked quiet session remains healthy with zero Story changes", () => {
  const health = getFourSlotResearchHealth([
    { schedule_slot: "morning", scheduled_for: "2026-10-20T01:30:00Z", completed_at: "2026-10-20T02:44:00Z",
      status: "completed", freshness_gate_passed: false, evidence_gate_passed: true, required_sources_complete: true, source_checks: [{ source: "fxstreet", status: "checked" }, { source: "axios", status: "checked" }], warnings: [], updates_published: 0 },
    { schedule_slot: "evening", scheduled_for: "2026-10-20T13:30:00Z", completed_at: "2026-10-20T14:44:00Z",
      status: "completed", freshness_gate_passed: true, evidence_gate_passed: true, required_sources_complete: true, warnings: [], updates_published: 0 },
  ], new Date("2026-10-20T15:10:00Z"), true);
  assert.equal(health.state, "healthy");
  assert.equal(health.completedCount, 2);
});
