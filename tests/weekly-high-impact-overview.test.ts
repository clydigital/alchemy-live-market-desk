import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Overview keeps the weekly high-impact calendar instead of one next event", () => {
  const page = source("../app/page.tsx");
  const reminder = source("../components/live-desk/EconomicReleaseReminder.tsx");
  const calendar = source("../lib/calendar.ts");

  assert.match(page, /weeklyHighImpactReleases/);
  assert.match(page, /personal income and outlays/);
  assert.match(page, /const upcomingReleases = weeklyHighImpactReleases/);
  assert.match(page, /<EconomicReleaseReminder releases=\{upcomingReleases\}/);
  assert.doesNotMatch(page, /return candidates\[0\] \|\| null/);

  assert.match(reminder, /Upcoming high-impact events · this week/);
  assert.match(reminder, /Weekly economic risk calendar/);
  assert.match(reminder, /releases\.map/);
  assert.match(reminder, /Weekly high-impact economic events/);
  assert.doesNotMatch(page, /immediateRelease=\{null\}/);
  assert.match(reminder, /Calendar coverage may be incomplete/);
  assert.doesNotMatch(reminder, /if \(!releases\.length\) return null/);
  assert.match(calendar, /us-bea-2026-09-30-personal-income-outlays-august-2026/);
  assert.match(calendar, /us-adp-2026-09-30-national-employment-report/);
  assert.match(calendar, /us-ism-2026-10-01-manufacturing-pmi-september-2026/);
  assert.match(calendar, /us-bls-2026-10-02-employment-situation-for-september-2026/);
  assert.match(calendar, /\.\.\.officialScheduleFallbacks, \.\.\.blsEvents, \.\.\.deskEvents/);
});
