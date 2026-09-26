import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveScheduledResearchIdentity,
  scheduledForMalaysiaSlot,
  scheduledOccurrenceMalaysiaDateKey,
  scheduledRunKey,
} from "../lib/scheduled-research-identity.ts";

test("after-midnight evening retries remain anchored to the previous evening occurrence", () => {
  const now = new Date("2026-09-26T17:00:00.000Z"); // 01:00 MYT on 27 Sep
  assert.equal(scheduledOccurrenceMalaysiaDateKey("evening", now), "2026-09-26");
  assert.equal(scheduledForMalaysiaSlot("evening", now), "2026-09-26T21:15:00+08:00");
  assert.equal(scheduledRunKey("evening", now), "cron-v1:evening:2026-09-26");

  const request = new Request("https://example.com/api/cron/research/evening?retry=late");
  assert.deepEqual(resolveScheduledResearchIdentity(request, "evening", now), {
    runKey: "cron-v1:evening:2026-09-26:retry:late",
    scheduledFor: "2026-09-26T21:15:00+08:00",
  });
});

test("a slot uses the current Malaysia date once its scheduled time has passed", () => {
  const morning = new Date("2026-09-27T02:00:00.000Z"); // 10:00 MYT
  const evening = new Date("2026-09-27T14:00:00.000Z"); // 22:00 MYT

  assert.equal(scheduledForMalaysiaSlot("morning", morning), "2026-09-27T09:15:00+08:00");
  assert.equal(scheduledRunKey("morning", morning), "cron-v1:morning:2026-09-27");
  assert.equal(scheduledForMalaysiaSlot("evening", evening), "2026-09-27T21:15:00+08:00");
  assert.equal(scheduledRunKey("evening", evening), "cron-v1:evening:2026-09-27");
});

test("an early manual slot run resolves to the latest completed scheduled occurrence", () => {
  const beforeMorning = new Date("2026-09-27T00:30:00.000Z"); // 08:30 MYT
  assert.equal(scheduledForMalaysiaSlot("morning", beforeMorning), "2026-09-26T09:15:00+08:00");
  assert.equal(scheduledRunKey("morning", beforeMorning), "cron-v1:morning:2026-09-26");
});
