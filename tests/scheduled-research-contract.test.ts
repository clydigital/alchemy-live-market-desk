import assert from "node:assert/strict";
import test from "node:test";

import { CANONICAL_RESEARCH_SLOTS, getFourSlotResearchHealth } from "../lib/research-schedule-health.ts";

test("uses the canonical 09:15 and 21:15 Malaysia schedule", () => {
  assert.deepEqual(CANONICAL_RESEARCH_SLOTS, [
    { key: "morning", label: "09:15 full desk update", hour: 9, minute: 15 },
    { key: "evening", label: "21:15 evening delta", hour: 21, minute: 15 },
  ]);
  const health = getFourSlotResearchHealth([], new Date("2026-08-11T17:30:00.000Z"), true);
  assert.equal(health.slots[0].expectedAt, "2026-08-11T01:15:00.000Z");
  assert.equal(health.slots[0].nextAt, "2026-08-12T01:15:00.000Z");
  assert.equal(health.slots[1].expectedAt, "2026-08-11T13:15:00.000Z");
  assert.equal(health.slots[1].nextAt, "2026-08-12T13:15:00.000Z");
});
