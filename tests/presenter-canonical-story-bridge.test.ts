import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { DossierPresentationInvestigation } from "../lib/dossier-v2/presentation-adapter.ts";
import type { JourneyStorySource } from "../lib/intelligence/journey-briefing.ts";
import type { CanonicalStoryReasoningV1 } from "../lib/intelligence/story-reasoning.ts";
import {
  buildPresenterCanonicalStoryCase,
  buildPresenterCanonicalStoryCases,
  presenterStorySourcesFromEditionPayload,
  PRESENTER_CANONICAL_STORY_BRIDGE_VERSION,
} from "../lib/presenter-canonical-story-bridge.ts";

const STORY_ID = "story-rates";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

function reasoning(
  overrides: Partial<CanonicalStoryReasoningV1> = {},
): CanonicalStoryReasoningV1 {
  return {
    contractVersion: "canonical-story-reasoning/v1",
    storyId: STORY_ID,
    storyVersionId: VERSION_ID,
    versionNumber: 8,
    effectiveAt: "2026-10-05T03:00:00.000Z",
    title: "Long-end yields and financing conditions",
    centralQuestion: "Are long-end yields becoming a durable financing constraint?",
    lifecycle: "developing",
    confidence: 78,
    thesis: "Persistent long-end yields remain a restrictive financing constraint.",
    whatChanged: "Canonical evidence narrowed the transmission mechanism.",
    previousState: "Broad rates pressure was the dominant explanation.",
    currentState: "Long-end persistence is now the active constraint.",
    marketReaction: "Duration-sensitive assets remained pressured while long-end yields stayed elevated.",
    acceptedExplanation: "Persistent long-end yields continue to transmit through financing costs.",
    explanationCandidates: [
      {
        hypothesisId: "hyp-leading",
        mechanismCode: "UNKNOWN",
        statement: "Long-end yields keep financial conditions restrictive.",
        causalMechanism: "Higher long-end yields raise the cost of capital.",
        confidence: 78,
        evidenceForIds: ["ev-rates"],
        evidenceAgainstIds: [],
        isLeading: true,
      },
      {
        hypothesisId: "hyp-competing",
        mechanismCode: "PRICED_IN",
        statement: "The move is partly a repricing/positioning effect rather than a durable regime shift.",
        causalMechanism: "Prior positioning may exaggerate the immediate reaction.",
        confidence: 46,
        evidenceForIds: ["ev-positioning"],
        evidenceAgainstIds: ["ev-rates"],
        isLeading: false,
      },
    ],
    claims: [{
      id: "claim-rates",
      type: "fact",
      text: "Long-end yields remained elevated.",
      evidenceIds: ["ev-rates"],
    }],
    causalChain: [],
    countercase: {
      strongest: "A durable growth slowdown could pull long-end yields lower.",
      evidenceIds: [],
      weakestLink: null,
      marketMayBeRight: null,
    },
    overlookedVariable: {
      text: null,
      evidenceState: null,
      evidenceIds: [],
    },
    assetImplications: [],
    confirmation: ["Long-end yields remain elevated while financing conditions stay restrictive."],
    invalidation: ["Long-end yields fall materially and financing conditions ease."],
    nextTest: {
      id: "next-rates",
      label: "Check whether long-end yield pressure persists into the next session.",
      status: "upcoming",
      catalystRef: null,
      dueAt: null,
      expiresAt: null,
      evidenceIds: ["ev-rates"],
      resolutionEvidenceIds: [],
    },
    visualPlan: [],
    ...overrides,
  };
}

function source(
  overrides: Partial<JourneyStorySource> = {},
): JourneyStorySource {
  return {
    position: 1,
    publicationSnapshotId: "snapshot-rates",
    storyId: STORY_ID,
    thesisVersionId: VERSION_ID,
    reasoning: reasoning(),
    ...overrides,
  };
}

