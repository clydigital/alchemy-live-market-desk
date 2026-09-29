import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Overview keeps the weekly high-impact calendar instead of one next event", () => {
  const page = source("../app/page.tsx");
  const reminder = source("../components/live-desk/EconomicReleaseReminder.tsx");

  assert.match(page, /weeklyHighImpactReleases/);
  assert.match(page, /const upcomingReleases = weeklyHighImpactReleases/);
  assert.match(page, /<EconomicReleaseReminder releases=\{upcomingReleases\}/);
  assert.doesNotMatch(page, /return candidates\[0\] \|\| null/);

  assert.match(reminder, /Upcoming high-impact events · this week/);
  assert.match(reminder, /Weekly economic risk calendar/);
  assert.match(reminder, /releases\.map/);
  assert.match(reminder, /Weekly high-impact economic events/);
});
