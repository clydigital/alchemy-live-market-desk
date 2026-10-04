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
    motion_key: "intake:motion-1",
    version_number: 1,
    previous_version_id: null,
    contract_version: "market-motion/v1",
    research_run_id: "run-1",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story-1",
    primary_regime_slug: "us-china-ai",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    category: "COMPANY",
    verification_state: "REPORTED",
    headline: "Micron HBM pricing stays tight",
    what_happened: "Fresh reporting says HBM demand remains strong while supply stays constrained.",
    market_reaction: null,
    why_interesting: "The event tests the AI memory scarcity branch of the existing Story.",
    big_picture_bridge: "Memory supply → AI infrastructure cost → US–China AI regime",
    next_test: "Confirm with company or primary supply evidence.",
    promotion_reason: null,
    tickers: ["MU"],
    source_name: "Reuters",
    source_url: "https://www.reuters.com/technology/example",
    source_kind: "reporting",
    materiality: 88,
    relevance: 90,
    novelty: 84,
    occurred_at: "2026-10-01T00:30:00.000Z",
    observed_at: "2026-10-01T00:45:00.000Z",
    expires_at: "2026-10-04T00:45:00.000Z",
    metadata: { itemKey: "motion-1" },
    created_at: "2026-10-01T00:45:00.000Z",
    ...overrides,
  };
}

test("promotion requires exact canonical Story publication plus stronger Motion thresholds", () => {
  assert.equal(MARKET_MOTION_PROMOTION_MIN_MATERIALITY, 80);
  assert.equal(MARKET_MOTION_PROMOTION_MIN_RELEVANCE, 75);

  const selected = selectPromotableMarketMotion([
    record({ id: "eligible" }),
    record({ id: "wrong-story", primary_story_id: "story-2" }),
    record({ id: "weak-materiality", materiality: 79 }),
    record({ id: "weak-relevance", relevance: 74 }),
    record({ id: "lead", verification_state: "LEAD" }),
    record({ id: "expired", expires_at: "2026-10-01T01:00:00Z" }),
    record({ id: "already", lifecycle_state: "PROMOTED", effective_state: "PROMOTED" }),
  ], ["story-1"], NOW);

  assert.deepEqual(selected.map((item) => item.id), ["eligible"]);
});

test("promotion preserves verification and expiry while appending PROMOTED lifecycle", () => {
  const input = marketMotionPromotionInput(record(), {
    researchRunId: "run-1",
    engineRunId: "engine-1",
  });

  assert.equal(input.lifecycleState, "PROMOTED");
  assert.equal(input.verificationState, "REPORTED");
  assert.equal(input.primaryStoryId, "story-1");
  assert.equal(input.primaryRegimeSlug, "us-china-ai");
  assert.equal(input.expiresAt, "2026-10-04T00:45:00.000Z");
  assert.match(input.promotionReason || "", /Canonical Story story-1 changed/);
  assert.equal(input.metadata?.promotionPolicy, "canonical-story-changed/v1");
  assert.equal(input.metadata?.promotedFromMotionId, "motion-1");
});

test("promotion remains bounded and prioritises verified, material Motion", () => {
  const rows = Array.from({ length: MARKET_MOTION_PROMOTION_LIMIT + 3 }, (_, index) => record({
    id: `motion-${index}`,
    motion_key: `intake:motion-${index}`,
    verification_state: index === 0 ? "VERIFIED" : "REPORTED",
    materiality: 80 + index,
    relevance: 80 + index,
  }));

  const selected = selectPromotableMarketMotion(rows, ["story-1"], NOW);

  assert.equal(selected.length, MARKET_MOTION_PROMOTION_LIMIT);
  assert.equal(selected[0].id, "motion-0");
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
  const rows = [
    record({
      id: "motion-corroborated",
      verification_state: "LEAD",
      metadata: {
        originItemKeys: ["youtube:stockedup:mu-hbm", "reuters:mu-hbm"],
      },
    }),
  ];

  const selected = selectPromotableMarketMotion(
    rows,
    [evidence()],
    NOW,
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0].motion.id, "motion-corroborated");
  assert.equal(selected[0].selectedEvidence.id, "evidence-reporting");
});
