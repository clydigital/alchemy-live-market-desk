import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { keepUncoveredBlsBackstops, type EconomicCalendarEvent } from "../lib/calendar.ts";

function event(id: string, date: string, title: string, sourceKind: EconomicCalendarEvent["sourceKind"] = "official-schedule"): EconomicCalendarEvent {
  return {
    id, date, timeLabel: "08:30 ET", country: "United States",
    g7Markets: ["United States"], event: title, category: "Inflation",
    impact: "High", referencePeriod: "September 2026", status: "Scheduled",
    actual: null, consensus: null, previous: null,
    decidingQuestion: "What changes market pricing?",
    affectedAssets: ["USD", "US02Y", "SPX"],
    sourceName: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/schedule/2026/10_sched_list.htm",
    sourceKind,
  };
}
const fallbackCpi = event("us-bls-2026-10-14-cpi-september-2026", "2026-10-14", "Consumer Price Index for September 2026");
const fallbackPpi = event("us-bls-2026-10-15-ppi-september-2026", "2026-10-15", "Producer Price Index for September 2026");

test("officially dated CPI and PPI survive when live BLS ICS and desk macro rows are unavailable", () => {
  assert.deepEqual(keepUncoveredBlsBackstops([fallbackCpi, fallbackPpi], [], []).map(x => x.id),
    [fallbackCpi.id, fallbackPpi.id]);
  assert.equal(fallbackCpi.consensus, null);
  assert.equal(fallbackPpi.previous, null);
});

test("live CPI with a different record ID replaces the same scheduled official CPI backstop", () => {
  const live = event("us-bls-live-cpi", "2026-10-14", "Consumer Price Index", "official-live");
  assert.deepEqual(keepUncoveredBlsBackstops([fallbackCpi, fallbackPpi], [live], []).map(x => x.id),
    [fallbackPpi.id]);
});

test("desk data takes precedence without losing its verified actual, consensus and revised prior", () => {
  const desk: EconomicCalendarEvent = {
    ...event("desk-cpi", "2026-10-14", "CPI September", "desk-record"),
    status: "Released", actual: "3.6%", consensus: "3.5%", previous: "3.3%",
    revisedPrevious: "3.2%",
  };
  assert.deepEqual(keepUncoveredBlsBackstops([fallbackCpi, fallbackPpi], [], [desk]).map(x => x.id),
    [fallbackPpi.id]);
  assert.equal(desk.actual, "3.6%");
  assert.equal(desk.revisedPrevious, "3.2%");
});

test("unrelated release and different-day CPI do not suppress the two scheduled dates", () => {
  const other = event("beige-book", "2026-10-14", "Beige Book");
  const next = event("next-cpi", "2026-11-10", "Consumer Price Index");
  assert.equal(keepUncoveredBlsBackstops([fallbackCpi, fallbackPpi], [other, next], []).length, 2);
});

test("BLS release backstop source carries exact date and time but no invented forecast", () => {
  const source = readFileSync(new URL("../lib/calendar.ts", import.meta.url), "utf8");
  const backstops = source.slice(source.indexOf('id: "us-bls-2026-10-14-cpi'), source.indexOf('const BLS_ICS'));
  assert.match(backstops, /date: "2026-10-14"/);
  assert.match(backstops, /date: "2026-10-15"/);
  assert.equal((backstops.match(/timeLabel: "08:30 ET"/g) || []).length, 2);
  assert.equal((backstops.match(/consensus: null/g) || []).length, 2);
  assert.equal((backstops.match(/previous: null/g) || []).length, 2);
  assert.match(backstops, /https:\/\/www\.bls\.gov\/schedule\/2026\/10_sched_list\.htm/);
});