function investigation(
  overrides: Partial<DossierPresentationInvestigation> = {},
): DossierPresentationInvestigation {
  return {
    id: "inv-rates",
    status: "open",
    question: "Why did duration stay weak after the policy repricing?",
    whyItMatters: "The answer determines whether the pressure is structural or transient.",
    currentExplanation: "DOSSIER EXPLANATION MUST NOT OVERRIDE CANONICAL STORY REASONING.",
    expectedReaction: "Lower policy expectations should normally support duration.",
    observedReaction: "Duration remained weak while long-end yields stayed elevated.",
    divergence: "MATERIAL",
    competingExplanations: ["Dossier fallback competing explanation."],
    candidateExplanations: [],
    researchNext: "Dossier fallback: inspect the next session.",
    confirmationCondition: "Dossier fallback confirmation.",
    invalidationCondition: "Dossier fallback invalidation.",
    evidenceRefs: ["ev-rates"],
    missingEvidence: ["Positioning data", "Options gamma"],
    chartIds: [],
    storyIds: [STORY_ID],
    thesisIds: ["thesis:rates"],
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
      currentId: "inv-rates",
      previousId: "inv-rates",
      matchedBy: "id",
      transition: "DIVERGENCE_DETECTED",
      previousDivergence: "UNRESOLVED",
      currentDivergence: "MATERIAL",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Pre-tape: easing expectations should support duration.",
      currentExpectedReaction: "Lower policy expectations should normally support duration.",
      expectationChanged: false,
      question: "Why did duration stay weak after the policy repricing?",
    },
    ...overrides,
  };
}

test("P1.1 joins one exact Dossier investigation Story to one immutable canonical Story source", () => {
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source()],
  });

  assert.ok(result);
  assert.equal(result.contractVersion, PRESENTER_CANONICAL_STORY_BRIDGE_VERSION);
  assert.equal(result.investigationId, "inv-rates");
  assert.equal(result.storyId, STORY_ID);
  assert.equal(result.publicationSnapshotId, "snapshot-rates");
  assert.equal(result.thesisVersionId, VERSION_ID);
});

test("P1.1 preserves Dossier pre-tape expectation, observed reaction and divergence", () => {
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source()],
  });

  assert.ok(result);
  assert.equal(result.expectation.prior, "Pre-tape: easing expectations should support duration.");
  assert.equal(result.expectation.current, "Lower policy expectations should normally support duration.");
  assert.equal(result.expectation.changed, false);
  assert.equal(result.observedReaction, "Duration remained weak while long-end yields stayed elevated.");
  assert.equal(result.divergence, "MATERIAL");
});

test("P1.1 takes explanation, competing mechanisms and falsification from canonical Story reasoning", () => {
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source()],
  });

  assert.ok(result);
  assert.equal(
    result.currentExplanation,
    "Persistent long-end yields continue to transmit through financing costs.",
  );
  assert.equal(
    result.canonicalMarketReaction,
    "Duration-sensitive assets remained pressured while long-end yields stayed elevated.",
  );
  assert.equal(result.competingExplanations.length, 1);
  assert.equal(result.competingExplanations[0]?.hypothesisId, "hyp-competing");
  assert.deepEqual(result.competingExplanations[0]?.evidenceForIds, ["ev-positioning"]);
  assert.equal(
    result.whatToInspectNext.canonical,
    "Check whether long-end yield pressure persists into the next session.",
  );
  assert.deepEqual(result.confirmation.canonical, [
    "Long-end yields remain elevated while financing conditions stay restrictive.",
  ]);
  assert.deepEqual(result.invalidation.canonical, [
    "Long-end yields fall materially and financing conditions ease.",
  ]);

  assert.notEqual(
    result.currentExplanation,
    "DOSSIER EXPLANATION MUST NOT OVERRIDE CANONICAL STORY REASONING.",
  );
});

