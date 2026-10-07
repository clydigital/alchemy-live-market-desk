import assert from "node:assert/strict";
import test from "node:test";

import type { Story } from "../lib/data.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import { buildD7CrossLayerDivergence } from "../lib/dossier-v2/cross-layer-divergence.ts";
import {
  appendD7ResearchGapCandidates,
  buildD7ResearchGapCandidates,
} from "../lib/d7-research-gap-routing.ts";
import { buildHybridReasoningProjection } from "../lib/hybrid-reasoning-projection.ts";
import type {
  StoryEvent,
  StoryThesisVersion,
} from "../lib/persistence/contracts.ts";
import {
  decideResearchGapDiscriminatorLifecycle,
} from "../lib/research-gap-discriminator-lifecycle.ts";
import { prioritiseResearchGapWork } from "../lib/research-gap-prioritizer.ts";
import type {
  ResearchGapCausalDiscriminatorPlan,
  ResearchGapWorkQueue,
} from "../lib/research-gap-worker.ts";
import { buildRegimeProjection } from "../lib/regimes.ts";

const STORY_ID = "11111111-1111-4111-8111-111111111111";
const DOSSIER_ID = "22222222-2222-4222-8222-222222222222";
const AS_OF = "2026-10-06T00:00:00.000Z";

function story(): Story {
  return {
    id: STORY_ID,
    slug: "treasury-duration-refinancing-stress",
    title: "Treasury duration and refinancing stress",
    thesis:
      "Treasury issuance and long-end duration pressure keep borrowing costs elevated and transmit into credit refinancing stress.",
    status: "publish",
    confidence: 82,
    rank: 1,
    market_question:
      "Are long-end Treasury yields transmitting into borrowing costs and credit spreads?",
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
    assets: ["US10Y", "US30Y", "HY", "IG"],
    source_quality: 85,
    novelty: 60,
    persistence: 90,
    trader_relevance: 90,
    article_potential: 75,
  };
}

function version(): StoryThesisVersion {
  return {
    id: "version-rates-2",
    story_id: STORY_ID,
    event_id: null,
    version_number: 2,
    title: "Treasury duration and refinancing stress",
    thesis:
      "Treasury issuance and long-end duration pressure keep borrowing costs elevated and transmit into credit refinancing stress.",
    status: "publish",
    confidence: 82,
    market_question:
      "Are long-end Treasury yields transmitting into borrowing costs and credit spreads?",
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
    assets: ["US10Y", "US30Y", "HY", "IG"],
    portfolio_map: {},
    snapshot: {
      reasoning: {
        contractVersion: "canonical-story-reasoning/v1",
      },
    },
    change_reason: "Canonical prior thesis version.",
    effective_at: "2026-10-05T20:00:00.000Z",
    created_at: "2026-10-05T20:00:00.000Z",
    created_by: null,
  };
}

function contradictingEvent(): StoryEvent {
  return {
    id: "event-rates-contradiction",
    story_id: STORY_ID,
    source_id: null,
    evidence_id: "ev:credit-easing",
    observation_id: null,
    research_run_id: null,
    legacy_update_id: null,
    event_type: "contradiction",
    headline: "Credit spreads ease despite persistent long-end yields",
    detail:
      "Canonical market evidence contradicts the current transmission thesis.",
    impact: "contradicts",
    confidence_delta: -8,
    event_at: "2026-10-05T23:30:00.000Z",
    recorded_at: "2026-10-05T23:31:00.000Z",
    metadata: {},
    created_by: null,
  };
}

