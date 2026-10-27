import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectEarningsWeekTiles } from "../lib/blue-desk-earnings-grid.ts";
import type { PresenterCalendarEvent } from "../lib/presenter-calendar.ts";

const base: PresenterCalendarEvent = {
  id: "earnings:test-1",
  kind: "earnings",
  title: "Example Corp Q3 2026 earnings",
  status: "scheduled",
  localDate: "2026-10-28",
  scheduledAt: "2026-10-28T20:30:00Z",
  timeLabel: "16:30 ET conference call, result release time not established",
  timePrecision: "exact",
  actual: null,
  consensus: null,
  previous: null,
  revisedPrevious: null,
  releasedAt: null,
  sourceName: "Example Corp investor relations",
  sourceUrl: "https://example.com/investors",
  sourceRecordRefs: ["issuer:example"],
  verificationState: "official",
  affectedAssets: ["EXM"],
  decidingQuestion: "Does guidance support the existing sector thesis?",
};

test("a verified conference-call clock never fabricates a results-release session", () => {
  const [tile] = projectEarningsWeekTiles([base]);
  assert.equal(tile.calendarDay, "2026-10-28");
  assert.equal(tile.calendarDayBasis, "et_instant");
  assert.equal(tile.session, "unknown");
  assert.equal(tile.impliedMove, null);
  assert.equal(tile.ticker, "EXM");
  assert.equal(tile.official, true);
});

test("issuer-confirmed results after close can populate AMC; call times cannot", () => {
  const [resultSession] = projectEarningsWeekTiles([{
    ...base,
    id: "earnings:msft",
    title: "Microsoft FY2027 Q1 earnings",
    scheduledAt: null,
    timePrecision: "date",
    timeLabel: "Results after US close; exact release time unconfirmed",
  }]);
  assert.equal(resultSession.session, "amc");
  assert.equal(resultSession.releaseSessionSourceUrl, base.sourceUrl);

  const [callSession] = projectEarningsWeekTiles([{
    ...base,
    timeLabel: "16:30 ET earnings call (results before the call, release minute unconfirmed)",
  }]);
  assert.equal(callSession.session, "unknown");
  assert.equal(callSession.releaseSessionSourceUrl, null);
});

test("new issuer records populate template without ticker-specific UI edits", () => {
  const [tile] = projectEarningsWeekTiles([{
    ...base, id: "earnings:example-2", affectedAssets: ["NEW"],
    scheduledAt: null, timePrecision: "date", verificationState: "reported",
  }]);
  assert.equal(tile.ticker, "NEW");
  assert.equal(tile.calendarDayBasis, "source_date_only");
  assert.equal(tile.session, "unknown");
  assert.equal(tile.official, false);
});

test("release session and implied straddle value require original provenance", () => {
  const [unverified] = projectEarningsWeekTiles([base], {
    [base.id]: {
      releaseSession: "amc",
      impliedMove: {
        absolutePct: 7.45,
        sourceUrl: "not-an-original-source",
        observedAt: "2026-10-26T12:00:00Z",
        expiry: "2026-10-30",
        method: "straddle",
      },
    },
  });
  assert.equal(unverified.session, "unknown");
  assert.equal(unverified.impliedMove, null);

  const [verified] = projectEarningsWeekTiles([base], {
    [base.id]: {
      releaseSession: "amc",
      releaseSessionSourceUrl: "https://example.com/investors/report-time",
      impliedMove: {
        absolutePct: 7.45,
        sourceUrl: "https://example.com/licensed-options",
        observedAt: "2026-10-26T12:00:00Z",
        expiry: "2026-10-30",
        method: "straddle",
      },
    },
  });
  assert.equal(verified.session, "amc");
  assert.equal(verified.impliedMove?.absolutePct, 7.45);
});

test("current Calendar mounts the shared tile component and retains detailed source listings", () => {
  const page = readFileSync(new URL("../app/blue-desk/calendar/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<EarningsWeekGrid records=\{earningsWeek\} now=\{now\}/);
  assert.match(page, /data-earnings-window=\{group.id\}/);
  assert.match(page, /Detailed earnings listings and source records/);
});