test("P2.3 exposes the exact canonical leading mechanism and accepted-explanation evidence", () => {
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source({
      reasoning: reasoning({
        claims: [
          {
            id: "claim-rates",
            type: "fact",
            text: "Long-end yields remained elevated.",
            evidenceIds: ["ev-rates"],
          },
          {
            id: "claim-accepted",
            type: "interpretation",
            text: "Persistent long-end yields continue to transmit through financing costs.",
            evidenceIds: ["ev-recruited-real-yield"],
          },
        ],
      }),
    })],
  });

  assert.ok(result);
  assert.equal(result.leadingExplanation?.hypothesisId, "hyp-leading");
  assert.deepEqual(result.leadingExplanation?.evidenceForIds, ["ev-rates"]);
  assert.equal(result.leadingExplanation?.causalMechanism, "Higher long-end yields raise the cost of capital.");
  assert.deepEqual(result.currentExplanationEvidenceIds, ["ev-recruited-real-yield"]);
  assert.equal(result.competingExplanations[0]?.hypothesisId, "hyp-competing");
});

test("P2.3 preserves canonical unresolved mechanism state instead of borrowing Dossier certainty", () => {
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation({
      currentExplanation: "Dossier claims one clean explanation.",
    }),
    storySources: [source({
      reasoning: reasoning({
        acceptedExplanation: null,
        claims: [{
          id: "claim-rates",
          type: "fact",
          text: "Long-end yields remained elevated.",
          evidenceIds: ["ev-rates"],
        }],
        explanationCandidates: [
          {
            hypothesisId: "hyp-leading",
            mechanismCode: "UNKNOWN",
            statement: "Long-end yields may be transmitting through financing costs.",
            causalMechanism: "Higher long-end yields raise the cost of capital.",
            confidence: 61,
            evidenceForIds: ["ev-rates"],
            evidenceAgainstIds: ["ev-positioning"],
            isLeading: true,
          },
          {
            hypothesisId: "hyp-competing",
            mechanismCode: "PRICED_IN",
            statement: "Positioning may still explain part of the move.",
            causalMechanism: "Prior positioning may exaggerate the immediate reaction.",
            confidence: 56,
            evidenceForIds: ["ev-positioning"],
            evidenceAgainstIds: [],
            isLeading: false,
          },
        ],
      }),
    })],
  });

  assert.ok(result);
  assert.equal(result.currentExplanation, null);
  assert.deepEqual(result.currentExplanationEvidenceIds, []);
  assert.equal(result.leadingExplanation?.hypothesisId, "hyp-leading");
  assert.equal(result.competingExplanations[0]?.hypothesisId, "hyp-competing");
  assert.notEqual(result.currentExplanation, "Dossier claims one clean explanation.");
});

test("P1.1 keeps Dossier research-next/confirmation/invalidation only as explicit fallback fields", () => {
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source()],
  });

  assert.ok(result);
  assert.equal(result.whatToInspectNext.dossierFallback, "Dossier fallback: inspect the next session.");
  assert.equal(result.confirmation.dossierFallback, "Dossier fallback confirmation.");
  assert.equal(result.invalidation.dossierFallback, "Dossier fallback invalidation.");
  assert.deepEqual(result.evidenceMissing, ["Positioning data", "Options gamma"]);
});

test("P1.1 does not use Dossier thesis-ledger IDs as canonical Story-version IDs", () => {
  const result = buildPresenterCanonicalStoryCase({
    investigation: investigation({
      thesisIds: ["thesis:not-a-story-version", VERSION_ID],
    }),
    storySources: [source()],
  });

  assert.ok(result);
  assert.equal(result.thesisVersionId, VERSION_ID);
});

test("P1.1 fails closed when investigation does not identify exactly one Story", () => {
  assert.equal(buildPresenterCanonicalStoryCase({
    investigation: investigation({ storyIds: [] }),
    storySources: [source()],
  }), null);

  assert.equal(buildPresenterCanonicalStoryCase({
    investigation: investigation({ storyIds: [STORY_ID, "story-other"] }),
    storySources: [source()],
  }), null);
});

