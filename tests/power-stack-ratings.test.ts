import assert from "node:assert/strict";
import test from "node:test";

import {
  POWER_STACK_RATING_IMPORT_V1,
  POWER_STACK_RATING_SNAPSHOT_V1,
  enrichDailyBriefSnapshotWrite,
  parsePowerStackRatingSnapshot,
  type FrozenPowerStackRatingImport,
} from "../lib/power-stack-ratings.ts";

const snapshot = {
  contractVersion: POWER_STACK_RATING_SNAPSHOT_V1,
  snapshotAt: "2026-09-03T09:48:00Z",
  sourceCommit: "7449dc8387d8b83f161e8397c39563a0a1250806",
  macroContextGeneratedAt: "2026-09-03T06:02:00Z",
  macroProfileUpdatedAt: "2026-09-03T06:08:00Z",
  methodology: { name: "Power Stack Macro Pulse v4 stock scoring", macroAdjustmentCap: 1 },
  ratings: [{
    ticker: "DELL",
    name: "Dell Technologies",
    themeGroup: "AI Infrastructure / Systems",
    researchScore: 8.6,
    macroAdjustment: 0.16,
    adjustedScore: 8.8,
    industryMacroRisk: {
      industry: "AI / Data Centres",
      score: 56,
      label: "Elevated",
      asOf: "2026-09-03T09:48:00Z",
      pressures: ["Financial Conditions", "Input Costs"],
      offsets: ["Industrial / AI / Power Capex"],
    },
  }],
  sourceFiles: ["data/macro-context.json", "app.js", "industry-risk.js"],
};

const imported: FrozenPowerStackRatingImport = {
  contractVersion: POWER_STACK_RATING_IMPORT_V1,
  importedAt: "2026-09-03T10:00:00Z",
  sourceSnapshotAt: snapshot.snapshotAt,
  sourceCommit: snapshot.sourceCommit,
  macroContextGeneratedAt: snapshot.macroContextGeneratedAt,
  macroProfileUpdatedAt: snapshot.macroProfileUpdatedAt,
  methodology: snapshot.methodology,
  ratings: snapshot.ratings,
  sourceFiles: snapshot.sourceFiles,
  sourceUrl: "https://example.test/power-stack.json",
};

test("validates the Power Stack export and preserves the DELL research/macro split", () => {
  const parsed = parsePowerStackRatingSnapshot(snapshot);
  assert.ok(parsed);
  assert.equal(parsed.ratings[0].ticker, "DELL");
  assert.equal(parsed.ratings[0].researchScore, 8.6);
  assert.equal(parsed.ratings[0].macroAdjustment, 0.16);
  assert.equal(parsed.ratings[0].adjustedScore, 8.8);
  assert.equal(parsed.ratings[0].industryMacroRisk?.score, 56);
});

test("rejects out-of-contract ratings rather than guessing", () => {
  assert.equal(parsePowerStackRatingSnapshot({ ...snapshot, contractVersion: "future/v9" }), null);
  assert.equal(parsePowerStackRatingSnapshot({
    ...snapshot,
    ratings: [{ ...snapshot.ratings[0], macroAdjustment: 1.4 }],
  }), null);
});

test("freezes the imported rating packet into an immutable daily-brief payload", async () => {
  const init = await enrichDailyBriefSnapshotWrite("hybrid_publication_snapshots", {
    method: "POST",
    body: JSON.stringify({
      snapshot_type: "daily_brief",
      payload: { contractVersion: 2, canonicalStoryManifest: [] },
    }),
  }, async () => imported);
  const body = JSON.parse(String(init.body));
  assert.deepEqual(body.payload.powerStackRatings, imported);
  assert.equal(body.payload.powerStackRatings.ratings[0].adjustedScore, 8.8);
});

test("does not recalculate or replace a rating packet already frozen in an edition", async () => {
  let loads = 0;
  const existing = { ...imported, sourceCommit: "historical-commit" };
  const init = await enrichDailyBriefSnapshotWrite("hybrid_publication_snapshots", {
    method: "POST",
    body: JSON.stringify({
      snapshot_type: "daily_brief",
      payload: { contractVersion: 2, powerStackRatings: existing },
    }),
  }, async () => {
    loads += 1;
    return imported;
  });
  assert.equal(loads, 0);
  assert.deepEqual(JSON.parse(String(init.body)).payload.powerStackRatings, existing);
});

test("Power Stack acquisition failure never blocks canonical publication", async () => {
  const original = JSON.stringify({
    snapshot_type: "daily_brief",
    payload: { contractVersion: 2 },
  });
  const init = await enrichDailyBriefSnapshotWrite("hybrid_publication_snapshots", {
    method: "POST",
    body: original,
  }, async () => null);
  assert.equal(init.body, original);
});
