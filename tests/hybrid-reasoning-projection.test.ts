import assert from "node:assert/strict";
import test from "node:test";

import type { Story } from "../lib/data.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { StoryEvent, StoryThesisVersion } from "../lib/persistence/contracts.ts";
import { buildHybridReasoningProjection } from "../lib/hybrid-reasoning-projection.ts";

function story(id: string, slug: string, title: string): Story {
  return {
    id, slug, title,
    thesis: "Test thesis",
    status: "publish",
    confidence: 80,
    rank: 1,
    market_question: null,
    dominant_narrative: null,
    best_explanation: null,
    strongest_support: null,
    strongest_contradiction: null,
    priced_assessment: null,
    confirmation_trigger: null,
    invalidation_trigger: null,
    next_catalyst: null,
    article_angle: null,
    provisional_title: null,
    article_verdict: "develop",
    assets: [],
    source_quality: 80,
    novelty: 60,
    persistence: 90,
    trader_relevance: 90,
    article_potential: 70,
  };
}

function event(overrides: Partial<StoryEvent>): StoryEvent {
  return {
    id: "event-1",
    story_id: "story-ai",
    source_id: null,
    evidence_id: "ev-1",
    observation_id: null,
    research_run_id: null,
    legacy_update_id: null,
    event_type: "confirmation",
    headline: "Confirmed",
    detail: null,
    impact: "supports",
    confidence_delta: 5,
    event_at: "2026-10-05T01:00:00.000Z",
    recorded_at: "2026-10-05T01:01:00.000Z",
    metadata: {},
    created_by: null,
    ...overrides,
  };
}

function version(storyId: string, status = "publish"): StoryThesisVersion {
  return {
    id: "version-" + storyId,
    story_id: storyId,
    event_id: null,
    version_number: 2,
    title: "Version",
    thesis: "Thesis",
    status,
    confidence: 80,
    market_question: null,
    dominant_narrative: null,
    best_explanation: null,
    strongest_support: null,
    strongest_contradiction: null,
    priced_assessment: null,
    confirmation_trigger: null,
    invalidation_trigger: null,
    next_catalyst: null,
    article_angle: null,
    provisional_title: null,
    article_verdict: null,
    assets: [],
    portfolio_map: {},
    snapshot: {},
    change_reason: "test",
    effective_at: "2026-10-05T01:00:00.000Z",
    created_at: "2026-10-05T01:00:00.000Z",
    created_by: null,
  };
}

function dossier(
  stories: Array<{ id: string; persistentStoryId?: string | null; title: string; evidenceRefs: string[] }>,
  regimeFamily: DossierPresentationV1["header"]["regimeFamily"] = "RATES_LED_TIGHTENING",
  overrides?: Partial<DossierPresentationV1>,
): DossierPresentationV1 {
  return {
    contractVersion: "dossier-presentation/1",
    dossierId: "dossier-1",
    previousDossierId: null,
    asOf: "2026-10-05T02:00:00.000Z",
    createdAt: "2026-10-05T02:00:00.000Z",
    health: { state: "healthy", degraded: false, repairUsed: false, freshnessWarnings: [], evidenceStates: [], researchGaps: [], missingInputCategories: [] },
    memory: { state: "AVAILABLE", structuralPredecessorId: null, analyticalBaselineId: null, analyticalBaselineAsOf: null, sameAsStructuralPredecessor: false },
    header: { headline: "Test", answer: "Test", regimeImplication: "Test", regimeFamily, epistemicLabel: "SUPPORTED", whatWouldChangeMind: "Test" },
    regimeStrip: [],
    policyOutlook: [],
    rateRegime: { state: "UNRESOLVED", nextMeetingRateOutlook: null, fedWatchExpectedDirection: null, trigger: null, observedRatePricing: null, observedConfirmation: null, usRatesReaction: null, usRatesInterpretation: null, fredBacked: false, evidenceRefs: [], gaps: [] },
    whatMattersNow: {
      leadThreadId: "thread",
      supportingStoryIds: stories.map((s) => s.id),
      stories: stories.map((s) => ({
        id: s.id,
        persistentStoryId: s.persistentStoryId !== undefined ? s.persistentStoryId : s.id,
        title: s.title,
        whatChanged: "",
        whyItMatters: "",
        mechanism: "",
        conclusion: "",
        whatWouldChangeMind: "",
        epistemicLabel: "SUPPORTED",
        evidenceRefs: s.evidenceRefs,
        investigationIds: [],
        chartIds: [],
      })),
    },
    watchNext: [],
    investigationAudit: [],
    investigationJourney: [],
    reactionCalibration: { evaluatedInvestigations: 0, alignedInvestigations: 0, divergentInvestigations: 0, mixedInvestigations: 0, unresolvedInvestigations: 0, intradayInvestigations: 0, expectationChangedInvestigations: 0, reviewQueue: [] },
    researchNow: [],
    charts: { core: [], optional: [] },
    stockRadar: [],
    themes: [],
    creatorThemes: [],
    thesisChanges: [],
    evidenceIndex: [],
    diagnostics: { modelRepairUsed: false, notes: [], omittedOrDemotedItems: [] },
    ...overrides,
  };
}

