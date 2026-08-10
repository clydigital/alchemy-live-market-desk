import assert from "node:assert/strict";
import test from "node:test";

import { buildUnscoredSnapshot, mapNextRelease } from "../lib/challenger.ts";

test("Challenger fails closed while its ledger has no enabled factors", () => {
  const snapshot = buildUnscoredSnapshot({ now: new Date("2026-08-10T00:00:00Z") });

  assert.equal(snapshot.assets.SPX.score, null);
  assert.equal(snapshot.assets.SPX.bias, "unscored");
  assert.equal(snapshot.assets.SPX.conviction, null);
  assert.equal(snapshot.methodology.enabledFactorCount, 0);
  assert.equal(snapshot.methodology.scoringAvailable, false);
  assert.equal(snapshot.assets.SPX.forwardTally.length, 7);
  assert.ok(snapshot.assets.SPX.forwardTally.every((row) => row.sampleSize === 0));
});

test("release calendar mapping selects the next Challenger event and publishes both time zones", () => {
  const next = mapNextRelease([
    { release_id: 50, release_name: "Employment Situation", date: "2026-08-07" },
    { release_id: 10, release_name: "Consumer Price Index", date: "2026-08-12" },
    { release_id: 53, release_name: "Gross Domestic Product", date: "2026-08-27" },
  ], new Date("2026-08-10T01:00:00Z"));

  assert.ok(next);
  assert.equal(next.name, "CPI");
  assert.equal(next.publishAt, "2026-08-12T12:30:00.000Z");
  assert.equal(next.timeEt, "08:30 ET");
  assert.equal(next.timeMyt, "20:30 MYT");
  assert.equal(next.daysUntil, 2);
  assert.deepEqual(next.factorIds, ["headline_cpi", "core_cpi"]);
});
