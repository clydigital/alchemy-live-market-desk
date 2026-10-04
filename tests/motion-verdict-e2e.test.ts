import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import {
  selectDossierMotionActivations,
  type DossierDeltaContext,
  type DossierMotionActivation,
} from "../lib/dossier-v2/delta-gate.ts";
import { buildResearchBrainMotionAttention } from "../lib/dossier-v2/execution.ts";
import type { DossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import type { ResearchBrainMotionAssessment } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  marketMotionInvestigationEligibility,
  type MarketMotionRecord,
} from "../lib/market-motion.ts";
import {
  marketMotionDossierPromotionInput,
  selectDossierAcceptedPromotableMarketMotion,
} from "../lib/market-motion-promotion.ts";
import { buildMarketMotionEditionAttachment } from "../lib/market-motion-edition.ts";
import { buildResearchGapWorkQueue } from "../lib/research-gap-worker.ts";

const NOW = new Date("2026-10-01T02:00:00.000Z");
const PACKET_EVIDENCE_ID = "ev:motion:canonical";

function packet(): DossierV2InputPacket {
  return {
    as_of: NOW.toISOString(),
    observed_evidence: [{
      evidence_id: PACKET_EVIDENCE_ID,
      available_at: "2026-10-01T01:15:00.000Z",
      claim_or_fact: "Canonical evidence supporting the Motion test.",
      category: "RATES",
      source_type: "OFFICIAL_DATA",
      provenance: [{
        source_type: "OFFICIAL_DATA",
        source_id: "official:motion",
        publisher: "Official Source",
      }],
    }],
  } as unknown as DossierV2InputPacket;
}

function activation(
  overrides: Partial<DossierMotionActivation> = {},
): DossierMotionActivation {
  return {
    id: "motion-1",
    evidence_id: null,
    research_run_id: "run-1",
    packet_evidence_id: PACKET_EVIDENCE_ID,
    primary_story_id: "story-rates",
    primary_regime_slug: "global-cost-of-capital",
    lifecycle_state: "MOTION",
    verification_state: "VERIFIED",
    headline: "Long-end yields remain elevated after softer inflation evidence",
    what_happened: "The long end stayed firm after softer inflation evidence.",
    market_reaction: "US10Y and US30Y remained elevated.",
    why_interesting: "Tests whether long-end pressure is broader than inflation alone.",
    big_picture_bridge: "Long-end yields -> financing costs -> valuation sensitivity.",
    next_test: "Separate real yields, supply and term premium.",
    materiality: 94,
    relevance: 95,
    novelty: 84,
    occurred_at: "2026-10-01T01:00:00.000Z",
    observed_at: "2026-10-01T01:20:00.000Z",
    expires_at: "2026-10-03T01:20:00.000Z",
    metadata: { itemKey: "motion-1" },
    ...overrides,
  };
}

function context(item = activation()): DossierDeltaContext {
  return {
    available: true,
    states: [],
    stories: [],
    motionActivations: [item],
    warning: null,
  };
}

function motionRecord(
  overrides: Partial<MarketMotionRecord> = {},
): MarketMotionRecord {
  return {
    id: "motion-1",
    motion_key: "event:rates:long-end",
    version_number: 1,
    previous_version_id: null,
    contract_version: "market-motion/v1",
    research_run_id: "run-1",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story-rates",
    primary_regime_slug: "global-cost-of-capital",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    category: "MACRO",
    verification_state: "VERIFIED",
    headline: "Long-end yields remain elevated after softer inflation evidence",
    what_happened: "The long end stayed firm after softer inflation evidence.",
    market_reaction: "US10Y and US30Y remained elevated.",
    why_interesting: "Tests whether long-end pressure is broader than inflation alone.",
    big_picture_bridge: "Long-end yields -> financing costs -> valuation sensitivity.",
    next_test: "Separate real yields, supply and term premium.",
    promotion_reason: null,
    tickers: ["US10Y", "US30Y"],
    source_name: "Official Source",
    source_url: "https://example.com/motion",
    source_kind: "official",
    materiality: 94,
    relevance: 95,
    novelty: 84,
    occurred_at: "2026-10-01T01:00:00.000Z",
    observed_at: "2026-10-01T01:20:00.000Z",
    expires_at: "2026-10-03T01:20:00.000Z",
    metadata: { itemKey: "motion-1" },
    created_at: "2026-10-01T01:20:00.000Z",
    ...overrides,
  };
}

