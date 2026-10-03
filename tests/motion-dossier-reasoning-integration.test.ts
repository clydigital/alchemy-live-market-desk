import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import {
  decideDossierDelta,
  type DossierDeltaContext,
} from "../lib/dossier-v2/delta-gate.ts";
import type { DossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import type {
  ResearchBrainMotionAssessment,
} from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  marketMotionDossierPromotionInput,
  selectDossierAcceptedPromotableMarketMotion,
} from "../lib/market-motion-promotion.ts";
import {
  marketMotionInvestigationEligibility,
  type MarketMotionRecord,
} from "../lib/market-motion.ts";
import { buildResearchGapWorkQueue } from "../lib/research-gap-worker.ts";

const PREVIOUS_AS_OF = "2026-10-03T12:00:00.000Z";
const NOW = new Date("2026-10-04T00:00:00.000Z");
const PACKET_EVIDENCE_ID = "ev:rates:exact";

function packet(): DossierV2InputPacket {
  return {
    packet_id: "packet:b3c",
    contract_version: "dossier-v2-input/1",
    as_of: NOW.toISOString(),
    previous_dossier_id: "dossier-prior",
    observed_evidence: [{
      evidence_id: PACKET_EVIDENCE_ID,
      epistemic_label: "OBSERVED",
      claim_or_fact: "Long-end Treasury yields remained elevated after softer inflation evidence.",
      category: "RATES",
      source_type: "MARKET_DATA",
      available_at: "2026-10-03T23:40:00.000Z",
      provenance: [{
        source_type: "MARKET_DATA",
        source_id: "rates-exact",
        publisher: "Canonical Rates Feed",
      }],
    }],
    research_leads: [],
    prior_analytical_state: {
      previous_dossier_id: "dossier-prior",
      as_of: PREVIOUS_AS_OF,
      prior_claims: [],
      thesis_ledger: {
        contract_version: "thesis-ledger/1",
        entries: [],
      },
    },
    development_clusters: [],
    creator_themes: [],
    catalysts: [],
    thesis_ledger: {
      contract_version: "thesis-ledger/1",
      entries: [],
    },
    freshness_warnings: [],
    research_gaps: [],
    diagnostics: {
      omitted_clusters_count: 0,
      omitted_evidence_count: 0,
      omitted_leads_count: 0,
      omitted_creator_themes_count: 0,
      omitted_creator_claims_count: 0,
      omitted_catalysts_count: 0,
      omitted_prior_claims_count: 0,
      omitted_thesis_entries_count: 0,
      omitted_research_gaps_count: 0,
      byte_limit_truncation_applied: false,
      notes: [],
    },
  } as DossierV2InputPacket;
}

function priorDossier(): MarketDossierV2 {
  return {
    id: "dossier-prior",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: PREVIOUS_AS_OF,
    freshness: { warnings: [] },
    research_gaps: [],
    payload: {
      analytical_output: {
        major_stories: [{
          story_id: "story:rates",
        }],
        main_thread: {
          supporting_story_ids: ["story:rates"],
        },
      },
    },
    created_at: PREVIOUS_AS_OF,
  } as unknown as MarketDossierV2;
}

function motionRecord(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "motion:rates",
    motion_key: "rates:long-end-pressure",
    version_number: 1,
    previous_version_id: null,
    contract_version: "market-motion/v1",
    research_run_id: "run:rates",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story:rates",
    primary_regime_slug: "global-cost-of-capital",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    category: "MACRO",
    verification_state: "VERIFIED",
    headline: "Long-end yields remain elevated",
    what_happened: "Long-end yields remained elevated after softer inflation evidence.",
    market_reaction: "Duration stayed under pressure.",
    why_interesting: "Tests whether rate pressure is broader than the inflation impulse alone.",
    big_picture_bridge: "Long-end pressure -> financing costs -> valuation.",
    next_test: "Separate real yields, supply and term-premium channels.",
    promotion_reason: null,
    tickers: ["US10Y", "US30Y"],
    source_name: "Canonical Rates Feed",
    source_url: "https://example.com/rates",
    source_kind: "market_data",
    materiality: 93,
    relevance: 95,
    novelty: 84,
    occurred_at: "2026-10-03T23:30:00.000Z",
    observed_at: "2026-10-03T23:40:00.000Z",
    expires_at: "2026-10-05T23:40:00.000Z",
    metadata: { itemKey: "rates-long-end" },
    created_at: "2026-10-03T23:40:00.000Z",
    ...overrides,
  };
}

