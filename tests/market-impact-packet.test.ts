import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketImpactPacketsV1, MARKET_IMPACT_PACKET_V1 } from "../lib/market-impact-packet.ts";

const asOf = "2026-10-20T16:19:12.015Z";
const storyId = "6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const snapshotId = "01234567-1234-4abc-9999-012345678901";
const thesisVersionId = "861cb4cb-f23f-4747-b105-39e363c71a8d";
const evidenceId = "c3776638-d2cb-40e1-acf7-36850d992edc";
const lesson = {
  storyId, publicationSnapshotId: snapshotId, thesisVersionId,
  title: "AI orders are strong while cash conversion remains uncertain",
  body: [
    "Story established in detected state. This is a research-process note, not client copy.",
    "Chip demand supports upstream suppliers while capex financing remains a conditional risk.",
  ],
  evidenceRefs: [evidenceId],
  currentAttention: { state: "recent_context", assessedAt: "2026-10-20T15:00:00Z" },
  causeEffect: [],
  callouts: [
    { type: "why_traders_care", text: "TSM: Higher chip demand can support earnings; CRWV: Debt servicing creates refinancing sensitivity" },
    { type: "warning", text: "The next operator cash flow may exceed expectations." },
  ],
  watchItems: [{ variable: "Next TSMC guidance", why: "Tests sustainable orders" }],
};
const reasoning = {
  contractVersion: "canonical-story-reasoning/v1",
  storyId, storyVersionId: thesisVersionId,
  effectiveAt: "2026-10-19T14:01:47Z",
  whatChanged: "TSMC reported strong orders.",
  acceptedExplanation: "Orders improve foundry utilisation.",
  marketReaction: "Nasdaq rallied after the release.",
  claims: [
    { type: "fact", text: "TSMC reported strong orders.", evidenceIds: [evidenceId] },
    { type: "interpretation", text: "Orders improve foundry utilisation.", evidenceIds: [evidenceId] },
  ],
  assetImplications: [
    { asset: "TSM", baseCase: "Earnings sensitivity to sustained accelerator orders",
      evidenceIds: [evidenceId] },
    { asset: "NDX", baseCase: "Potential read-through if broader earnings respond",
      evidenceIds: [] },
  ],
  countercase: { strongest: "Customer capex may not convert into free cash flow." },
  nextTest: { label: "Next quarterly earnings" },
};
const manifest = [{ storyId, thesisVersionId, snapshotId, reasoning }];
const motion = {
  id: "10234567-1234-4abc-9999-012345678901",
  storyId, headline: "Issuer publishes spending outlook",
  whatHappened: "The issuer reported its next quarter investment plans.",
  sourceName: "Issuer",
  sourceUrl: "https://example.com/investor/earnings-2026",
  sourceKind: "primary",
  verificationState: "VERIFIED",
  occurredAt: "2026-10-20T12:00:00Z",
  observedAt: "2026-10-20T13:00:00Z",
  tickers: ["TSM", "NDX"],
  marketReaction: "NASDAQ rose 3%", // insufficient market-price provenance
  bigPictureBridge: "Possible semiconductor demand read-through",
  nextTest: "Compare dated sector returns",
};

test("exact immutable Story keeps claim-level evidence and conditional assets separate from tape", () => {
  const [p] = buildMarketImpactPacketsV1({ payload: {
    dossier: { lessons: [lesson] },
    canonicalStoryManifest: manifest,
    stories: [{ id: storyId }],
  }, asOf });
  assert.equal(p.contractVersion, MARKET_IMPACT_PACKET_V1);
  assert.equal(p.identity.lineage, "EXACT_EDITION_MANIFEST");
  assert.equal(p.identity.storyThesisVersionId, thesisVersionId);
  assert.equal(p.development.text, "TSMC reported strong orders.");
  assert.deepEqual(p.development.evidenceIds, [evidenceId]);
  assert.equal(p.mechanism.evidenceState, "CANONICAL_INTERPRETATION");
  assert.deepEqual(p.mechanism.evidenceIds, [evidenceId]);
  assert.deepEqual(p.assetReadThroughs.map(a => a.asset), ["TSM", "NDX"]);
  assert.deepEqual(p.assetReadThroughs[1].evidenceIds, []);
  assert.equal(p.materialChangeAt, "2026-10-19T14:01:47.000Z");
  assert.equal(p.observedReaction, null);
  assert.equal(p.reactionCandidate, "Nasdaq rallied after the release.");
  assert.ok(p.missing.includes("ORIGINAL_SOURCE_LINK"));
  assert.ok(p.missing.includes("MEASURED_MARKET_REACTION"));
});

