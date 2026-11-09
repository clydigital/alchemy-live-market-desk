import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/blue-desk/calendar/page.tsx", import.meta.url), "utf8");

test("public Bluebelly calendar leads with its interactive week grid", () => {
  const heading = page.indexOf('data-v7-calendar="source-dated-catalyst-command"');
  assert.match(page,/className=\{`\$\{styles\.calendarHero\} \$\{command\.hero\}`\}/);
  const calendar = page.indexOf("<CatalystCalendar ");
  const earnings = page.indexOf("<IssuerEarningsBoard ");
  const scorecards = page.indexOf("<RecentEarningsScorecards ");
  assert.ok(heading >= 0 && calendar > heading, "calendar follows the page heading");
  assert.ok(earnings > calendar, "earnings board is below the calendar");
  assert.ok(scorecards > earnings, "reported earnings follow the earnings board");
});

test("public Calendar does not prepend dated desk research", () => {
  assert.doesNotMatch(page, /CurrentMarketUpdates|DATED DESK RESEARCH/);
  assert.match(page, /getBluebellyCatalystSources\(/, "existing calendar sources stay in place");
  assert.match(page, /<CatalystCalendar items=\{catalysts\}/, "interactive calendar remains wired");
});
