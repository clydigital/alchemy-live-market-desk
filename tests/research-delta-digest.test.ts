import assert from "node:assert/strict";
import test from "node:test";

import { buildResearchDeltaDigest } from "../lib/intelligence/research-delta-digest.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

function evidence(
  id: string,
  overrides: Partial<EvidencePackItem> = {},
): EvidencePackItem {
  return {
    id,
    claim: `Claim ${id}`,
    summary: null,
    evidenceClass: "news",
    sourceName: "Test",
    sourceTier: 2,
    reliabilityScore: 80,
    ancestryGroupId: `group-${id}`,
    supportDirection: "supports",
    eventAt: "2026-09-10T00:00:00.000Z",
    publishedAt: "2026-09-10T00:00:00.000Z",
    availableAt: "2026-09-10T00:00:00.000Z",
    receivedAt: "2026-09-10T00:00:00.000Z",
    freshnessStatus: "fresh",
    affectedAssets: [],
    affectedTopics: [],
    provenanceUrls: [`https://example.com/${id}`],
    structuredPayload: {},
    ...overrides,
  };
}

test("research delta digest keeps exact Hypothesis and Scenario evidence references", () => {
  const universe = [evidence("a"), evidence("b"), evidence("c"), evidence("d")];
  const digest = buildResearchDeltaDigest({
    evidence: universe,
    hypotheses: [{
      evidence_for_ids: ["a"],
      evidence_against_ids: ["b"],
      causal_chain: [{ evidenceIds: ["c"] }],
      affected_assets: [],
    }],
    scenarios: [{ explanatory_evidence_ids: ["d"] }],
  });

  assert.deepEqual(digest.evidenceIds, ["a", "b", "c", "d"]);
  assert.equal(digest.referencedEvidenceCount, 4);
  assert.equal(digest.sourceEvidenceCount, 4);
});

test("research delta digest never falls back to the full evidence universe", () => {
  const digest = buildResearchDeltaDigest({
    evidence: [evidence("a"), evidence("b")],
    hypotheses: [{ evidence_for_ids: [], evidence_against_ids: [], affected_assets: ["SPY"] }],
  });

  assert.deepEqual(digest.evidence, []);
  assert.equal(digest.referencedEvidenceCount, 0);
  assert.equal(digest.selectedEvidenceCount, 0);
});

test("research delta digest retains bounded direct-market context for affected assets", () => {
  const universe = [
    evidence("thesis", { affectedAssets: ["SPY"] }),
    evidence("spy-market", { evidenceClass: "market_observation", affectedAssets: ["SPY"] }),
    evidence("oil-market", { evidenceClass: "market_observation", affectedAssets: ["USO"] }),
  ];
  const digest = buildResearchDeltaDigest({
    evidence: universe,
    hypotheses: [{ evidence_for_ids: ["thesis"], evidence_against_ids: [], affected_assets: ["SPY"] }],
  });

  assert.deepEqual(digest.evidenceIds, ["thesis", "spy-market"]);
});

test("research delta digest retains rates context linked to a cited trigger item", () => {
  const universe = [
    evidence("trigger", { structuredPayload: { itemKey: "news:trigger" } }),
    evidence("rates-linked", {
      evidenceClass: "macro_context",
      structuredPayload: { ratesContext: { triggerItemKeys: ["news:trigger"] } },
    }),
    evidence("rates-unrelated", {
      evidenceClass: "macro_context",
      structuredPayload: { ratesContext: { triggerItemKeys: ["news:other"] } },
    }),
  ];
  const digest = buildResearchDeltaDigest({
    evidence: universe,
    hypotheses: [{ evidence_for_ids: ["trigger"], evidence_against_ids: [], affected_assets: [] }],
  });

  assert.deepEqual(digest.evidenceIds, ["trigger", "rates-linked"]);
});