test("Hybrid uses persistentStoryId strictly to classify canonical stories and leaves unlinked stories unresolved", () => {
  const persistentAi = story("uuid-persistent-ai", "ai-financing-stress", "AI financing stress");
  const boundDossier = dossier([
    { id: "analytical-story-1", persistentStoryId: persistentAi.id, title: "Analytical AI", evidenceRefs: ["ev-1"] },
    { id: "analytical-story-2", persistentStoryId: null, title: "Unlinked Story", evidenceRefs: ["ev-2"] },
  ]);

  const result = buildHybridReasoningProjection({
    dossier: boundDossier,
    stories: [persistentAi],
    events: [event({ story_id: persistentAi.id, impact: "amplifies" })],
    versions: [version(persistentAi.id)],
  });

  assert.equal(result.storyClassifications.length, 2);
  assert.equal(result.storyClassifications[0].storyId, persistentAi.id);
  assert.equal(result.storyClassifications[0].classification, "ACCELERATING");

  assert.equal(result.storyClassifications[1].classification, "UNRESOLVED");
  assert.match(result.storyClassifications[1].reason, /no persistentStoryId binding/i);
});

test("Hybrid handles persistentStoryId not present in research store as UNRESOLVED without fuzzy matching", () => {
  const boundDossier = dossier([
    { id: "analytical-story-missing", persistentStoryId: "uuid-not-in-store", title: "Missing Persistent Story", evidenceRefs: ["ev-1"] },
  ]);

  const result = buildHybridReasoningProjection({
    dossier: boundDossier,
    stories: [],
    events: [],
    versions: [],
  });

  assert.equal(result.storyClassifications.length, 1);
  assert.equal(result.storyClassifications[0].classification, "UNRESOLVED");
  assert.match(result.storyClassifications[0].reason, /not available in canonical research store/i);
});

test("rates-led and AI acceleration shifts A toward B with explicit provenance and transition state", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: "analytical-ai", persistentStoryId: ai.id, title: ai.title, evidenceRefs: ["ev-1"] }]),
    stories: [ai],
    events: [event({ story_id: ai.id, impact: "amplifies" })],
    versions: [version(ai.id)],
  });

  const p = result.scenarios.current;
  assert.equal(Object.values(p).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(p.D, 8);
  assert.equal(p.E, 2);
  assert.ok(p.B > result.scenarios.starting.B);
  assert.ok(p.A < result.scenarios.starting.A);

  assert.ok(result.scenarios.transfers.length > 0);
  for (const transfer of result.scenarios.transfers) {
    assert.ok(["A", "B", "C", "D", "E"].includes(transfer.donor));
    assert.ok(["A", "B", "C", "D", "E"].includes(transfer.recipient));
    assert.ok(transfer.amount > 0);
    assert.ok(transfer.reason.length > 0);
    assert.ok(["CANDIDATE", "CONFIRMED"].includes(transfer.transitionState));
  }

  assert.ok(result.scenarios.eligibility.A === "ELIGIBLE_TO_DECREASE" || result.scenarios.eligibility.A === "HOLD");
  assert.equal(result.scenarios.eligibility.B, "ELIGIBLE_TO_INCREASE");
  assert.equal(result.scenarios.eligibility.D, "CAPPED");
  assert.equal(result.scenarios.eligibility.E, "CAPPED");
});

