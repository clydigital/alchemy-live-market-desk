import test from "node:test";
import assert from "node:assert/strict";

import {
  MARKET_MOTION_PROMOTION_LIMIT,
  MARKET_MOTION_PROMOTION_MIN_MATERIALITY,
  MARKET_MOTION_PROMOTION_MIN_RELEVANCE,
  marketMotionPromotionInput,
  selectPromotableMarketMotion,
  selectPromotedMarketMotionForDossier,
} from "../lib/market-motion-promotion.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

const NOW = new Date("2026-10-01T02:00:00Z");

function record(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "motion-1",
    motion_key: "event:hbm:micron",
    version_number: 1,
    previous_version_id: null,
    contract_version: "market-motion/v1",
    research_run_id: "run-creator",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story-1",
    primary_regime_slug: "us-china-ai",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    category: "COMPANY",
    verification_state: "LEAD",
    headline: "Micron HBM pricing stays tight",
    what_happened: "A creator surfaced a claim about HBM supply.",
    market_reaction: null,
    why_interesting: "The event tests the AI memory scarcity branch of the existing Story.",
    big_picture_bridge: "Memory supply → AI infrastructure cost → US–China AI regime",
    next_test: "Confirm with company or primary supply evidence.",
    promotion_reason: null,
    tickers: ["MU"],
    source_name: "StockedUp",
    source_url: "https://www.youtube.com/watch?v=example",
    source_kind: "creator",
    materiality: 88,
    relevance: 90,
    novelty: 84,
    occurred_at: "2026-10-01T00:30:00.000Z",
    observed_at: "2026-10-01T00:45:00.000Z",
    expires_at: "2026-10-04T00:45:00.000Z",
    metadata: {
      itemKey: "youtube:stockedup:mu-hbm",
      originItemKeys: ["youtube:stockedup:mu-hbm", "reuters:mu-hbm"],
    },
    created_at: "2026-10-01T00:45:00.000Z",
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id: "evidence-reporting",
    claim: "Independent reporting corroborates the event.",
    summary: null,
    evidenceClass: "news",
    sourceName: "Reuters",
    sourceTier: 2,
    reliabilityScore: 92,
    ancestryGroupId: "ancestry-reuters",
    supportDirection: "context",
    eventAt: "2026-10-01T00:40:00.000Z",
    publishedAt: "2026-10-01T00:40:00.000Z",
    availableAt: "2026-10-01T00:40:00.000Z",
    receivedAt: "2026-10-01T00:41:00.000Z",
    freshnessStatus: "current",
    affectedAssets: ["MU"],
    affectedTopics: ["china-us-ai-war"],
    provenanceUrls: ["https://www.reuters.com/technology/example"],
    providerKey: "research_intake",
    sourceVerificationRole: "canonical",
    structuredPayload: { itemKey: "reuters:mu-hbm" },
    ...overrides,
  };
}

test("B1 promotion requires exact eligible canonical Evidence, not Story publication", () => {
  assert.equal(MARKET_MOTION_PROMOTION_MIN_MATERIALITY, 80);
  assert.equal(MARKET_MOTION_PROMOTION_MIN_RELEVANCE, 75);

  const selected = selectPromotableMarketMotion([record()], [evidence()], NOW);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].motion.id, "motion-1");
  assert.equal(selected[0].selectedEvidence.id, "evidence-reporting");
  assert.deepEqual(selected[0].matchingOriginItemKeys, ["reuters:mu-hbm"]);
});

test("B1 allows LEAD Motion after later independent canonical corroboration", () => {
  const selected = selectPromotableMarketMotion([
    record({ verification_state: "LEAD" }),
  ], [
    evidence({ id: "independent-report" }),
  ], NOW);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].motion.verification_state, "LEAD");
  assert.equal(selected[0].selectedEvidence.id, "independent-report");
});

test("B1 blocks contradicted unresolved partial expired weak and no-Story Motion", () => {
  const rows = [
    record({ id: "contradicted", verification_state: "CONTRADICTED" }),
    record({ id: "unresolved", verification_state: "UNRESOLVED" }),
    record({ id: "partial", verification_state: "PARTIAL" }),
    record({ id: "expired", expires_at: "2026-10-01T01:00:00Z" }),
    record({ id: "weak-materiality", materiality: 79 }),
    record({ id: "weak-relevance", relevance: 74 }),
    record({ id: "no-story", primary_story_id: null }),
    record({ id: "already", lifecycle_state: "PROMOTED", effective_state: "PROMOTED" }),
  ];

  assert.deepEqual(selectPromotableMarketMotion(rows, [evidence()], NOW), []);
});

test("B1 rejects transcript scheduled research-analysis and discovery-only Evidence", () => {
  const rows = [record()];
  const blocked = [
    evidence({ id: "transcript", evidenceClass: "transcript" }),
    evidence({ id: "scheduled", structuredPayload: { itemKey: "reuters:mu-hbm", evidenceNature: "scheduled_event" } }),
    evidence({ id: "analysis", evidenceClass: "research_analysis" }),
    evidence({ id: "discovery", sourceVerificationRole: "discovery_only" }),
  ];

  assert.deepEqual(selectPromotableMarketMotion(rows, blocked, NOW), []);
});

