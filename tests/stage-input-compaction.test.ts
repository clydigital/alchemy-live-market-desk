import assert from "node:assert/strict";
import test from "node:test";

import {
  compactEvidenceForModel,
  compactStoryReviewTargetsForModel,
  stageInputSize,
} from "../lib/intelligence/stage-input-compaction.ts";
import type {
  EvidencePackItem,
  StoryReviewTargetPackItem,
} from "../lib/intelligence/schemas.ts";

function evidence(overrides: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id: "ev-1",
    claim: "<p>" + "A".repeat(5_000) + "</p><p>TAIL-SIGNAL</p>",
    summary: "B".repeat(2_000),
    evidenceClass: "news_report",
    sourceName: "Source",
    sourceTier: 2,
    reliabilityScore: 88,
    ancestryGroupId: "group-1",
    supportDirection: "supporting",
    eventAt: "2026-09-26T08:00:00.000Z",
    publishedAt: "2026-09-26T08:01:00.000Z",
    availableAt: "2026-09-26T08:01:00.000Z",
    receivedAt: "2026-09-26T08:02:00.000Z",
    freshnessStatus: "current",
    affectedAssets: ["SPY", "US10Y"],
    affectedTopics: ["rates", "breadth"],
    provenanceUrls: ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
    providerKey: "research_intake",
    sourceVerificationRole: "canonical",
    structuredPayload: {
      title: "Test title",
      itemKey: "feed:test:1",
      materiality: 90,
      newsSignal: "Important signal",
      statsSignal: "10Y above threshold",
      candidateScore: 82,
      storyRouting: { huge: "X".repeat(20_000) },
      rawHtml: "Y".repeat(20_000),
      transcript: "Z".repeat(20_000),
      ratesContext: {
        triggerItemKeys: ["feed:test:1", "feed:test:2"],
        retrievedAt: "2026-09-26T08:03:00.000Z",
        rawPayload: "Q".repeat(20_000),
      },
    },
    ...overrides,
  };
}

test("model evidence projection preserves analytical identifiers while bounding verbose fields", () => {
  const original = evidence();
  const compact = compactEvidenceForModel(original);

  assert.equal(compact.id, original.id);
  assert.equal(compact.sourceTier, original.sourceTier);
  assert.deepEqual(compact.affectedAssets, original.affectedAssets);
  assert.deepEqual(compact.affectedTopics, original.affectedTopics);
  assert.equal(compact.eventAt, original.eventAt);
  assert.equal(compact.structuredPayload.itemKey, "feed:test:1");
  assert.equal(compact.structuredPayload.materiality, 90);
  assert.equal(compact.provenanceUrls.length, 2);

  assert.ok(compact.claim.length <= 1_800);
  assert.match(compact.claim, /TAIL-SIGNAL/);
  assert.ok((compact.summary?.length ?? 0) <= 700);
  assert.doesNotMatch(compact.claim, /<p>/);
  assert.equal("rawHtml" in compact.structuredPayload, false);
  assert.equal("transcript" in compact.structuredPayload, false);
  assert.equal("storyRouting" in compact.structuredPayload, false);

  const rates = compact.structuredPayload.ratesContext as {
    triggerItemKeys?: string[];
    retrievedAt?: string;
    rawPayload?: string;
  };
  assert.deepEqual(rates.triggerItemKeys, ["feed:test:1", "feed:test:2"]);
  assert.equal(rates.retrievedAt, "2026-09-26T08:03:00.000Z");
  assert.equal(rates.rawPayload, undefined);

  assert.ok(stageInputSize(compact) < stageInputSize(original) * 0.2);
});

test("Story review projection preserves Story/review context and compacts only evidence payloads", () => {
  const target: StoryReviewTargetPackItem = {
    story: {
      id: "story-1",
      slug: "rates-story",
      title: "Rates Story",
      thesis: "Rates remain restrictive.",
      status: "publish",
      confidence: 80,
      marketQuestion: "Does rates pressure broaden?",
      dominantNarrative: "Rates stay high.",
      strongestSupport: "Yields remain elevated.",
      strongestContradiction: "Credit remains contained.",
      confirmationTrigger: "Yields stay high.",
      invalidationTrigger: "Yields fall.",
      nextCatalyst: "CPI",
      assets: ["US10Y"],
    },
    reason: "contradictory_evidence",
    reasonRank: 4,
    reasons: ["contradictory_evidence"],
    queueIds: ["queue-1"],
    relevantEvidence: [evidence()],
    selectedAt: "2026-09-26T09:00:00.000Z",
    reviewContext: {
      queueReasons: ["refresh"],
      researchDebt: [],
      dueCatalysts: ["CPI"],
      triggerEvidenceIds: ["ev-1"],
      catalystCandidates: [{ label: "CPI", catalystRef: null }],
    },
  };

  const [compact] = compactStoryReviewTargetsForModel([target]);
  assert.equal(compact.story.id, "story-1");
  assert.equal(compact.reason, "contradictory_evidence");
  assert.deepEqual(compact.reviewContext, target.reviewContext);
  assert.equal(compact.relevantEvidence[0].id, "ev-1");
  assert.ok(
    stageInputSize(compact.relevantEvidence[0]) <
      stageInputSize(target.relevantEvidence[0]),
  );
});
