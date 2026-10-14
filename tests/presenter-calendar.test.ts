import assert from "node:assert/strict";
import test from "node:test";

import type { EconomicCalendarEvent } from "../lib/calendar.ts";
import type { ForwardEarningsResult } from "../lib/forward-earnings-sources.ts";
import { normaliseMarketEvent } from "../lib/market-events.ts";
import { buildPresenterCalendar, PRESENTER_CALENDAR_CONTRACT } from "../lib/presenter-calendar.ts";

const emptyEarnings: ForwardEarningsResult = { events: [], coverage: "unavailable", warning: "Earnings provider is unavailable." };

function macro(id: string, date: string, timeLabel: string, status: "Scheduled" | "Released" = "Scheduled", actual: string | null = null): EconomicCalendarEvent {
  return {
    id, date, timeLabel, country: "United States", g7Markets: ["United States"],
    event: id, category: "Inflation", impact: "High", referencePeriod: null,
    status, actual, consensus: "0.3%", previous: "0.2%", revisedPrevious: null,
    decidingQuestion: "Do yields confirm?", affectedAssets: ["US02Y", "GOLD"],
    sourceName: "Official agency", sourceUrl: "https://example.org/release", sourceKind: "official-live",
  };
}

test("reuses official calendar observations, correct EDT-to-MYT conversion and no manufactured release timestamp", () => {
  const now = new Date("2026-10-14T22:00:00Z"); // Thu 06:00 MYT
  const release = macro("official-cpi", "2026-10-14", "08:30 ET", "Released", "0.6%");
  const result = buildPresenterCalendar([release], emptyEarnings, now);
  assert.equal(result.contractVersion, PRESENTER_CALENDAR_CONTRACT);
  assert.equal(result.timezone, "Asia/Kuala_Lumpur");
  const event = result.events[0];
  assert.equal(event.id, "macro:official-cpi");
  assert.equal(event.localDate, "2026-10-14");
  assert.equal(event.scheduledAt, "2026-10-14T12:30:00.000Z");
  assert.match(event.timeLabel, /20:30 MYT/);
  assert.equal(event.actual, "0.6%");
  assert.equal(event.consensus, "0.3%");
  assert.equal(event.previous, "0.2%");
  assert.equal(event.releasedAt, null); // no source-published timestamp in this adapter
  assert.deepEqual(result.windows.released, ["macro:official-cpi"]);
  assert.equal(result.windows.next24h.length, 0);
});

test("a stale scheduled economic release is NOT marked released from its time or age", () => {
  const now = new Date("2026-10-15T04:00:00+08:00");
  const stale = macro("still-awaiting", "2026-10-14", "08:30 ET");
  const result = buildPresenterCalendar([stale], emptyEarnings, now);
  assert.equal(result.events[0].status, "scheduled");
  assert.deepEqual(result.windows.released, []);
  assert.deepEqual(result.windows.next24h, []);
  assert.deepEqual(result.windows.next7d, []);
});

test("a date-only schedule is eligible for 7 Days but never assigned an invented 24H time", () => {
  const now = new Date("2026-10-15T05:00:00+08:00");
  const event = macro("undated-hour", "2026-10-15", "Time TBC");
  const result = buildPresenterCalendar([event], emptyEarnings, now);
  assert.equal(result.events[0].scheduledAt, null);
  assert.equal(result.events[0].timePrecision, "tbc");
  assert.deepEqual(result.windows.next24h, []);
  assert.deepEqual(result.windows.next7d, ["macro:undated-hour"]);
});

test("exact issuer timestamp can cross MYT date boundary; reporter status does not imply earnings released", () => {
  const company = normaliseMarketEvent({
    eventType: "earnings", occurrenceKey: "example:q3:2026", title: "Example earnings",
    startAt: "2026-10-14T18:00:00-04:00", timePrecision: "exact",
    status: "reported", verificationState: "reported",
    sourceName: "Company calendar", sourceUrl: "https://example.org/earnings",
    sourceRecordRefs: ["report:q3"], decisiveVariable: "Check guidance",
  });
  assert.ok(company);
  const now = new Date("2026-10-15T05:00:00+08:00");
  const result = buildPresenterCalendar([], { events: [company], coverage: "provider_only", warning: null }, now);
  assert.equal(result.events[0].localDate, "2026-10-15");
  assert.equal(result.events[0].status, "scheduled");
  assert.equal(result.events[0].scheduledAt, "2026-10-14T22:00:00.000Z");
  assert.deepEqual(result.windows.released, []);
  assert.deepEqual(result.events[0].sourceRecordRefs, ["report:q3"]);
});

test("week released window retains last week through Sunday and resets Monday 00:00 MYT", () => {
  const released = macro("cpi-wed", "2026-10-14", "08:30 ET", "Released", "0.6%");
  const sunday = buildPresenterCalendar([released], emptyEarnings, new Date("2026-10-18T23:59:59+08:00"));
  assert.equal(sunday.tradingWeekStart, "2026-10-12T00:00:00+08:00");
  assert.deepEqual(sunday.windows.released, ["macro:cpi-wed"]);
  const monday = buildPresenterCalendar([released], emptyEarnings, new Date("2026-10-19T00:00:00+08:00"));
  assert.equal(monday.tradingWeekStart, "2026-10-19T00:00:00+08:00");
  assert.deepEqual(monday.windows.released, []);
});

test("ET standard-time schedules move from 20:30 to 21:30 MYT after US DST ends", () => {
  const result = buildPresenterCalendar([macro("nov-data", "2026-11-05", "08:30 ET")], emptyEarnings, new Date("2026-11-04T00:00:00Z"));
  assert.equal(result.events[0].scheduledAt, "2026-11-05T13:30:00.000Z");
  assert.match(result.events[0].timeLabel, /21:30 MYT/);
});

test("provider failure remains explicit and does not synthesize released events", () => {
  const result = buildPresenterCalendar([], emptyEarnings, new Date("2026-10-15T00:00:00Z"), true);
  assert.equal(result.sourceHealth.macro, "unavailable");
  assert.equal(result.sourceHealth.earnings, "unavailable");
  assert.match(result.sourceHealth.warnings.join(" "), /adapter failed/);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.windows.released, []);
});

test("Next 24H is instant-based and the upper boundary is exclusive", () => {
  const now = new Date("2026-10-15T05:00:00+08:00");
  const first = macro("inside", "2026-10-15", "08:30 ET");
  const upper = macro("upper", "2026-10-16", "05:00 MYT");
  // The unparseable MYT label must not be forced into a fabricated exact instant.
  const result = buildPresenterCalendar([first, upper], emptyEarnings, now);
  assert.deepEqual(result.windows.next24h, ["macro:inside"]);
  assert.equal(result.events.find(event => event.id === "macro:upper")?.scheduledAt, null);
});
