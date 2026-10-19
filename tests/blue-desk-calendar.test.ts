import assert from "node:assert/strict";
import test from "node:test";

import { selectBlueDeskUpcoming } from "../lib/blue-desk-calendar.ts";
import type { PresenterCalendarEvent } from "../lib/presenter-calendar.ts";

function event(
  id: string, scheduledAt: string | null, localDate: string, status: PresenterCalendarEvent["status"] = "scheduled",
): PresenterCalendarEvent {
  return {
    id, kind: "economic", title: id, status, localDate, scheduledAt,
    timeLabel: scheduledAt ? "Exact timestamp" : "Time TBC",
    timePrecision: scheduledAt ? "exact" : "tbc",
    actual: null, consensus: null, previous: null, revisedPrevious: null,
    releasedAt: null, sourceName: "Fixture", sourceUrl: "https://example.org/source",
    sourceRecordRefs: [id], verificationState: "official", affectedAssets: [],
    decidingQuestion: "What changes?",
  };
}

test("Blue Desk calendar groups by ET trading date, not the later SGT date", () => {
  const now = new Date("2026-10-19T18:30:00Z"); // 14:30 EDT / 02:30 SGT next day
  const sameEtDay = event("same", "2026-10-19T19:00:00Z", "2026-10-20");
  const earlier = event("earlier", "2026-10-19T18:00:00Z", "2026-10-20");
  const next = event("next", "2026-10-20T14:00:00Z", "2026-10-20");
  assert.deepEqual(
    selectBlueDeskUpcoming({ events: [next, earlier, sameEtDay] }, now).map(x => x.id),
    ["same", "next"],
  );
});

test("ET calendar seven-day boundary follows New York at EST transition", () => {
  const now = new Date("2026-10-31T16:00:00Z");
  const last = event("last", "2026-11-06T13:30:00Z", "2026-11-06");
  const outside = event("outside", "2026-11-07T13:30:00Z", "2026-11-07");
  assert.deepEqual(
    selectBlueDeskUpcoming({ events: [outside, last] }, now).map(x => x.id),
    ["last"],
  );
});

test("exact times sort before unplaced source-date-only events; released excluded", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const dateOnly = event("date-only", null, "2026-10-20");
  const future = event("exact", "2026-10-19T19:00:00Z", "2026-10-20");
  const done = event("released", "2026-10-19T12:30:00Z", "2026-10-19", "released");
  assert.deepEqual(
    selectBlueDeskUpcoming({ events: [dateOnly, done, future] }, now).map(x => x.id),
    ["exact", "date-only"],
  );
});
