import assert from "node:assert/strict";
import test from "node:test";

import type { DossierPresentationInvestigation } from "../lib/dossier-v2/presentation-adapter.ts";
import { buildDivergenceLabPresentation } from "../lib/divergence-lab-presentation.ts";

function investigation(
  overrides: Partial<DossierPresentationInvestigation> = {},
): DossierPresentationInvestigation {
  return {
    id: "inv-1",
    status: "open",
    question: "Why did the tape not transmit as expected?",
    whyItMatters: "The mechanism changes the next market test.",
    currentExplanation: "Transmission remains incomplete.",
    expectedReaction: "Credit should weaken as yields rise.",
    observedReaction: "Yields rose while credit stayed contained.",
    divergence: "UNRESOLVED",
    competingExplanations: [
      "Concentrated leadership is masking transmission.",
      "Credit may lag the rates move.",
    ],
    candidateExplanations: [],
    researchNext: "Compare MOVE, credit, breadth and global duration.",
    confirmationCondition: "Credit and volatility weaken with breadth.",
    invalidationCondition: "Credit remains contained while yields stay high.",
    evidenceRefs: ["ev-rates", "ev-credit"],
    missingEvidence: ["MOVE"],
    chartIds: [],
    storyIds: [],
    thesisIds: [],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "UNRESOLVED",
      precision: "NONE",
      checkCount: 0,
      alignedCount: 0,
      divergentCount: 0,
      reactionWindows: [],
      expectationChanged: false,
      requiresReview: false,
    },
    journey: {
      currentId: "inv-1",
      previousId: "inv-1",
      matchedBy: "id",
      transition: "UNCHANGED",
      previousDivergence: "UNRESOLVED",
      currentDivergence: "UNRESOLVED",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Credit should weaken as yields rise.",
      currentExpectedReaction: "Credit should weaken as yields rise.",
      expectationChanged: false,
      question: "Why did the tape not transmit as expected?",
    },
    ...overrides,
  };
}

test("unresolved investigation without structured candidates stays compact", () => {
  const result = buildDivergenceLabPresentation(investigation());

  assert.equal(result.mode, "compact_unresolved");
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.alternatives.map((item) => item.explanation), [
    "Concentrated leadership is masking transmission.",
    "Credit may lag the rates move.",
  ]);
  assert.equal(result.sharedDiscriminator, "Compare MOVE, credit, breadth and global duration.");
});

test("unresolved zero-evidence structured candidates are compact rather than rendered as a full Lab", () => {
  const source = investigation({
    candidateExplanations: [
      {
        rank: 1,
        explanation: "Leadership masks transmission.",
        evidenceForRefs: [],
        evidenceAgainstRefs: [],
        confidence: "UNRESOLVED",
        discriminatingTest: "Compare MOVE, credit, breadth and global duration.",
      },
      {
        rank: 2,
        explanation: "Credit lags the rates move.",
        evidenceForRefs: [],
        evidenceAgainstRefs: [],
        confidence: "UNRESOLVED",
        discriminatingTest: "Compare MOVE, credit, breadth and global duration.",
      },
    ],
  });

  const result = buildDivergenceLabPresentation(source);

  assert.equal(result.mode, "compact_unresolved");
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(result.alternatives.map((item) => item.explanation), [
    "Leadership masks transmission.",
    "Credit lags the rates move.",
  ]);
  assert.equal(result.sharedDiscriminator, "Compare MOVE, credit, breadth and global duration.");
});

test("unresolved investigation with structured evidence still stays compact unresolved", () => {
  const result = buildDivergenceLabPresentation(investigation({
    candidateExplanations: [
      {
        rank: 1,
        explanation: "Leadership is delaying broader transmission.",
        evidenceForRefs: ["ev-credit"],
        evidenceAgainstRefs: [],
        confidence: "LOW",
        discriminatingTest: "Compare breadth and credit persistence.",
      },
    ],
  }));

  assert.equal(result.mode, "compact_unresolved");
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.alternatives.map((item) => item.explanation), [
    "Leadership is delaying broader transmission.",
  ]);
});

test("material investigation with real persisted candidates keeps the full Lab", () => {
  const source = investigation({
    divergence: "MATERIAL",
    candidateExplanations: [
      {
        rank: 1,
        explanation: "The event was already priced.",
        evidenceForRefs: ["ev-rates"],
        evidenceAgainstRefs: ["ev-credit"],
        confidence: "MEDIUM",
        discriminatingTest: "Check next-session rates and dollar persistence.",
      },
      {
        rank: 2,
        explanation: "Positioning amplified the reversal.",
        evidenceForRefs: [],
        evidenceAgainstRefs: ["ev-rates"],
        confidence: "LOW",
        discriminatingTest: "Check whether the reversal fades without new flow evidence.",
      },
    ],
  });

  const result = buildDivergenceLabPresentation(source);

  assert.equal(result.mode, "full");
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].displayDiscriminator, "Check next-session rates and dollar persistence.");
  assert.equal(result.candidates[1].displayDiscriminator, "Check whether the reversal fades without new flow evidence.");
});

test("legacy material divergence without structured candidates stays compact and does not invent a Lab", () => {
  const result = buildDivergenceLabPresentation(investigation({
    divergence: "MATERIAL",
    candidateExplanations: [],
  }));

  assert.equal(result.mode, "compact_legacy");
  assert.deepEqual(result.candidates, []);
  assert.equal(result.alternatives.length, 2);
});

test("identical candidate discriminators collapse to one shared investigation-level discriminator", () => {
  const shared = "Compare the next catalyst with rates, dollar and breadth.";
  const result = buildDivergenceLabPresentation(investigation({
    divergence: "MATERIAL",
    researchNext: shared,
    candidateExplanations: [
      {
        rank: 1,
        explanation: "Pricing was already embedded.",
        evidenceForRefs: ["ev-rates"],
        evidenceAgainstRefs: [],
        confidence: "MEDIUM",
        discriminatingTest: shared,
      },
      {
        rank: 2,
        explanation: "Positioning offset the macro impulse.",
        evidenceForRefs: [],
        evidenceAgainstRefs: ["ev-credit"],
        confidence: "LOW",
        discriminatingTest: shared,
      },
    ],
  }));

  assert.equal(result.mode, "full");
  assert.equal(result.sharedDiscriminator, shared);
  assert.deepEqual(result.candidates.map((item) => item.displayDiscriminator), [null, null]);
});

test("distinct candidate discriminators remain candidate-specific", () => {
  const result = buildDivergenceLabPresentation(investigation({
    divergence: "PARTIAL",
    candidateExplanations: [
      {
        rank: 1,
        explanation: "Pricing was already embedded.",
        evidenceForRefs: ["ev-rates"],
        evidenceAgainstRefs: [],
        confidence: "MEDIUM",
        discriminatingTest: "Check front-end repricing.",
      },
      {
        rank: 2,
        explanation: "Positioning offset the impulse.",
        evidenceForRefs: [],
        evidenceAgainstRefs: ["ev-credit"],
        confidence: "LOW",
        discriminatingTest: "Check positioning and volume.",
      },
    ],
  }));

  assert.equal(result.mode, "full");
  assert.deepEqual(result.candidates.map((item) => item.displayDiscriminator), [
    "Check front-end repricing.",
    "Check positioning and volume.",
  ]);
});
