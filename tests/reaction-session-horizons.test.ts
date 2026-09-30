import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("reaction horizon contract includes close and next-session without a hard-coded holiday calendar", () => {
  const source = readFileSync(new URL("../lib/providers/twelve-data-reactions.ts", import.meta.url), "utf8");
  assert.match(source, /"5m" \| "30m" \| "4h" \| "close" \| "next_session"/);
  assert.match(source, /America\/New_York/);
  assert.match(source, /completedRegularSessionCloses/);
  assert.match(source, /const latestNeeded = asOfAt/);
  assert.doesNotMatch(source, /NYSE_HOLIDAY|MARKET_HOLIDAY|holidayCalendar/);
});
