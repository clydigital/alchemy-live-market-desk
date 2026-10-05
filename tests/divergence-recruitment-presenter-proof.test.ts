import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAutomaticResearchGapRun,
  type CompletedResearchGapResult,
} from "../lib/research-gap-auto-handoff.ts";
import {
  attachResearchGapHandoffToItems,
  parseResearchGapHandoffContext,
} from "../lib/research-gap-handoff.ts";
import type { DossierPresentationInvestigation } from "../lib/dossier-v2/presentation-adapter.ts";
import type { JourneyStorySource } from "../lib/intelligence/journey-briefing.ts";
import {
  buildCanonicalStoryReasoningSnapshotV1,
  materialiseCanonicalStoryReasoningV1,
  type ImmutableStoryVersionV1,
  type StoryReasoningEvidence,
} from "../lib/intelligence/story-reasoning.ts";
import {
  buildPresenterCanonicalStoryCase,
} from "../lib/presenter-canonical-story-bridge.ts";

const STORY_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const REAL_YIELD_EVIDENCE_ID = "33333333-3333-4333-8333-333333333333";
const POSITIONING_EVIDENCE_ID = "44444444-4444-4444-8444-444444444444";

function completedGapResult(): CompletedResearchGapResult {
  return {
    gateRunId: "p2-3-divergence-proof",
    gapId: "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    affectedStorySlugs: ["rates-duration-stress"],
    researchQuestion: "Did real yields or positioning explain the post-release divergence?",
    priorExpectation: "Softer inflation should lower real yields and support duration-sensitive assets.",
    finding: "The official real-yield series fell during the divergence window.",
    confidence: 88,
    outcome: "CONFIRMING",
    remainsUnknown: [],
    liveImplication: "Real-yield transmission now has direct canonical support.",
    nextTest: "Check whether the real-yield move persists into the next session.",
    completedAt: "2026-10-05T06:00:00.000Z",
    evidence: [{
      sourceId: "fred-dfii10",
      itemType: "news",
      publisher: "Federal Reserve Bank of St. Louis",
      title: "10-Year Treasury Inflation-Indexed Security, Constant Maturity",
      url: "https://fred.stlouisfed.org/series/DFII10",
      publishedAt: "2026-10-05T05:30:00.000Z",
      claim: "The 10-year real yield fell during the measured divergence window.",
      summary: "Official real-yield evidence for the divergence discriminator.",
      sourceQuality: 100,
      relevance: 100,
      novelty: 85,
      materiality: 92,
    }],
  };
}

function investigation(): DossierPresentationInvestigation {
  return {
    id: "inv-rates-divergence",
    status: "open",
    question: "Why did the tape diverge from the pre-release expectation?",
    whyItMatters: "The mechanism determines whether the move is macro transmission or positioning noise.",
    currentExplanation: "Dossier fallback explanation must not override canonical reasoning.",
    expectedReaction: "Softer inflation should lower real yields.",
    observedReaction: "Duration-sensitive assets rallied while real yields fell.",
    divergence: "MATERIAL",
    competingExplanations: ["Positioning may still matter."],
    candidateExplanations: [],
    researchNext: "Inspect real yields and positioning.",
    confirmationCondition: "Real yields remain lower.",
    invalidationCondition: "Real yields reverse higher.",
    evidenceRefs: [],
    missingEvidence: [],
    chartIds: [],
    storyIds: [STORY_ID],
    thesisIds: ["dossier-thesis-rates"],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "DIVERGENT",
      precision: "INTRADAY",
      checkCount: 1,
      alignedCount: 0,
      divergentCount: 1,
      reactionWindows: ["30m"],
      expectationChanged: false,
      requiresReview: true,
    },
    journey: {
      currentId: "inv-rates-divergence",
      previousId: "inv-rates-divergence",
      matchedBy: "id",
      transition: "DIVERGENCE_DETECTED",
      previousDivergence: "UNRESOLVED",
      currentDivergence: "MATERIAL",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Softer inflation should lower real yields.",
      currentExpectedReaction: "Softer inflation should lower real yields.",
      expectationChanged: false,
      question: "Why did the tape diverge from the pre-release expectation?",
    },
  };
}