function dossier(): DossierPresentationV1 {
  return {
    contractVersion: "dossier-presentation/1",
    dossierId: DOSSIER_ID,
    previousDossierId: "11111111-2222-4333-8444-555555555555",
    asOf: AS_OF,
    createdAt: AS_OF,
    health: {
      state: "healthy",
      degraded: false,
      repairUsed: false,
      freshnessWarnings: [],
      evidenceStates: [],
      researchGaps: [],
      missingInputCategories: [],
    },
    memory: {
      state: "AVAILABLE",
      structuralPredecessorId: null,
      analyticalBaselineId: null,
      analyticalBaselineAsOf: null,
      sameAsStructuralPredecessor: false,
    },
    header: {
      headline: "Rates remain restrictive",
      answer: "Long-end rates remain the dominant constraint.",
      regimeImplication: "RATES_LED_TIGHTENING",
      regimeFamily: "RATES_LED_TIGHTENING",
      epistemicLabel: "SUPPORTED",
      whatWouldChangeMind: "A durable easing in yields and credit conditions.",
    },
    regimeStrip: [],
    policyOutlook: [],
    rateRegime: {
      state: "HAWKISH",
      nextMeetingRateOutlook: null,
      fedWatchExpectedDirection: null,
      trigger: null,
      observedRatePricing: null,
      observedConfirmation: null,
      usRatesReaction: null,
      usRatesInterpretation: null,
      fredBacked: true,
      evidenceRefs: ["ev:rates-high"],
      gaps: [],
    },
    whatMattersNow: {
      leadThreadId: "thread:rates",
      supportingStoryIds: ["story:rates-analytical"],
      stories: [{
        id: "story:rates-analytical",
        persistentStoryId: STORY_ID,
        title: "Rates duration stress",
        whatChanged: "Long-end yields remain restrictive.",
        whyItMatters: "Borrowing costs remain high.",
        mechanism: "Treasury supply → yields → borrowing costs → credit.",
        conclusion: "The Dossier still sees rates-led tightening.",
        whatWouldChangeMind: "Credit and long-end yields ease together.",
        epistemicLabel: "SUPPORTED",
        evidenceRefs: ["ev:rates-high", "ev:dossier-credit-tight"],
        investigationIds: ["inv:rates-transmission"],
        chartIds: [],
      }],
    },
    watchNext: [],
    investigationAudit: [],
    investigationJourney: [],
    reactionCalibration: {
      evaluatedInvestigations: 0,
      alignedInvestigations: 0,
      divergentInvestigations: 0,
      mixedInvestigations: 0,
      unresolvedInvestigations: 0,
      intradayInvestigations: 0,
      expectationChangedInvestigations: 0,
      reviewQueue: [],
    },
    researchNow: [],
    charts: { core: [], optional: [] },
    stockRadar: [],
    themes: [],
    creatorThemes: [],
    thesisChanges: [],
    evidenceIndex: [],
    evidenceSufficiency: {
      contractVersion: "dossier-evidence-sufficiency/1",
      stories: [{
        analyticalStoryId: "story:rates-analytical",
        persistentStoryId: STORY_ID,
        direction: "STRENGTHEN",
        activeSupportingEvidenceRefs: [
          "ev:rates-high",
          "ev:dossier-credit-tight",
        ],
        activeContradictingEvidenceRefs: [],
        newSupportingEvidenceRefs: ["ev:dossier-credit-tight"],
        newContradictingEvidenceRefs: [],
        acceleratingEvidenceRefs: [],
        supersededSupportingEvidenceRefs: [],
        blockers: [],
        highConfidenceBlocked: false,
        reason: "New active canonical supporting evidence was added.",
      }],
      diagnostics: { policy: [] },
    },
    longitudinalAdjudication: {
      basis: "EXACT_PRIOR_DOSSIER",
      previousDossierId: "11111111-2222-4333-8444-555555555555",
      reactionOutcome: "UNRESOLVED",
      evaluatedExpectations: 0,
      alignedExpectations: 0,
      divergentExpectations: 0,
      unresolvedExpectations: 0,
      storyChanges: [],
    },
    diagnostics: {
      modelRepairUsed: false,
      notes: [],
      omittedOrDemotedItems: [],
    },
  } as DossierPresentationV1;
}