test("P1.1 fails closed when exact immutable Story source is missing or ambiguous", () => {
  assert.equal(buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source({ storyId: "story-other" })],
  }), null);

  assert.equal(buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source(), source({ publicationSnapshotId: "snapshot-rates-duplicate" })],
  }), null);
});

test("P1.1 rejects Story source identity mismatches", () => {
  assert.equal(buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source({
      reasoning: reasoning({ storyId: "story-other" }),
    })],
  }), null);

  assert.equal(buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: [source({
      reasoning: reasoning({ storyVersionId: "55555555-5555-4555-8555-555555555555" }),
    })],
  }), null);
});

test("P1.1 batch projection omits unresolved joins rather than fuzzy matching", () => {
  const result = buildPresenterCanonicalStoryCases({
    investigations: [
      investigation(),
      investigation({
        id: "inv-no-story",
        storyIds: [],
        question: "No exact Story identity",
      }),
    ],
    storySources: [source()],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.investigationId, "inv-rates");
});

test("P1.1 bridge is pure, read-only and contains no model or persistence path", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const sourceText = fs.readFileSync(
    path.join(root, "lib", "presenter-canonical-story-bridge.ts"),
    "utf8",
  );

  assert.doesNotMatch(sourceText, /runIntelligenceEngine|executeResearchBrain|responses\.create|chat\.completions/i);
  assert.doesNotMatch(sourceText, /intelligenceRest|supabase|insert\s+into|update\s+public\./i);
  assert.doesNotMatch(sourceText, /apply_intelligence_story_assessment_v2/);
  assert.doesNotMatch(sourceText, /persist_canonical_story_reasoning/);
});


test("P1.2 recovers exact immutable Journey Story sources from the selected edition manifest", () => {
  const sources = presenterStorySourcesFromEditionPayload({
    canonicalStoryManifest: [{
      position: 1,
      snapshotId: "snapshot-rates",
      storyId: STORY_ID,
      thesisVersionId: VERSION_ID,
      state: { id: STORY_ID },
      reasoning: reasoning(),
    }],
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.publicationSnapshotId, "snapshot-rates");
  assert.equal(sources[0]?.storyId, STORY_ID);
  assert.equal(sources[0]?.thesisVersionId, VERSION_ID);
  assert.equal(sources[0]?.reasoning.storyVersionId, VERSION_ID);
});

test("P1.2 ignores malformed, cross-Story and cross-version manifest reasoning", () => {
  const sources = presenterStorySourcesFromEditionPayload({
    canonicalStoryManifest: [
      {
        position: 1,
        snapshotId: "missing-reasoning",
        storyId: STORY_ID,
        thesisVersionId: VERSION_ID,
      },
      {
        position: 2,
        snapshotId: "wrong-story",
        storyId: STORY_ID,
        thesisVersionId: VERSION_ID,
        reasoning: reasoning({ storyId: "story-other" }),
      },
      {
        position: 3,
        snapshotId: "wrong-version",
        storyId: STORY_ID,
        thesisVersionId: VERSION_ID,
        reasoning: reasoning({ storyVersionId: "55555555-5555-4555-8555-555555555555" }),
      },
    ],
  });

  assert.deepEqual(sources, []);
});

test("P1.2 edition source recovery never consults mutable Story/version persistence", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const sourceText = fs.readFileSync(
    path.join(root, "lib", "presenter-canonical-story-bridge.ts"),
    "utf8",
  );
  const start = sourceText.indexOf("export function presenterStorySourcesFromEditionPayload");
  const end = sourceText.indexOf("export function buildPresenterCanonicalStoryCases", start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const section = sourceText.slice(start, end);

  assert.match(section, /canonicalStoryManifest/);
  assert.match(section, /entry\.reasoning/);
  assert.doesNotMatch(section, /stories\?/);
  assert.doesNotMatch(section, /story_thesis_versions/);
  assert.doesNotMatch(section, /fetch\(/);
  assert.doesNotMatch(section, /intelligenceRest|supabase/i);
});