function assessment(
  decision: ResearchBrainMotionAssessment["decision"],
  overrides: Partial<ResearchBrainMotionAssessment> = {},
): ResearchBrainMotionAssessment {
  return {
    motion_id: "motion-1",
    decision,
    reason: "System 2 evaluated the Motion against canonical packet evidence.",
    evidence_references: [PACKET_EVIDENCE_ID],
    story_implication: decision === "ACCEPT" || decision === "REFINE"
      ? "The linked Story should incorporate the evidence-supported development."
      : null,
    regime_implication: decision === "ACCEPT" || decision === "REFINE"
      ? "The exact rate regime remains restrictive while the driver mix is reassessed."
      : null,
    investigation_next: decision === "UNRESOLVED"
      ? "Separate real yields, supply and term premium."
      : null,
    refined_headline: decision === "REFINE"
      ? "Long-end pressure persists after softer inflation evidence"
      : null,
    refined_why_interesting: decision === "REFINE"
      ? "The move keeps a duration-pressure question alive without proving the original causal claim."
      : null,
    refined_big_picture_bridge: decision === "REFINE"
      ? "Long-end pressure -> test supply, real-yield and term-premium channels -> financing conditions."
      : null,
    ...overrides,
  };
}

function promotedRecord(
  input: ReturnType<typeof marketMotionDossierPromotionInput>,
  overrides: Partial<MarketMotionRecord> = {},
): MarketMotionRecord {
  return motionRecord({
    version_number: 2,
    previous_version_id: "motion-1",
    lifecycle_state: "PROMOTED",
    effective_state: "PROMOTED",
    headline: input.headline,
    what_happened: input.whatHappened,
    market_reaction: input.marketReaction ?? null,
    why_interesting: input.whyInteresting,
    big_picture_bridge: input.bigPictureBridge,
    next_test: input.nextTest ?? null,
    promotion_reason: input.promotionReason ?? null,
    primary_story_id: input.primaryStoryId ?? null,
    primary_regime_slug: input.primaryRegimeSlug ?? null,
    metadata: input.metadata ?? {},
    ...overrides,
  });
}

function dossier(
  item: DossierMotionActivation,
  result: ResearchBrainMotionAssessment,
): MarketDossierV2 {
  return {
    id: "dossier-current",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: NOW.toISOString(),
    freshness: { warnings: [] },
    research_gaps: [],
    payload: {
      motion_attention_snapshot: [{
        motion_id: item.id,
        headline: item.headline,
        what_happened: item.what_happened,
        market_reaction: item.market_reaction,
        why_interesting: item.why_interesting,
        big_picture_bridge: item.big_picture_bridge,
        next_test: item.next_test,
        primary_story_id: item.primary_story_id,
        primary_regime_slug: item.primary_regime_slug,
        packet_evidence_id: item.packet_evidence_id,
        verification_state: item.verification_state,
        materiality: item.materiality,
        relevance: item.relevance,
        novelty: item.novelty,
      }],
      analytical_output: {
        research_now: [],
        investigations: [],
        motion_attention_assessments: [result],
      },
    },
    created_at: NOW.toISOString(),
  };
}

test("B3c Story ACCEPT: exact evidence activates System 2, then Story-scoped Motion promotes and investigates", () => {
  const p = packet();
  const motion = activation();
  const eligible = selectDossierMotionActivations(context(motion), p);
  const attention = buildResearchBrainMotionAttention(context(motion), p);

  assert.deepEqual(eligible.map((item) => item.id), ["motion-1"]);
  assert.equal(attention[0]?.packet_evidence_id, PACKET_EVIDENCE_ID);

  const record = motionRecord();
  const result = assessment("ACCEPT");
  assert.deepEqual(
    selectDossierAcceptedPromotableMarketMotion([record], [result], NOW).map((item) => item.id),
    ["motion-1"],
  );

  const promotion = marketMotionDossierPromotionInput(record, result, { dossierId: "dossier-current" });
  assert.equal(promotion.primaryStoryId, "story-rates");
  assert.equal(promotion.metadata?.promotionScope, "STORY");

  const promoted = promotedRecord(promotion);
  const investigation = marketMotionInvestigationEligibility({
    lifecycleState: promoted.lifecycle_state,
    verificationState: promoted.verification_state,
    expiresAt: promoted.expires_at,
    nextTest: promoted.next_test,
    storyId: promoted.primary_story_id,
    regimeSlug: promoted.primary_regime_slug,
  }, NOW);
  assert.equal(investigation.eligible, true);
  assert.equal(investigation.storyId, "story-rates");

  const edition = buildMarketMotionEditionAttachment({
    researchRunId: "run-1",
    capturedAt: NOW.toISOString(),
    rows: [promoted],
    stories: [{ id: "story-rates", slug: "rates-duration", title: "Rates Duration" }],
  });
  assert.equal(edition.items[0]?.storyId, "story-rates");

  const queue = buildResearchGapWorkQueue(dossier(motion, result), NOW, [promoted]);
  const gap = queue.candidates.find((item) => item.sourceRef === "motion-1");
  assert.ok(gap);
  assert.deepEqual(gap?.linkedStoryIds, ["story-rates"]);
});

