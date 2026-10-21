import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  selectBlueDeskUpcoming, selectBlueDeskNext24Hours, selectBlueDeskReleasedWeek,
} from "../lib/blue-desk-calendar.ts";
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

test("next 24h requires a known instant and excludes the exact end boundary", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const rows = [
    event("start", "2026-10-19T12:00:00Z", "2026-10-19"),
    event("inside", "2026-10-20T11:59:59Z", "2026-10-20"),
    event("end-excluded", "2026-10-20T12:00:00Z", "2026-10-20"),
    event("date-only", null, "2026-10-19"),
    event("released-excluded", "2026-10-19T14:00:00Z", "2026-10-19", "released"),
  ];
  assert.deepEqual(selectBlueDeskNext24Hours({ events: rows }, now).map(x => x.id), ["start", "inside"]);
});

test("released ET week rejects prior Sunday, future releases and overdue scheduled", () => {
  const now = new Date("2026-10-19T12:00:00Z"); // Monday 08:00 EDT
  const rows = [
    event("monday", "2026-10-19T08:00:00Z", "2026-10-19", "released"),
    event("sunday", "2026-10-19T02:00:00Z", "2026-10-19", "released"),
    event("overdue", "2026-10-19T08:00:00Z", "2026-10-19", "scheduled"),
    event("future", "2026-10-20T12:00:00Z", "2026-10-20", "released"),
  ];
  assert.deepEqual(selectBlueDeskReleasedWeek({ events: rows }, now).map(x => x.id), ["monday"]);
});

test("one ET calendar day survives a late Sunday EST boundary", () => {
  const now = new Date("2026-11-02T04:30:00Z"); // Sunday Nov 1 23:30 EST
  const rows = [
    event("same-day", "2026-11-02T04:45:00Z", "2026-11-02"),
    event("next-et-day", "2026-11-02T13:30:00Z", "2026-11-02"),
  ];
  assert.deepEqual(selectBlueDeskUpcoming({ events: rows }, now, 1).map(x => x.id), ["same-day"]);
});

test("late-October 7d window can be empty while actual scheduled events remain in the 30d catalog", () => {
  const now = new Date("2026-10-21T19:00:00Z"); // 15:00 EDT
  const fomc = event("fomc-official", "2026-10-28T18:00:00Z", "2026-10-29");
  const next = event("next-week", null, "2026-10-29");
  const catalog = { events: [fomc, next] };
  assert.deepEqual(selectBlueDeskUpcoming(catalog, now, 7), []);
  assert.deepEqual(selectBlueDeskUpcoming(catalog, now, 30).map(row => row.id), [
    "fomc-official", "next-week",
  ]);
  // The exact source time and unplaced date-only distinction survive.
  assert.equal(selectBlueDeskUpcoming(catalog, now, 30)[0].scheduledAt, "2026-10-28T18:00:00Z");
  assert.equal(selectBlueDeskUpcoming(catalog, now, 30)[1].scheduledAt, null);
});

test("public Blue Desk displays broader real calendar instead of blank default week", () => {
  const calendar = readFileSync(new URL("../app/blue-desk/calendar/page.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
  assert.match(calendar, /raw === "24h" \|\| raw === "7d" \|\| raw === "released" \? raw : "30d"/);
  assert.match(calendar, /selectBlueDeskUpcoming\(calendar, now, 30\)\.slice\(0, 3\)/);
  assert.match(calendar, /No scheduled events in this window/);
  assert.match(calendar, /These are not released results/);
  assert.match(calendar, /Browse the 30-day calendar/);
  assert.match(calendar, /<Events records=\{nextKnown\} statusLabel="30d" \/>/);
  assert.match(calendar, /getEconomicCalendar\(\)/);
  assert.match(calendar, /buildPresenterCalendar\(macro, earnings, now, macroResult\.status === "rejected"\)/);
  assert.match(calendar, /sourceUrl\(event\.sourceUrl\)/);
  assert.match(calendar, /<DualTimestamp value=\{event\.scheduledAt\} sourceDate=\{event\.localDate\}/);
  assert.match(home, /const upcoming7d = selectBlueDeskUpcoming\(calendar, now\)\.slice\(0, 6\)/);
  assert.match(home, /upcoming7d\.length \? \[\] : selectBlueDeskUpcoming\(calendar, now, 30\)\.slice\(0, 3\)/);
  assert.match(home, /No scheduled events in the seven-day ET calendar window/);
  assert.doesNotMatch(calendar, /const events = \[\s*\{\s*event: "FOMC"/);
  assert.doesNotMatch(home, /status:\s*"Released"\s*\/\/ guessed/);
});