test("B1 rejects same Story Regime ticker or headline without exact origin item overlap", () => {
  const unrelated = evidence({
    id: "same-context-wrong-origin",
    structuredPayload: { itemKey: "reuters:different-event" },
    affectedAssets: ["MU"],
    affectedTopics: ["china-us-ai-war"],
    claim: "Micron HBM pricing stays tight",
  });

  assert.deepEqual(selectPromotableMarketMotion([record()], [unrelated], NOW), []);
});

test("B1 chooses strongest canonical corroborator deterministically", () => {
  const reporting = evidence({
    id: "z-reporting",
    structuredPayload: { itemKey: "reuters:mu-hbm" },
    sourceTier: 2,
    reliabilityScore: 92,
  });
  const official = evidence({
    id: "a-official",
    sourceName: "SEC",
    provenanceUrls: ["https://www.sec.gov/example"],
    structuredPayload: { itemKey: "sec:mu-hbm" },
    sourceTier: 1,
    reliabilityScore: 98,
    availableAt: "2026-10-01T00:35:00.000Z",
  });
  const motion = record({
    metadata: {
      originItemKeys: ["youtube:stockedup:mu-hbm", "reuters:mu-hbm", "sec:mu-hbm"],
    },
  });

  const [selected] = selectPromotableMarketMotion([motion], [reporting, official], NOW);

  assert.equal(selected.selectedEvidence.id, "a-official");
  assert.deepEqual(selected.matchingEvidenceIds, ["a-official", "z-reporting"]);
  assert.deepEqual(selected.matchingOriginItemKeys, ["sec:mu-hbm", "reuters:mu-hbm"]);
});

test("B1 promotion remains capped at six Motion items", () => {
  const rows = Array.from({ length: MARKET_MOTION_PROMOTION_LIMIT + 3 }, (_, index) => record({
    id: `motion-${index}`,
    motion_key: `event:test:${index}`,
    materiality: 80 + index,
    relevance: 80 + index,
    metadata: { originItemKeys: [`reporting:item-${index}`] },
  }));
  const evidenceRows = rows.map((row, index) => evidence({
    id: `evidence-${index}`,
    structuredPayload: { itemKey: `reporting:item-${index}` },
  }));

  const selected = selectPromotableMarketMotion(rows, evidenceRows, NOW);

  assert.equal(selected.length, MARKET_MOTION_PROMOTION_LIMIT);
  assert.equal(selected[0].motion.id, `motion-${MARKET_MOTION_PROMOTION_LIMIT + 2}`);
});

test("promotion persists canonical Evidence identity while preserving Motion verification and expiry", () => {
  const candidate = {
    motion: record(),
    selectedEvidence: evidence(),
    matchingEvidenceIds: ["evidence-reporting"],
    matchingOriginItemKeys: ["reuters:mu-hbm"],
    evidenceWeight: 0.782,
  };

  const input = marketMotionPromotionInput(candidate, {
    researchRunId: "run-reporting",
    engineRunId: "engine-1",
  });

  assert.equal(input.lifecycleState, "PROMOTED");
  assert.equal(input.verificationState, "LEAD");
  assert.equal(input.evidenceId, "evidence-reporting");
  assert.equal(input.primaryStoryId, "story-1");
  assert.equal(input.primaryRegimeSlug, "us-china-ai");
  assert.equal(input.expiresAt, "2026-10-04T00:45:00.000Z");
  assert.match(input.promotionReason || "", /Canonical Evidence evidence-reporting corroborated/);
  assert.match(input.promotionReason || "", /Motion is promoted as short-horizon Dossier context, not as canonical evidence/);
  assert.equal(input.metadata?.promotionPolicy, "canonical-evidence-corroborated/v1");
  assert.equal(input.metadata?.promotionEvidenceId, "evidence-reporting");
  assert.equal(input.metadata?.promotionEvidenceItemKey, "reuters:mu-hbm");
  assert.deepEqual(input.metadata?.promotionEvidenceIds, ["evidence-reporting"]);
  assert.deepEqual(input.metadata?.promotionEvidenceItemKeys, ["reuters:mu-hbm"]);
});

test("Dossier selector admits only fresh PROMOTED Motion with an exact canonical Story link", () => {
  const rows = [
    record({ id: "promoted", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", materiality: 92 }),
    record({ id: "plain-motion", lifecycle_state: "MOTION", effective_state: "MOTION", materiality: 99 }),
    record({ id: "other-story", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", primary_story_id: "story-2", materiality: 89 }),
    record({ id: "no-story", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", primary_story_id: null, materiality: 99 }),
    record({ id: "expired", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", expires_at: "2026-10-01T01:00:00Z" }),
  ];

  assert.deepEqual(
    selectPromotedMarketMotionForDossier(rows, NOW).map((item) => item.id),
    ["promoted", "other-story"],
  );
});
