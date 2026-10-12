import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calendarTimePresentation, macroEtUtcTimestamp } from "../lib/market-calendar-clock.ts";

test("US October CPI 08:30 ET becomes 20:30 MYT under daylight time", () => {
  const cpi = calendarTimePresentation("2026-10-14", "08:30 ET", "2026-10-14");
  assert.match(cpi.timeText, /20:30 MYT/);
  assert.equal(cpi.sortAt, Date.parse("2026-10-14T12:30:00Z"));
});

test("November ISM 10:00 ET becomes 23:00 MYT under standard time", () => {
  const ism = calendarTimePresentation("2026-11-02", "10:00 ET", "2026-11-02");
  assert.match(ism.timeText, /23:00 MYT/);
  assert.equal(ism.sortAt, Date.parse("2026-11-02T15:00:00Z"));
});

test("confirmed bank results sort chronologically before later earnings call on same market date", () => {
  const wfc = calendarTimePresentation("2026-10-13T07:00:00-04:00", "07:00 ET results", "2026-10-13");
  const citi = calendarTimePresentation("2026-10-13T08:00:00-04:00", "08:00 ET results", "2026-10-13");
  const jpm = calendarTimePresentation("2026-10-13T08:30:00-04:00", "08:30 ET earnings call", "2026-10-13");
  assert.ok(wfc.sortAt < citi.sortAt && citi.sortAt < jpm.sortAt);
});

test("MYT publisher time is not repeated, uncertain dates remain unguessed", () => {
  assert.equal(calendarTimePresentation("2026-10-15T14:00:00+08:00", "14:00 MYT earnings conference", "2026-10-15").timeText, "14:00 MYT earnings conference");
  assert.equal(macroEtUtcTimestamp("2026-11-02", "Time unconfirmed"), null);
  assert.equal(calendarTimePresentation("2026-11-02", "Time unconfirmed", "2026-11-02").timeText, "Time unconfirmed");
});

test("calendar UI uses comparable absolute release times instead of alphabetical tickers", () => {
  const source = readFileSync(new URL("../app/calendar/page.tsx", import.meta.url), "utf8");
  assert.match(source, /a\.sortAt - b\.sortAt/);
  assert.match(source, /calendarTimePresentation/);
});