function assessment(
  decision: ResearchBrainMotionAssessment["decision"],
  overrides: Partial<ResearchBrainMotionAssessment> = {},
): ResearchBrainMotionAssessment {
  return {
    motion_id: "motion:rates",
    decision,
    reason: "Canonical Dossier evidence was evaluated against the Motion framing.",
    evidence_references: [PACKET_EVIDENCE_ID],
    story_implication: decision === "ACCEPT" || decision === "REFINE"
      ? "The linked rates Story should incorporate the supported duration-pressure branch."
      : null,
    regime_implication: "The global cost-of-capital regime remains restrictive.",
    investigation_next: decision === "UNRESOLVED"
      ? "Separate real yields, supply and term-premium channels."
      : null,
    refined_headline: decision === "REFINE"
      ? "Long-end pressure persists, but the dominant driver remains unresolved"
      : null,
    refined_why_interesting: decision === "REFINE"
      ? "The move is supported while the original causal claim was too broad."
      : null,
    refined_big_picture_bridge: decision === "REFINE"
      ? "Long-end pressure -> test real yield, supply and term-premium channels -> financing conditions."
      : null,
    ...overrides,
  };
}

function dossierWithAssessment(
  decision: ResearchBrainMotionAssessment["decision"],
  overrides: Partial<ResearchBrainMotionAssessment> = {},
): MarketDossierV2 {
  return {
    id: `dossier-${decision.toLowerCase()}`,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: "dossier-prior",
    as_of: NOW.toISOString(),
    freshness: { warnings: [] },
    research_gaps: [],
    payload: {
      motion_attention_snapshot: [{
        motion_id: "motion:rates",
        headline: "Long-end yields remain elevated",
        what_happened: "Long-end yields remained elevated after softer inflation evidence.",
        market_reaction: "Duration stayed under pressure.",
        why_interesting: "Tests whether rate pressure is broader than inflation alone.",
        big_picture_bridge: "Long-end pressure -> financing costs -> valuation.",
        next_test: "Separate real yields, supply and term-premium channels.",
        primary_story_id: "story:rates",
        primary_regime_slug: "global-cost-of-capital",
        packet_evidence_id: PACKET_EVIDENCE_ID,
        verification_state: "VERIFIED",
        materiality: 93,
        relevance: 95,
        novelty: 84,
      }],
      analytical_output: {
        research_now: [],
        investigations: [],
        motion_attention_assessments: [assessment(decision, overrides)],
      },
    },
    created_at: NOW.toISOString(),
  } as unknown as MarketDossierV2;
}

test("B3c A1 invariant: exact-evidence Motion wakes Dossier synthesis before Story change", () => {
  const context: DossierDeltaContext = {
    available: true,
    states: [],
    stories: [],
    warning: null,
    motionActivations: [{
      id: "motion:rates",
      evidence_id: null,
      research_run_id: "run:rates",
      packet_evidence_id: PACKET_EVIDENCE_ID,
      primary_story_id: "story:rates",
      primary_regime_slug: "global-cost-of-capital",
      lifecycle_state: "MOTION",
      verification_state: "VERIFIED",
      headline: "Long-end yields remain elevated",
      what_happened: "Long-end yields remained elevated after softer inflation evidence.",
      market_reaction: "Duration stayed under pressure.",
      why_interesting: "Tests the active rates explanation.",
      big_picture_bridge: "Long-end pressure -> financing costs -> valuation.",
      next_test: "Separate real yields, supply and term-premium channels.",
      materiality: 93,
      relevance: 95,
      novelty: 84,
      occurred_at: "2026-10-03T23:30:00.000Z",
      observed_at: "2026-10-03T23:40:00.000Z",
      expires_at: "2026-10-05T23:40:00.000Z",
      metadata: { itemKey: "rates-long-end" },
    }],
  };

  const decision = decideDossierDelta({
    packet: packet(),
    previousDossier: priorDossier(),
    context,
  });

  assert.equal(decision.action, "REBASE");
  assert.deepEqual(decision.changedStoryIds, []);
  assert.equal(decision.postIntelligenceModelCallBudget, 2);
  assert.match(decision.reason, /before Story promotion/i);
});

test("B3c ACCEPT matrix: Story and Regime scopes promote only through Dossier assessment", () => {
  const storyInput = marketMotionDossierPromotionInput(
    motionRecord(),
    assessment("ACCEPT"),
    { dossierId: "dossier-accept-story" },
  );
  assert.equal(storyInput.lifecycleState, "PROMOTED");
  assert.equal(storyInput.primaryStoryId, "story:rates");
  assert.equal(storyInput.primaryRegimeSlug, "global-cost-of-capital");
  assert.equal(storyInput.metadata?.promotionScope, "STORY");

  const regimeInput = marketMotionDossierPromotionInput(
    motionRecord({ primary_story_id: null }),
    assessment("ACCEPT", {
      story_implication: null,
      regime_implication: "The exact cost-of-capital Regime remains restrictive.",
    }),
    { dossierId: "dossier-accept-regime" },
  );
  assert.equal(regimeInput.lifecycleState, "PROMOTED");
  assert.equal(regimeInput.primaryStoryId, null);
  assert.equal(regimeInput.primaryRegimeSlug, "global-cost-of-capital");
  assert.equal(regimeInput.metadata?.promotionScope, "REGIME");
});