function emptyQueue(): ResearchGapWorkQueue {
  return {
    contractVersion: "research-gap-work-queue/1",
    generatedAt: AS_OF,
    dossierId: DOSSIER_ID,
    dossierAsOf: AS_OF,
    candidates: [],
    sourceCounts: {
      researchGaps: 0,
      researchNow: 0,
      investigations: 0,
      marketMotion: 0,
    },
    diagnostics: {
      needsPrioritisation: true,
      truncated: false,
      omittedCandidates: 0,
      excludedResolvedInvestigations: 0,
      notes: [],
    },
  };
}

test("D1-D7 proof: exact Story flows through Regime and Hybrid into D7 and the ordinary Research Gap queue", () => {
  const currentStory = story();
  const currentVersion = version();
  const currentEvent = contradictingEvent();
  const currentDossier = dossier();

  const regimes = buildRegimeProjection({
    stories: [currentStory],
    events: [currentEvent],
    versions: [currentVersion],
    newsThreads: [],
    statements: [],
    dossier: currentDossier,
  });

  const rateRegime = regimes.find(
    (item) => item.slug === "global-cost-of-capital",
  );
  assert.ok(rateRegime);
  const projectedStory = rateRegime.stories.find(
    (item) => item.id === STORY_ID,
  );
  assert.ok(projectedStory);
  assert.equal(projectedStory.contributesToState, true);

  const hybrid = buildHybridReasoningProjection({
    dossier: currentDossier,
    stories: [currentStory],
    events: [currentEvent],
    versions: [currentVersion],
  });

  assert.equal(hybrid.storyClassifications.length, 1);
  assert.equal(hybrid.storyClassifications[0].storyId, STORY_ID);
  assert.equal(
    hybrid.storyClassifications[0].classification,
    "CONTRADICTING",
  );
  assert.equal(
    hybrid.scenarios.transfers.some(
      (item) => item.donor === "A" && item.recipient === "B",
    ),
    true,
  );

  const d7 = buildD7CrossLayerDivergence({
    dossier: currentDossier,
    hybrid,
    regimes,
  });

  const dossierStory = d7.cases.find(
    (item) => item.pair === "DOSSIER_STORY",
  );
  assert.ok(dossierStory);
  assert.equal(dossierStory.persistentStoryId, STORY_ID);
  assert.equal(dossierStory.state, "LAG");
  assert.equal(dossierStory.severity, "MEDIUM");
  assert.equal(
    dossierStory.researchEligible,
    false,
    "Dossier→Story synchronization belongs to A3 Story review, not web Research Gap",
  );

  const storyRegime = d7.cases.find(
    (item) =>
      item.pair === "STORY_REGIME"
      && item.persistentStoryId === STORY_ID,
  );
  assert.ok(storyRegime);
  assert.equal(storyRegime.state, "LAG");
  assert.equal(storyRegime.researchEligible, true);

  const d7Candidates = buildD7ResearchGapCandidates({
    dossierId: DOSSIER_ID,
    dossierAsOf: AS_OF,
    snapshot: d7,
  });
  assert.ok(d7Candidates.length >= 1);
  assert.equal(
    d7Candidates.some((item) => item.sourceRef === `d7:${dossierStory.id}`),
    false,
  );

  const regimeCandidate = d7Candidates.find(
    (item) => item.sourceRef === `d7:${storyRegime.id}`,
  );
  assert.ok(regimeCandidate);
  assert.deepEqual(regimeCandidate.linkedStoryIds, [STORY_ID]);
  assert.ok(
    regimeCandidate.blockingRefs.includes(`STORY:${STORY_ID}`),
  );
  assert.ok(
    regimeCandidate.blockingRefs.includes("REGIME:CURRENT"),
  );
  assert.equal(regimeCandidate.evidenceNeeded.length, 1);

  const queue = appendD7ResearchGapCandidates(
    emptyQueue(),
    d7Candidates,
  );
  const priority = prioritiseResearchGapWork(queue);

  assert.equal(priority.selected.length > 0, true);
  assert.equal(
    priority.selected[0].gapKey,
    regimeCandidate.gapKey,
  );
  assert.equal(
    priority.selected[0].nativeSignals.gapClass,
    "REFINEMENT",
  );
});