test("quiet zero-manifest edition retains frozen versioned Dossier context without inventing freshness", () => {
  const [p] = buildMarketImpactPacketsV1({ payload: {
    dossier: { lessons: [lesson] },
    canonicalStoryManifest: [],
    stories: [],
  }, asOf });
  assert.equal(p.identity.lineage, "FROZEN_DOSSIER_CONTEXT");
  assert.equal(p.sourceVersionEffectiveAt, null);
  assert.equal(p.attentionAssessedAt, "2026-10-20T15:00:00.000Z");
  assert.equal(p.materialChangeAt, null);
  assert.equal(p.development.text, null);
  assert.equal(p.development.basis, "FROZEN_DOSSIER_CONTEXT");
  assert.deepEqual(p.development.evidenceIds, []);
  assert.deepEqual(p.assetReadThroughs.map(a => a.asset), ["TSM", "CRWV"]);
  assert.ok(p.assetReadThroughs.every(a => a.kind === "LESSON_CONTEXT" && !a.evidenceIds.length));
  assert.ok(p.missing.includes("CURRENT_VERIFIED_FACT"));
  assert.ok(p.missing.includes("CANONICAL_STORY_LINEAGE"));
  assert.ok(p.background[0].includes("detected state"));
});

test("Story cannot borrow an unrelated or later thesis version from this edition", () => {
  const wrong = { ...manifest[0], thesisVersionId: "abc34567-1234-4abc-9999-012345678901" };
  const later = { ...manifest[0], reasoning: { ...reasoning, effectiveAt: "2026-10-21T20:00:00Z" } };
  for (const entry of [wrong, later]) {
    const [p] = buildMarketImpactPacketsV1({ payload: {
      dossier: { lessons: [lesson] }, canonicalStoryManifest: [entry], stories: [{ id: storyId }],
    }, asOf });
    assert.equal(p.identity.lineage, "FROZEN_DOSSIER_CONTEXT");
    assert.equal(p.development.text, null);
    assert.equal(p.materialChangeAt, null);
    assert.deepEqual(p.development.evidenceIds, []);
  }
});

test("verified Motion gets a dated factual source but no canonical Story or observed reaction", () => {
  const [p] = buildMarketImpactPacketsV1({ payload: {
    dossier: { lessons: [] },
    marketMotion: { contractVersion: "market-motion-edition/v1", items: [motion] },
  }, asOf });
  assert.equal(p.kind, "MOTION");
  assert.equal(p.identity.lineage, "VERIFIED_MOTION_ONLY");
  assert.equal(p.identity.storyThesisVersionId, null);
  assert.equal(p.development.basis, "SOURCE_VERIFIED_MOTION");
  assert.equal(p.development.sourceUrl, motion.sourceUrl);
  assert.equal(p.materialChangeAt, null);
  assert.deepEqual(p.sourceUrls, [motion.sourceUrl]);
  assert.equal(p.observedReaction, null);
  assert.equal(p.reactionCandidate, "NASDAQ rose 3%");
  assert.deepEqual(p.assetReadThroughs.map(a => a.asset), ["TSM", "NDX"]);
  assert.ok(p.assetReadThroughs.every(a => a.kind === "MOTION_CONTEXT"));
});

test("leads, future reports and homepage-only URLs cannot be published as verified Motion", () => {
  const invalid = [
    { ...motion, verificationState: "LEAD" },
    { ...motion, sourceKind: "creator" },
    { ...motion, sourceUrl: "https://example.com/" },
    { ...motion, observedAt: "2026-10-21T22:00:00Z" },
    { ...motion, observedAt: "2026-10-19T00:00:00Z" },
  ];
  const packets = buildMarketImpactPacketsV1({ payload: {
    marketMotion: { contractVersion: "market-motion-edition/v1", items: invalid },
  }, asOf });
  assert.deepEqual(packets, []);
});

test("unsupported timestamp and missing frozen Story identities produce no packet", () => {
  assert.deepEqual(buildMarketImpactPacketsV1({ payload: { dossier: { lessons: [lesson] } }, asOf: "not a date" }), []);
  assert.deepEqual(buildMarketImpactPacketsV1({ payload: {
    dossier: { lessons: [{ ...lesson, thesisVersionId: null }] },
  }, asOf }), []);
});
