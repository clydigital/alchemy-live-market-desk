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

function dossier(stories: Array<{id:string; title:string; evidenceRefs:string[]}>): DossierPresentationV1 {
  return {
    contractVersion: "dossier-presentation/1",
    dossierId: "dossier-1",
    previousDossierId: null,
    asOf: "2026-10-05T02:00:00.000Z",
    createdAt: "2026-10-05T02:00:00.000Z",
    health: { state:"healthy", degraded:false, repairUsed:false, freshnessWarnings:[], evidenceStates:[], researchGaps:[], missingInputCategories:[] },
    memory: { state:"AVAILABLE", structuralPredecessorId:null, analyticalBaselineId:null, analyticalBaselineAsOf:null, sameAsStructuralPredecessor:false },
    header: { headline:"Test", answer:"Test", regimeImplication:"Test", regimeFamily:"RATES_LED_TIGHTENING", epistemicLabel:"SUPPORTED", whatWouldChangeMind:"Test" },
    regimeStrip: [],
    policyOutlook: [],
    rateRegime: { state:"UNRESOLVED", nextMeetingRateOutlook:null, fedWatchExpectedDirection:null, trigger:null, observedRatePricing:null, observedConfirmation:null, usRatesReaction:null, usRatesInterpretation:null, fredBacked:false, evidenceRefs:[], gaps:[] },
    whatMattersNow: { leadThreadId:"thread", supportingStoryIds:stories.map(s=>s.id), stories:stories.map(s=>({ id:s.id,title:s.title,whatChanged:"",whyItMatters:"",mechanism:"",conclusion:"",whatWouldChangeMind:"",epistemicLabel:"SUPPORTED",evidenceRefs:s.evidenceRefs,investigationIds:[],chartIds:[] })) },
    watchNext: [],
    investigationAudit: [],
    investigationJourney: [],
    reactionCalibration: { evaluatedInvestigations:0,alignedInvestigations:0,divergentInvestigations:0,mixedInvestigations:0,unresolvedInvestigations:0,intradayInvestigations:0,expectationChangedInvestigations:0,reviewQueue:[] },
    researchNow: [],
    charts: { core:[], optional:[] },
    stockRadar: [],
    themes: [],
    creatorThemes: [],
    thesisChanges: [],
    evidenceIndex: [],
    diagnostics: { modelRepairUsed:false, notes:[], omittedOrDemotedItems:[] },
  };
}

test("Hybrid classifies canonical Story events without turning Motion into evidence", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: ai.id, title: ai.title, evidenceRefs:["ev-1"] }]),
    stories: [ai],
    events: [event({ impact:"amplifies" })],
    versions: [version(ai.id)],
  });
  assert.equal(result.storyClassifications[0].classification, "ACCELERATING");
  assert.equal(result.storyClassifications[0].canonicalEvidenceCount, 1);
  assert.equal(result.mutationBoundary.mode, "A3_QUEUE_ONLY");
});

test("rates-led and AI acceleration shifts only A toward B while preserving 100%", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: ai.id, title: ai.title, evidenceRefs:["ev-1"] }]),
    stories: [ai],
    events: [event({ impact:"amplifies" })],
    versions: [version(ai.id)],
  });
  const p = result.scenarios.current;
  assert.equal(Object.values(p).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(p.D, 8);
  assert.equal(p.E, 2);
  assert.ok(p.B > result.scenarios.starting.B);
  assert.ok(p.A < result.scenarios.starting.A);
});

test("global credit amplification shifts B toward C but cannot invent systemic or confidence-tail probability", () => {
  const credit = story("story-credit", "global-credit-transmission", "Global credit transmission");
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: credit.id, title: credit.title, evidenceRefs:["ev-credit"] }]),
    stories: [credit],
    events: [event({ story_id:credit.id, evidence_id:"ev-credit", impact:"amplifies" })],
    versions: [version(credit.id)],
  });
  assert.ok(result.scenarios.current.C > result.scenarios.starting.C);
  assert.equal(result.scenarios.current.D, 8);
  assert.equal(result.scenarios.current.E, 2);
  assert.equal(result.scenarios.guardedTails.length, 2);
});

test("historical Hybrid projection ignores Story events and versions after Dossier as-of", () => {
  const ai = story("story-ai", "ai-financing-stress", "AI financing stress");
  const lateEvent = event({ event_type:"invalidation", impact:"contradicts", event_at:"2026-10-06T01:00:00.000Z" });
  const lateVersion = { ...version(ai.id, "invalidated"), effective_at:"2026-10-06T01:00:00.000Z" };
  const result = buildHybridReasoningProjection({
    dossier: dossier([{ id: ai.id, title: ai.title, evidenceRefs:["ev-1"] }]),
    stories: [ai],
    events: [lateEvent],
    versions: [lateVersion],
  });
  assert.equal(result.storyClassifications[0].classification, "UNRESOLVED");
});