function storySource(input: {
  acceptedExplanation: string | null;
  acceptedExplanationEvidenceIds: string[];
  competing: boolean;
}): JourneyStorySource {
  const evidence: StoryReasoningEvidence[] = [
    {
      id: REAL_YIELD_EVIDENCE_ID,
      claim: "The 10-year real yield fell during the measured divergence window.",
    },
    ...(input.competing ? [{
      id: POSITIONING_EVIDENCE_ID,
      claim: "Positioning data still shows a meaningful short-covering contribution.",
    }] : []),
  ];
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  const snapshot = buildCanonicalStoryReasoningSnapshotV1({
    synthesis: {
      lifecycleStatus: "developing",
      thesis: input.competing
        ? "The divergence remains split between real-yield transmission and positioning."
        : "Lower real yields now provide the best-supported explanation for the divergence.",
      whatChanged: "Research Gap evidence returned through canonical intake.",
      previousState: "The causal mechanism was unresolved.",
      currentState: input.competing
        ? "Two mechanisms remain supported."
        : "Real-yield transmission is now the leading supported mechanism.",
      marketReaction: "Duration-sensitive assets rallied while real yields fell.",
      acceptedExplanation: input.acceptedExplanation,
      acceptedExplanationEvidenceIds: input.acceptedExplanationEvidenceIds,
      overlookedVariable: null,
      overlookedVariableEvidenceStatus: null,
      overlookedVariableEvidenceIds: [],
      marketMayBeRight: null,
      decisiveEvidenceIds: [REAL_YIELD_EVIDENCE_ID],
    },
    hypothesis: {
      id: "hyp-real-yield",
      statement: "Lower real yields explain the divergence.",
      mechanism: "Lower real yields reduce discount-rate pressure on duration-sensitive assets.",
      mechanismCode: "REAL_YIELD",
      confidence: input.competing ? 64 : 84,
      evidenceForIds: [REAL_YIELD_EVIDENCE_ID],
      evidenceAgainstIds: input.competing ? [POSITIONING_EVIDENCE_ID] : [],
      causalChain: [{
        from: "Lower real yields",
        relationship: "reduce",
        to: "discount-rate pressure",
        evidenceState: "strongly_supported",
        evidenceIds: [REAL_YIELD_EVIDENCE_ID],
      }],
      confirmationCriteria: ["Real yields remain lower into the next session."],
      invalidationCriteria: ["Real yields reverse materially higher."],
    },
    competingHypotheses: input.competing ? [{
      id: "hyp-positioning",
      statement: "Positioning still contributes materially to the move.",
      mechanism: "Short covering can amplify the initial reaction independently of macro transmission.",
      mechanismCode: "SHORT_COVERING",
      confidence: 58,
      evidenceForIds: [POSITIONING_EVIDENCE_ID],
      evidenceAgainstIds: [REAL_YIELD_EVIDENCE_ID],
      causalChain: [],
      confirmationCriteria: ["The move fades as positioning normalises."],
      invalidationCriteria: ["The move persists with supportive real-yield evidence."],
    }] : [],
    challenger: null,
    scenarios: [],
    evidenceById,
  });

  const version: ImmutableStoryVersionV1 = {
    id: VERSION_ID,
    story_id: STORY_ID,
    version_number: 9,
    effective_at: "2026-10-05T06:15:00.000Z",
    title: "Rates divergence mechanism",
    market_question: "What explains the divergence?",
    status: "develop",
    confidence: input.competing ? 64 : 84,
    thesis: input.competing
      ? "The divergence remains split between real-yield transmission and positioning."
      : "Lower real yields now provide the best-supported explanation for the divergence.",
    snapshot: { reasoning: snapshot },
  };

  const reasoning = materialiseCanonicalStoryReasoningV1(version);
  assert.ok(reasoning);

  return {
    position: 1,
    publicationSnapshotId: "snapshot-rates-p2-3",
    storyId: STORY_ID,
    thesisVersionId: VERSION_ID,
    reasoning,
  };
}