test("same canonical inputs replay deterministically across Hybrid, D7 and Research Gap identity", () => {
  const currentStory = story();
  const currentVersion = version();
  const currentEvent = contradictingEvent();
  const currentDossier = dossier();

  const regimes = buildRegimeProjection({
    stories: [currentStory],
    events: [currentEvent],
    versions: [currentVersion],
    newsThreads: [],
    statements: [],
    dossier: currentDossier,
  });

  const firstHybrid = buildHybridReasoningProjection({
    dossier: currentDossier,
    stories: [currentStory],
    events: [currentEvent],
    versions: [currentVersion],
  });
  const secondHybrid = buildHybridReasoningProjection({
    dossier: currentDossier,
    stories: [currentStory],
    events: [currentEvent],
    versions: [currentVersion],
  });
  assert.deepEqual(firstHybrid.scenarios, secondHybrid.scenarios);

  const firstD7 = buildD7CrossLayerDivergence({
    dossier: currentDossier,
    hybrid: firstHybrid,
    regimes,
  });
  const secondD7 = buildD7CrossLayerDivergence({
    dossier: currentDossier,
    hybrid: secondHybrid,
    regimes,
  });
  assert.deepEqual(firstD7, secondD7);

  const firstGap = buildD7ResearchGapCandidates({
    dossierId: DOSSIER_ID,
    dossierAsOf: AS_OF,
    snapshot: firstD7,
  });
  const secondGap = buildD7ResearchGapCandidates({
    dossierId: DOSSIER_ID,
    dossierAsOf: AS_OF,
    snapshot: secondD7,
  });
  assert.deepEqual(firstGap, secondGap);
});

test("existing Research Gap sequential discriminator lifecycle advances only after canonical handoff", () => {
  const plan: ResearchGapCausalDiscriminatorPlan = {
    contractVersion: "research-gap-causal-discriminator/1",
    planSignature: "rates-transmission-plan-v1",
    baseEvidenceNeeded: ["Current HY/IG spread state"],
    discriminators: [
      "Compare credit spreads with persistent long-end yield pressure.",
      "Check lending/refinancing evidence if spreads do not discriminate.",
    ],
  };

  const initial = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan,
  });
  assert.equal(initial.transition, "INITIAL");
  assert.equal(initial.lifecycle.activeIndex, 0);
  assert.equal(initial.shouldRequeue, false);

  const blockedAdvance = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan,
    existingStatus: "HANDED_OFF",
    existingResearchPlan: {
      causalDiscriminator: initial.lifecycle,
    },
    canonicalHandoffAdmitted: false,
  });
  assert.equal(blockedAdvance.transition, "PRESERVE");
  assert.equal(blockedAdvance.lifecycle.activeIndex, 0);

  const advanced = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan,
    existingStatus: "HANDED_OFF",
    existingResearchPlan: {
      causalDiscriminator: initial.lifecycle,
    },
    canonicalHandoffAdmitted: true,
  });
  assert.equal(advanced.transition, "ADVANCE");
  assert.equal(advanced.lifecycle.activeIndex, 1);
  assert.equal(advanced.shouldRequeue, true);

  const exhausted = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan,
    existingStatus: "HANDED_OFF",
    existingResearchPlan: {
      causalDiscriminator: advanced.lifecycle,
    },
    canonicalHandoffAdmitted: true,
  });
  assert.equal(exhausted.transition, "EXHAUST");
  assert.equal(exhausted.shouldClose, true);
  assert.equal(exhausted.shouldRequeue, false);
});
