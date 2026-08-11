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