test("B3c REFINE matrix: only corrected append-only framing is promotable", () => {
  const input = marketMotionDossierPromotionInput(
    motionRecord(),
    assessment("REFINE"),
    { dossierId: "dossier-refine" },
  );

  assert.equal(input.lifecycleState, "PROMOTED");
  assert.equal(input.headline, "Long-end pressure persists, but the dominant driver remains unresolved");
  assert.equal(input.whyInteresting, "The move is supported while the original causal claim was too broad.");
  assert.equal(
    input.bigPictureBridge,
    "Long-end pressure -> test real yield, supply and term-premium channels -> financing conditions.",
  );
  assert.equal(input.metadata?.promotionDecision, "REFINE");
  assert.equal(input.metadata?.refinedFromMotionId, "motion:rates");
});

test("B3c UNRESOLVED matrix: research opens directly without promotion", () => {
  const unresolved = assessment("UNRESOLVED", {
    story_implication: null,
    regime_implication: null,
  });
  assert.deepEqual(
    selectDossierAcceptedPromotableMarketMotion([motionRecord()], [unresolved], NOW),
    [],
  );

  const queue = buildResearchGapWorkQueue(
    dossierWithAssessment("UNRESOLVED", {
      story_implication: null,
      regime_implication: null,
    }),
    NOW,
  );
  const candidate = queue.candidates.find((item) => item.sourceRef === "motion:rates");

  assert.ok(candidate);
  assert.equal(candidate?.sourceKind, "market_motion");
  assert.equal(candidate?.question, "Separate real yields, supply and term-premium channels.");
  assert.deepEqual(candidate?.linkedStoryIds, ["story:rates"]);
  assert.ok(candidate?.blockingRefs.includes("REGIME:global-cost-of-capital"));
});

test("B3c REJECT matrix: no promotion and no Research Gap branch", () => {
  const rejected = assessment("REJECT", {
    story_implication: null,
    regime_implication: null,
  });
  assert.deepEqual(
    selectDossierAcceptedPromotableMarketMotion([motionRecord()], [rejected], NOW),
    [],
  );

  const queue = buildResearchGapWorkQueue(
    dossierWithAssessment("REJECT", {
      story_implication: null,
      regime_implication: null,
    }),
    NOW,
  );
  assert.equal(queue.candidates.some((item) => item.sourceRef === "motion:rates"), false);
});

test("B3c regime-only promoted Motion has an exact investigation route without synthetic Story identity", () => {
  const regimeMotion = motionRecord({
    lifecycle_state: "PROMOTED",
    effective_state: "PROMOTED",
    primary_story_id: null,
  });

  const eligibility = marketMotionInvestigationEligibility({
    lifecycleState: regimeMotion.lifecycle_state,
    verificationState: regimeMotion.verification_state,
    expiresAt: regimeMotion.expires_at,
    nextTest: regimeMotion.next_test,
    storyId: regimeMotion.primary_story_id,
    regimeSlug: regimeMotion.primary_regime_slug,
  }, NOW);

  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.storyId, null);
  assert.equal(eligibility.regimeSlug, "global-cost-of-capital");

  const queue = buildResearchGapWorkQueue(
    {
      id: "dossier-regime-route",
      contract_version: "market-dossier-v2/1",
      previous_dossier_id: null,
      as_of: NOW.toISOString(),
      freshness: { warnings: [] },
      research_gaps: [],
      payload: { analytical_output: { research_now: [], investigations: [] } },
      created_at: NOW.toISOString(),
    } as unknown as MarketDossierV2,
    NOW,
    [regimeMotion],
  );
  const candidate = queue.candidates.find((item) => item.sourceRef === "motion:rates");

  assert.ok(candidate);
  assert.deepEqual(candidate?.linkedStoryIds, []);
  assert.ok(candidate?.blockingRefs.includes("REGIME:global-cost-of-capital"));
  assert.ok(!candidate?.blockingRefs.some((ref) => ref.startsWith("STORY:")));
});

test("B3c architecture anti-regressions: no Story-first promotion and no mutable Hybrid Motion read", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  const hybrid = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  const execution = readFileSync(new URL("../lib/dossier-v2/execution.ts", import.meta.url), "utf8");

  assert.doesNotMatch(runtime, /promoteMarketMotionForPublishedStories/);
  assert.doesNotMatch(runtime, /canonical-story-changed\/v1/);
  assert.match(execution, /motion_attention_snapshot/);
  assert.match(execution, /promoteMarketMotionFromDossierAssessments/);
  assert.doesNotMatch(hybrid, /getCurrentMarketMotion/);
  assert.doesNotMatch(hybrid, /current_market_motion_items/);
  assert.match(hybrid, /dossier\.motionAttention/);
});