test("P2.3 recruited evidence re-enters through canonical Research Gap intake rather than Presenter", () => {
  const run = buildAutomaticResearchGapRun(completedGapResult());
  assert.equal(run.items.length, 1);
  assert.equal(run.items[0]?.recommendedAction, "collect_evidence");
  assert.equal(run.handoff?.gapId, "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

  assert.ok(run.handoff);
  const [attached] = attachResearchGapHandoffToItems(run.handoff, run.items);
  const context = parseResearchGapHandoffContext(attached?.divergenceNote);
  assert.equal(context?.kind, "research_gap_gate");
  assert.equal(context?.finding, "The official real-yield series fell during the divergence window.");

  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  assert.match(runtime, /const gapHandoff = parseResearchGapHandoffContext\(item\.divergence_note\)/);
  assert.match(runtime, /evidenceNature: gapHandoff \? "research_gap_handoff"/);
  assert.match(runtime, /"intelligence_evidence\?on_conflict=source_id,content_hash"/);
  assert.match(runtime, /return canonicalEvidence\.map\(\(evidence\) => evidence\.id\)/);
  assert.match(runtime, /const requiredEvidenceIds = unique\(\[[\s\S]*\.\.\.canonicalisedEvidenceIds/);
});

test("P2.3 resolved recruited evidence reaches Presenter as exact canonical explanation and mechanism evidence", () => {
  const accepted = "Lower real yields now best explain the divergence.";
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [storySource({
      acceptedExplanation: accepted,
      acceptedExplanationEvidenceIds: [REAL_YIELD_EVIDENCE_ID],
      competing: false,
    })],
  });

  assert.ok(result);
  assert.equal(result.currentExplanation, accepted);
  assert.deepEqual(result.currentExplanationEvidenceIds, [REAL_YIELD_EVIDENCE_ID]);
  assert.equal(result.leadingExplanation?.mechanismCode, "REAL_YIELD");
  assert.deepEqual(result.leadingExplanation?.evidenceForIds, [REAL_YIELD_EVIDENCE_ID]);
  assert.deepEqual(result.competingExplanations, []);
});

test("P2.3 unresolved recruited evidence preserves both canonical mechanisms without Presenter cleanup", () => {
  const unresolved = "Current canonical evidence does not yet discriminate between real-yield transmission and positioning.";
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [storySource({
      acceptedExplanation: unresolved,
      acceptedExplanationEvidenceIds: [REAL_YIELD_EVIDENCE_ID, POSITIONING_EVIDENCE_ID],
      competing: true,
    })],
  });

  assert.ok(result);
  assert.equal(result.currentExplanation, unresolved);
  assert.deepEqual(
    result.currentExplanationEvidenceIds,
    [REAL_YIELD_EVIDENCE_ID, POSITIONING_EVIDENCE_ID],
  );
  assert.equal(result.leadingExplanation?.hypothesisId, "hyp-real-yield");
  assert.deepEqual(result.leadingExplanation?.evidenceAgainstIds, [POSITIONING_EVIDENCE_ID]);
  assert.equal(result.competingExplanations.length, 1);
  assert.equal(result.competingExplanations[0]?.hypothesisId, "hyp-positioning");
  assert.deepEqual(result.competingExplanations[0]?.evidenceForIds, [POSITIONING_EVIDENCE_ID]);
});

test("P2.3 Presenter proof introduces no reasoning, acquisition or persistence path", () => {
  const bridge = readFileSync(new URL("../lib/presenter-canonical-story-bridge.ts", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/live-desk/PresenterDivergenceJourney.tsx", import.meta.url), "utf8");
  const combined = bridge + "\n" + component;

  assert.doesNotMatch(combined, /runStructuredStage|runIntelligenceEngine|executeResearchBrain/);
  assert.doesNotMatch(combined, /\/api\/research-gap|\/api\/admin\/research-gap/);
  assert.doesNotMatch(combined, /intelligenceRest|persistCanonicalStoryReasoning|apply_intelligence_story_assessment_v2/);
});