test("growth-scare risk-off regime family moves probability from B to C", () => {
  const result = buildHybridReasoningProjection({
    dossier: dossier([], "GROWTH_SCARE_RISK_OFF"),
    stories: [],
    events: [],
    versions: [],
  });

  assert.equal(result.scenarios.current.B, 35);
  assert.equal(result.scenarios.current.C, 25);
  assert.equal(result.scenarios.eligibility.B, "ELIGIBLE_TO_DECREASE");
  assert.equal(result.scenarios.eligibility.C, "ELIGIBLE_TO_INCREASE");
});

test("global credit amplification shifts B toward C but cannot invent systemic or confidence-tail probability", () => {
  const credit = story("story-credit", "global-credit-transmission", "Global credit transmission");
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: "analytical-credit", persistentStoryId: credit.id, title: credit.title, evidenceRefs: ["ev-credit"] }]),
    stories: [credit],
    events: [event({ story_id: credit.id, evidence_id: "ev-credit", impact: "amplifies" })],
    versions: [version(credit.id)],
  });

  assert.ok(result.scenarios.current.C > result.scenarios.starting.C);
  assert.equal(result.scenarios.current.D, 8);
  assert.equal(result.scenarios.current.E, 2);
  assert.equal(result.scenarios.guardedTails.length, 2);
  assert.equal(result.scenarios.eligibility.D, "CAPPED");
  assert.equal(result.scenarios.eligibility.E, "CAPPED");
});

test("Scenario D remains capped when credit accelerates and dollar liquidity tightens without a structured tail trigger", () => {
  const credit = story("story-credit", "global-credit-transmission", "Global credit transmission");
  const stressedDossier = dossier(
    [{ id: "analytical-credit", persistentStoryId: credit.id, title: credit.title, evidenceRefs: ["ev-credit-1", "ev-credit-2"] }],
    "GROWTH_SCARE_RISK_OFF",
    {
      dollarLiquidity: {
        contractVersion: "system1-dollar-liquidity/1",
        asOf: "2026-10-05T02:00:00.000Z",
        state: "TIGHTENING",
        score: 75,
        confidence: "HIGH",
        summary: "Dollar liquidity tightening and severe forced-selling pressure",
        components: [],
        drivers: [],
        contradictions: [],
        evidenceRefs: ["ev-liq-1"],
        coverage: { resolved: 4, scoredTotal: 4, offshoreUsd: "UNRESOLVED" },
        gaps: ["Forced selling, collateral stress, covenant stress"],
      },
    },
  );

  const result = buildHybridReasoningProjection({
    dossier: stressedDossier,
    stories: [credit],
    events: [
      event({ story_id: credit.id, evidence_id: "ev-credit-1", impact: "amplifies" }),
      event({ id: "event-credit-2", story_id: credit.id, evidence_id: "ev-credit-2", impact: "supports" }),
    ],
    versions: [version(credit.id)],
  });

  assert.equal(result.scenarios.eligibility.D, "CAPPED");
  assert.equal(result.scenarios.current.D, 8);
  assert.equal(result.scenarios.transfers.some((item) => item.recipient === "D"), false);
});

