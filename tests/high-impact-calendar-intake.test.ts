import assert from "node:assert/strict";
import test from "node:test";

import type { EconomicCalendarEvent } from "../lib/calendar.ts";
import { buildHighImpactCalendarIntake } from "../lib/high-impact-calendar-intake.ts";

function event(overrides: Partial<EconomicCalendarEvent> = {}): EconomicCalendarEvent {
  return {
    id: "us-bls-2026-10-02-employment-situation-for-september-2026",
    date: "2026-10-02",
    timeLabel: "08:30 ET",
    country: "United States",
    g7Markets: ["United States"],
    event: "Employment Situation for September 2026",
    category: "Labour",
    impact: "High",
    referencePeriod: "September 2026",
    status: "Released",
    actual: "Nonfarm payrolls +29k; unemployment 4.2%; participation 61.8%; AHE +3.2% y/y",
    consensus: null,
    previous: null,
    decidingQuestion: "Are payrolls, unemployment and wages changing the Fed path?",
    affectedAssets: ["USD", "US02Y", "SPX"],
    sourceName: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/news.release/archives/empsit_10022026.htm",
    sourceKind: "desk-record",
    ...overrides,
  };
}

test("released top-tier payrolls remain canonical intake for seven days", () => {
  const items = buildHighImpactCalendarIntake(
    [event()],
    new Date("2026-10-07T00:00:00Z"),
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].itemKey, "calendar:us-bls-2026-10-02-employment-situation-for-september-2026");
  assert.equal(items[0].publisher, "U.S. Bureau of Labor Statistics");
  assert.equal(items[0].recommendedAction, "collect_evidence");
  assert.match(items[0].summary, /Nonfarm payrolls \+29k/);
});

test("stale scheduled payrolls do not use the released-event lookback", () => {
  const items = buildHighImpactCalendarIntake(
    [event({ status: "Scheduled", actual: null })],
    new Date("2026-10-07T00:00:00Z"),
  );

  assert.equal(items.length, 0);
});

test("non-top-tier released macro events retain the original two-day lookback", () => {
  const items = buildHighImpactCalendarIntake(
    [event({
      id: "us-bls-2026-10-02-jolts",
      event: "JOLTS Job Openings",
      referencePeriod: "August 2026",
      actual: "Job openings 7.1M",
    })],
    new Date("2026-10-07T00:00:00Z"),
  );

  assert.equal(items.length, 0);
});
