import assert from "node:assert/strict";
import test from "node:test";

import {
  POWER_STACK_FUNDAMENTALS_IMPORT_V1,
  POWER_STACK_FUNDAMENTALS_V1,
  enrichDailyBriefSnapshotWrite,
  parsePowerStackFundamentalsSnapshot,
  type FrozenPowerStackFundamentalsImport,
} from "../lib/power-stack-ratings.ts";

const snapshot = {
  contractVersion: POWER_STACK_FUNDAMENTALS_V1,
  snapshotAt: "2026-09-25T07:45:00Z",
  sourceCommit: "7449dc8387d8b83f161e8397c39563a0a1250806",
  companies: [{
    ticker: "DELL",
    name: "Dell Technologies",
    market: "NYSE",
    region: "US / Global",
    themeGroup: "AI Infrastructure / Systems",
    theme: "AI servers + enterprise infrastructure integration",
    baseConviction: 8.6,
    status: "Priority research / systems integrator",
    thesis: "AI demand is large, with margin and working-capital constraints.",
    catalysts: "Backlog conversion and margin/FCF conversion.",
    risks: "Low-margin mix, component constraints and working-capital swings.",
    qualityProfile: {
      aiRisk: 2,
      themeDependency: 3,
      cyclicality: 3,
      speculation: 1,
    },
    lastUpdated: "2026-09-03",
  }],
  sourceFiles: ["data/market-extension-3-2026-09-03.json"],
  guardrails: [
    "This packet contains Power Stack-owned company research only.",
    "It excludes Live-derived macro adjustments.",
  ],
};

const imported: FrozenPowerStackFundamentalsImport = {
  contractVersion: POWER_STACK_FUNDAMENTALS_IMPORT_V1,
  importedAt: "2026-09-25T08:00:00Z",
  sourceSnapshotAt: snapshot.snapshotAt,
  sourceCommit: snapshot.sourceCommit,
  companies: snapshot.companies,
  sourceFiles: snapshot.sourceFiles,
  guardrails: snapshot.guardrails,
  sourceUrl: "https://example.test/power-stack.json",
};

test("validates independent Power Stack fundamentals without macro-derived fields", () => {
  const parsed = parsePowerStackFundamentalsSnapshot(snapshot);
  assert.ok(parsed);
  assert.equal(parsed.companies[0].ticker, "DELL");
  assert.equal(parsed.companies[0].baseConviction, 8.6);
  assert.equal(parsed.companies[0].qualityProfile.cyclicality, 3);
  assert.equal("macroAdjustment" in parsed.companies[0], false);
  assert.equal("adjustedScore" in parsed.companies[0], false);
});

test("rejects legacy macro-adjusted exports and malformed fundamentals", () => {
  assert.equal(parsePowerStackFundamentalsSnapshot({ ...snapshot, contractVersion: "power-stack-rating-snapshot/v1" }), null);
  assert.equal(parsePowerStackFundamentalsSnapshot({
    ...snapshot,
    companies: [{ ...snapshot.companies[0], baseConviction: 12 }],
  }), null);
});

test("freezes the imported fundamentals packet into an immutable daily-brief payload", async () => {
  const init = await enrichDailyBriefSnapshotWrite("hybrid_publication_snapshots", {
    method: "POST",
    body: JSON.stringify({
      snapshot_type: "daily_brief",
      payload: { contractVersion: 2, canonicalStoryManifest: [] },
    }),
  }, async () => imported);
  const body = JSON.parse(String(init.body));
  assert.deepEqual(body.payload.powerStackFundamentals, imported);
  assert.equal(body.payload.powerStackFundamentals.companies[0].baseConviction, 8.6);
  assert.equal(body.payload.powerStackRatings, undefined);
});

test("does not recalculate or replace a fundamentals packet already frozen in an edition", async () => {
  let loads = 0;
  const existing = { ...imported, sourceCommit: "historical-commit" };
  const init = await enrichDailyBriefSnapshotWrite("hybrid_publication_snapshots", {
    method: "POST",
    body: JSON.stringify({
      snapshot_type: "daily_brief",
      payload: { contractVersion: 2, powerStackFundamentals: existing },
    }),
  }, async () => {
    loads += 1;
    return imported;
  });
  assert.equal(loads, 0);
  assert.deepEqual(JSON.parse(String(init.body)).payload.powerStackFundamentals, existing);
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
