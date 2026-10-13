import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const admission = readFileSync(new URL("../lib/dossier-v2/canonical-snapshot.ts", import.meta.url), "utf8");
const packet = readFileSync(new URL("../lib/dossier-v2/input-packet.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/dossier/page.tsx", import.meta.url), "utf8");

test("8 October FRED daily observations cross the five-calendar-day gate between the two frozen editions", () => {
  const DAY_MS = 86_400_000;
  const dailyStart = Date.parse("2026-10-08T00:00:00Z");
  const d12 = Date.parse("2026-10-12T22:11:23.968Z");
  const d13 = Date.parse("2026-10-13T20:18:17.734Z");
  const breakeven9 = Date.parse("2026-10-09T00:00:00Z");
  assert.ok(d12 - dailyStart < 5 * DAY_MS);
  assert.ok(d13 - dailyStart > 5 * DAY_MS);
  assert.ok(d13 - breakeven9 < 5 * DAY_MS);
  // This fix must not loosen observation admission merely to recover a
  // confident curve from prices that have crossed their expiry boundary.
  assert.match(admission, /asOfMs - occurrenceMs <= \(row\.frequency === "monthly" \? 45 : 5\) \* 86_400_000/);
  assert.match(packet, /const FRED_RATE_CONTEXT_HISTORY_MS = 5 \* 24 \* 60 \* 60 \* 1000/);
});

test("the visible Dossier explains actual stored rate input coverage before its headline", () => {
  assert.match(page, /US Rate Regime analytical coverage/);
  assert.match(page, /RATE INPUT COVERAGE/);
  assert.match(page, /dossier\.health\.analyticalRateCoverage\.rateInputsPresent/);
  assert.match(page, /dossier\.health\.analyticalRateCoverage\.treasuryCurvePresent/);
  assert.ok(page.indexOf("RATE INPUT COVERAGE") < page.indexOf("<section className={styles.hero}>"));
  assert.doesNotMatch(page, /getMarketMonitor\(\).*system1_rate_regime/);
});
