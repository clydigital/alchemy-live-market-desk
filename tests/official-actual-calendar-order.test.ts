import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("scheduled research resolves official Actuals before building calendar-backed input", () => {
  const source = readFileSync(
    new URL("../lib/cron-research-handler.ts", import.meta.url),
    "utf8",
  );

  const actuals = source.indexOf("const officialActuals = await safeOfficialActualIngestion");
  const input = source.indexOf("(dependencies.buildScheduledResearchInput ?? buildScheduledResearchInputWithFirecrawl)");
  assert.ok(actuals >= 0, "official Actual ingestion call must remain explicit");
  assert.ok(input >= 0, "scheduled research input construction must remain explicit");
  assert.ok(actuals < input, "official Actuals must resolve before calendar-backed input is built");
});

test("desk macro calendar reads bypass stale fetch cache", () => {
  const source = readFileSync(
    new URL("../lib/calendar.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("async function fetchDeskCalendar");
  const end = source.indexOf("\n}\n\nexport async function getEconomicCalendar", start);
  assert.ok(start >= 0 && end > start, "fetchDeskCalendar source block must exist");

  const block = source.slice(start, end);
  assert.match(block, /macro_releases[\s\S]*?cache:\s*"no-store"/);
  assert.match(block, /macro_release_metrics[\s\S]*?cache:\s*"no-store"/);
  assert.doesNotMatch(block, /revalidate:\s*60/);
});