test("Scenario E remains capped when only rate, USD, and gap prose suggest a confidence break", () => {
  const confidenceDossier = dossier([], "RATES_LED_TIGHTENING", {
    rateRegime: {
      state: "HAWKISH",
      nextMeetingRateOutlook: null,
      fedWatchExpectedDirection: null,
      trigger: null,
      observedRatePricing: null,
      observedConfirmation: null,
      usRatesReaction: null,
      usRatesInterpretation: "Treasury yields are surging and confidence is breaking.",
      fredBacked: true,
      evidenceRefs: ["ev-rates-1"],
      gaps: ["Auction demand failure detected"],
    },
    regimeStrip: [
      {
        key: "USD",
        label: "USD",
        observed: true,
        reaction: "sharp down",
        interpretation: "USD confidence collapse and auction stress",
        evidenceRefs: ["ev-usd-1"],
        unresolvedSignals: [],
      },
    ],
  });

  const result = buildHybridReasoningProjection({
    dossier: confidenceDossier,
    stories: [],
    events: [],
    versions: [],
  });

  assert.equal(result.scenarios.eligibility.E, "CAPPED");
  assert.equal(result.scenarios.current.E, 2);
  assert.equal(result.scenarios.transfers.some((item) => item.recipient === "E"), false);
});

test("an invalidating Story cannot by itself hard-falsify or zero a whole Hybrid scenario", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const invalidatingEvent = event({
    story_id: ai.id,
    event_type: "invalidation",
    impact: "contradicts",
    detail: "This individual Story mechanism is invalidated.",
  });

  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: "analytical-ai", persistentStoryId: ai.id, title: ai.title, evidenceRefs: ["ev-1"] }]),
    stories: [ai],
    events: [invalidatingEvent],
    versions: [version(ai.id, "invalidated")],
  });

  assert.notEqual(result.scenarios.eligibility.A, "FALSIFIED");
  assert.ok(result.scenarios.current.A > 0);
  assert.equal(
    result.scenarios.transfers.some((item) => /Scenario A FALSIFIED/i.test(item.reason)),
    false,
  );
});

test("an existing thesis version alone does not upgrade ordinary confirmation to a confirmed transition", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: "analytical-ai", persistentStoryId: ai.id, title: ai.title, evidenceRefs: ["ev-1", "ev-2"] }]),
    stories: [ai],
    events: [event({ story_id: ai.id, impact: "supports", evidence_id: "ev-1" })],
    versions: [version(ai.id)],
  });

  const storyTransfer = result.scenarios.transfers.find((item) =>
    item.reason.includes(ai.title),
  );
  assert.ok(storyTransfer);
  assert.equal(storyTransfer.transitionState, "CANDIDATE");
});

test("explicit acceleration may produce a confirmed transition without relying on thesis-version existence", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: "analytical-ai", persistentStoryId: ai.id, title: ai.title, evidenceRefs: ["ev-1"] }]),
    stories: [ai],
    events: [event({ story_id: ai.id, impact: "amplifies", evidence_id: "ev-1" })],
    versions: [],
  });

  const storyTransfer = result.scenarios.transfers.find((item) =>
    item.reason.includes(ai.title),
  );
  assert.ok(storyTransfer);
  assert.equal(storyTransfer.transitionState, "CONFIRMED");
});

test("Same-evidence replay is stable and idempotent (does not ratchet probabilities)", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const inputData = {
    dossier: dossier([{ id: "analytical-ai", persistentStoryId: ai.id, title: ai.title, evidenceRefs: ["ev-1"] }]),
    stories: [ai],
    events: [event({ story_id: ai.id, impact: "amplifies" })],
    versions: [version(ai.id)],
  };

  const run1 = buildHybridReasoningProjection(inputData);
  const run2 = buildHybridReasoningProjection(inputData);

  assert.deepEqual(run1.scenarios.current, run2.scenarios.current);
  assert.deepEqual(run1.scenarios.transfers, run2.scenarios.transfers);
  assert.deepEqual(run1.scenarios.eligibility, run2.scenarios.eligibility);
});

test("historical Hybrid projection ignores Story events and versions after Dossier as-of", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const lateEvent = event({ story_id: ai.id, event_type: "invalidation", impact: "contradicts", event_at: "2026-10-06T01:00:00.000Z" });
  const lateVersion = { ...version(ai.id, "invalidated"), effective_at: "2026-10-06T01:00:00.000Z" };
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: "analytical-ai", persistentStoryId: ai.id, title: ai.title, evidenceRefs: ["ev-1"] }]),
    stories: [ai],
    events: [lateEvent],
    versions: [lateVersion],
  });
  assert.equal(result.storyClassifications[0].classification, "UNRESOLVED");
});
