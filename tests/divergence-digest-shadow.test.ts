import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDivergenceDigestShadow } from "../lib/intelligence/divergence-digest-shadow.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

function evidence(id: string, overrides: Partial<EvidencePackItem> = {}): EvidencePackItem {
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

test("divergence digest shadow always retains exact Market Belief evidence", () => {
  const universe = [evidence("a"), evidence("b"), evidence("c")];
  const shadow = buildDivergenceDigestShadow({
    beliefs: [{ evidence_ids: ["a", "c"], affected_assets: [] }],
    evidence: universe,
  });

  assert.deepEqual(shadow.evidenceIds, ["a", "c"]);
  assert.equal(shadow.anchorEvidenceCount, 2);
  assert.equal(shadow.sourceEvidenceCount, 3);
});

test("divergence digest shadow adds affected-asset and anchor-topic context", () => {
  const universe = [
    evidence("anchor", { affectedAssets: ["SPY"], affectedTopics: ["rates"] }),
    evidence("asset-context", { affectedAssets: ["SPY"], affectedTopics: ["equities"] }),
    evidence("topic-context", { affectedAssets: ["TLT"], affectedTopics: ["rates"] }),
    evidence("unrelated", { affectedAssets: ["USO"], affectedTopics: ["oil"] }),
  ];
  const shadow = buildDivergenceDigestShadow({
    beliefs: [{ evidence_ids: ["anchor"], affected_assets: ["SPY"] }],
    evidence: universe,
  });

  assert.deepEqual(shadow.evidenceIds, ["anchor", "asset-context", "topic-context"]);
  assert.equal(shadow.assetContextCount, 1);
  assert.equal(shadow.topicContextCount, 1);
});

test("divergence digest shadow retains rates context linked to an anchor item", () => {
  const universe = [
    evidence("anchor", { structuredPayload: { itemKey: "news:anchor" } }),
    evidence("rates-linked", {
      evidenceClass: "macro_context",
      structuredPayload: { ratesContext: { triggerItemKeys: ["news:anchor"] } },
    }),
    evidence("rates-unrelated", {
      evidenceClass: "macro_context",
      structuredPayload: { ratesContext: { triggerItemKeys: ["news:other"] } },
    }),
  ];
  const shadow = buildDivergenceDigestShadow({
    beliefs: [{ evidence_ids: ["anchor"], affected_assets: [] }],
    evidence: universe,
  });

  assert.deepEqual(shadow.evidenceIds, ["anchor", "rates-linked"]);
  assert.equal(shadow.ratesContextCount, 1);
});

test("divergence digest shadow never treats the full universe as a fallback", () => {
  const shadow = buildDivergenceDigestShadow({
    beliefs: [{ evidence_ids: [], affected_assets: ["SPY"] }],
    evidence: [evidence("a", { affectedAssets: ["SPY"] }), evidence("b")],
  });

  assert.deepEqual(shadow.evidence, []);
  assert.equal(shadow.candidateEvidenceCount, 0);
});

test("divergence digest shadow bounds contextual expansion but never anchor evidence", () => {
  const anchors = Array.from({ length: 60 }, (_, i) => evidence(`anchor-${i}`));
  const assetContext = Array.from({ length: 80 }, (_, i) => evidence(`asset-${i}`, { affectedAssets: ["SPY"] }));
  const topicContext = Array.from({ length: 60 }, (_, i) => evidence(`topic-${i}`, { affectedTopics: ["rates"] }));
  anchors[0] = evidence("anchor-0", { affectedTopics: ["rates"] });

  const shadow = buildDivergenceDigestShadow({
    beliefs: [{ evidence_ids: anchors.map((item) => item.id), affected_assets: ["SPY"] }],
    evidence: [...anchors, ...assetContext, ...topicContext],
  });

  assert.equal(shadow.anchorEvidenceCount, 60);
  assert.equal(shadow.assetContextCount, 48);
  assert.equal(shadow.topicContextCount, 32);
  assert.equal(shadow.candidateEvidenceCount, 140);
});

test("provider boundary keeps Divergence full-context while logging the shadow digest", () => {
  const source = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");
  const divergenceStart = source.indexOf('if (stageKey === "divergence")');
  const downstreamStart = source.indexOf('if (stageKey !== "scenario" && stageKey !== "story_synthesis")', divergenceStart);
  const divergenceBlock = source.slice(divergenceStart, downstreamStart);

  assert.ok(divergenceStart >= 0);
  assert.match(divergenceBlock, /buildDivergenceDigestShadow/);
  assert.match(divergenceBlock, /event: "divergence_digest_shadow"/);
  assert.match(divergenceBlock, /return input;/);
  assert.doesNotMatch(divergenceBlock, /evidence:\s*shadow\.evidence/);
});