test("B3c Regime ACCEPT: promotion stays Story-null while edition, Hybrid gate and Gap keep the exact Regime route", () => {
  const motion = activation({ primary_story_id: null });
  const record = motionRecord({ primary_story_id: null });
  const result = assessment("ACCEPT", {
    story_implication: null,
    regime_implication: "Long-end pressure remains material to the exact rate regime.",
  });

  assert.equal(selectDossierMotionActivations(context(motion), packet()).length, 1);
  const promotion = marketMotionDossierPromotionInput(record, result, { dossierId: "dossier-current" });
  assert.equal(promotion.primaryStoryId, null);
  assert.equal(promotion.primaryRegimeSlug, "global-cost-of-capital");
  assert.equal(promotion.metadata?.promotionScope, "REGIME");

  const promoted = promotedRecord(promotion);
  const investigation = marketMotionInvestigationEligibility({
    lifecycleState: promoted.lifecycle_state,
    verificationState: promoted.verification_state,
    expiresAt: promoted.expires_at,
    nextTest: promoted.next_test,
    storyId: promoted.primary_story_id,
    regimeSlug: promoted.primary_regime_slug,
  }, NOW);
  assert.deepEqual(investigation, {
    eligible: true,
    reason: "ELIGIBLE",
    nextTest: promoted.next_test,
    storyId: null,
    regimeSlug: "global-cost-of-capital",
  });

  const edition = buildMarketMotionEditionAttachment({
    researchRunId: "run-1",
    capturedAt: NOW.toISOString(),
    rows: [promoted],
    stories: [],
  });
  assert.equal(edition.items[0]?.storyId, null);
  assert.equal(edition.items[0]?.regimeSlug, "global-cost-of-capital");

  const queue = buildResearchGapWorkQueue(dossier(motion, result), NOW, [promoted]);
  const gap = queue.candidates.find((item) => item.sourceRef === "motion-1");
  assert.ok(gap);
  assert.deepEqual(gap?.linkedStoryIds, []);
  assert.ok(gap?.blockingRefs.includes("REGIME:global-cost-of-capital"));
});

test("B3c REFINE: only corrected append-only framing is promotable", () => {
  const record = motionRecord();
  const result = assessment("REFINE");
  const selected = selectDossierAcceptedPromotableMarketMotion([record], [result], NOW);
  assert.deepEqual(selected.map((item) => item.id), ["motion-1"]);

  const promotion = marketMotionDossierPromotionInput(record, result, { dossierId: "dossier-current" });
  assert.equal(promotion.headline, result.refined_headline);
  assert.equal(promotion.whyInteresting, result.refined_why_interesting);
  assert.equal(promotion.bigPictureBridge, result.refined_big_picture_bridge);
  assert.notEqual(promotion.headline, record.headline);
  assert.equal(promotion.metadata?.promotionDecision, "REFINE");
  assert.equal(promotion.metadata?.refinedFromMotionId, "motion-1");

  const promoted = promotedRecord(promotion);
  const edition = buildMarketMotionEditionAttachment({
    researchRunId: "run-1",
    capturedAt: NOW.toISOString(),
    rows: [promoted],
    stories: [{ id: "story-rates", slug: "rates-duration", title: "Rates Duration" }],
  });
  assert.equal(edition.items[0]?.headline, result.refined_headline);
  assert.notEqual(edition.items[0]?.headline, record.headline);
});

test("B3c UNRESOLVED: no promotion occurs and the exact Motion opens Research Gap work", () => {
  const motion = activation({ primary_story_id: null });
  const record = motionRecord({ primary_story_id: null });
  const result = assessment("UNRESOLVED", {
    story_implication: null,
    regime_implication: null,
    investigation_next: "Separate real yields, supply and term premium.",
  });

  assert.equal(selectDossierAcceptedPromotableMarketMotion([record], [result], NOW).length, 0);
  assert.throws(
    () => marketMotionDossierPromotionInput(record, result, { dossierId: "dossier-current" }),
    /requires an ACCEPT or REFINE assessment/i,
  );

  const queue = buildResearchGapWorkQueue(dossier(motion, result), NOW);
  const gap = queue.candidates.find((item) => item.sourceRef === "motion-1");
  assert.ok(gap);
  assert.equal(gap?.nativeSignals.divergence, "UNRESOLVED");
  assert.deepEqual(gap?.linkedStoryIds, []);
  assert.ok(gap?.blockingRefs.includes("REGIME:global-cost-of-capital"));
});

test("B3c REJECT: Motion stops with neither promotion nor Research Gap work", () => {
  const motion = activation();
  const record = motionRecord();
  const result = assessment("REJECT", {
    story_implication: null,
    regime_implication: null,
    investigation_next: null,
  });

  assert.equal(selectDossierAcceptedPromotableMarketMotion([record], [result], NOW).length, 0);
  assert.throws(
    () => marketMotionDossierPromotionInput(record, result, { dossierId: "dossier-current" }),
    /requires an ACCEPT or REFINE assessment/i,
  );

  const queue = buildResearchGapWorkQueue(dossier(motion, result), NOW);
  assert.equal(
    queue.candidates.filter((item) => item.sourceKind === "market_motion").length,
    0,
  );
});
