import assert from "node:assert/strict";
import test from "node:test";

import {
  STABLE_REQUIREMENT_IDS,
  evaluateIntakeStatus,
  evaluatePublicationGate,
  evaluateRuntimePublicationGate,
  getRequirementCriticality,
  publicationRequirementRegistry,
} from "../lib/intelligence/publication-gate.ts";

function mockCandidate(overrides: Partial<{
  confidence: number;
  qualificationScore: number;
  publicationEligible: boolean;
}> = {}) {
  return {
    confidence: 85,
    qualificationScore: 80,
    publicationEligible: true,
    ...overrides,
  };
}

function runtimeGate({
  decisiveCount,
  missingRequirementIds,
  allowedRequirementIds = missingRequirementIds,
  missingEvidence = [],
}: {
  decisiveCount: number;
  missingRequirementIds: string[];
  allowedRequirementIds?: string[];
  missingEvidence?: string[];
}) {
  return evaluateRuntimePublicationGate({
    candidate: mockCandidate(),
    decisiveCount,
    independenceGroupsCount: 3,
    hasHighGradeSource: true,
    challenger: {
      verdict: "promote",
      missingRequirementIds,
      allowedRequirementIds,
      missingEvidence,
    },
  });
}

test("publication policy uses canonical research_story_requirements.requirement_key values", () => {
  const expectedCriticalities = {
    "hormuz-commercial-transits": "critical",
    "carrier-resumptions": "critical",
    "attack-incidents": "critical",
    "freight-insurance-premia": "important",
    "us-japan-2y-spread": "critical",
    "yen-cross-breadth": "critical",
    "diesel-crack": "critical",
    "gasoline-crack": "critical",
  } as const;
  for (const [requirementId, criticality] of Object.entries(expectedCriticalities)) {
    assert.ok(STABLE_REQUIREMENT_IDS.includes(requirementId as never));
    assert.equal(getRequirementCriticality(requirementId), criticality);
  }

  for (const duplicateAlias of [
    "shipping-physical-disruption",
    "carrier-status",
    "hormuz-freight-premium",
    "hormuz-war-risk-insurance",
    "cross-yen-breadth",
    "diesel-crack-spread",
    "gasoline-crack-spread",
  ]) {
    assert.equal(getRequirementCriticality(duplicateAlias), null);
  }
});

test("database requirement records become Story-owned publication requirements without translation", () => {
  const registry = publicationRequirementRegistry([{
    requirementId: "freight-insurance-premia",
    name: "Hormuz freight and insurance premia",
    storyId: "oil-story-id",
    storySlug: "oil-physical-disruption",
  }]);
  assert.deepEqual(registry, [{
    requirementId: "freight-insurance-premia",
    name: "Hormuz freight and insurance premia",
    criticality: "important",
    storyId: "oil-story-id",
    storySlug: "oil-physical-disruption",
  }]);
  assert.throws(() => publicationRequirementRegistry([{
    requirementId: "invented-key",
    name: "Invented",
    storyId: "story-id",
    storySlug: "story",
  }]), /No publication criticality policy exists/);
});

test("OIL 88% publishes when the canonical freight-insurance requirement is the only gap", () => {
  const gate = runtimeGate({
    decisiveCount: 7,
    missingRequirementIds: ["freight-insurance-premia"],
    missingEvidence: ["US-Japan spread and diesel cracks are absent"],
  });

  assert.equal(gate.researchCompleteness, 88);
  assert.equal(gate.missingCritical, false);
  assert.equal(gate.missingImportant, true);
  assert.equal(gate.publicationEligible, true);
});

test("YEN 75% is blocked by canonical 2Y-spread and yen-cross requirement keys", () => {
  const gate = runtimeGate({
    decisiveCount: 6,
    missingRequirementIds: ["us-japan-2y-spread", "yen-cross-breadth"],
    missingEvidence: ["A generic explanation with no asset or thesis keywords"],
  });

  assert.equal(gate.researchCompleteness, 75);
  assert.equal(gate.missingCritical, true);
  assert.equal(gate.publicationEligible, false);
  assert.match(gate.reasons.join(" "), /missing critical evidence/);
});

test("mixed edition gates each Story independently using canonical scoped keys", () => {
  const stories = [
    { id: "oil", decisiveCount: 7, missingRequirementIds: ["freight-insurance-premia"] },
    { id: "fed", decisiveCount: 5, missingRequirementIds: [] },
    { id: "ai", decisiveCount: 5, missingRequirementIds: [] },
    { id: "yen", decisiveCount: 6, missingRequirementIds: ["us-japan-2y-spread", "yen-cross-breadth"] },
    { id: "refining", decisiveCount: 4, missingRequirementIds: ["diesel-crack", "gasoline-crack"] },
  ];
  const outcomes = stories.map((story) => ({
    id: story.id,
    publicationEligible: runtimeGate(story).publicationEligible,
  }));

  assert.deepEqual(outcomes, [
    { id: "oil", publicationEligible: true },
    { id: "fed", publicationEligible: true },
    { id: "ai", publicationEligible: true },
    { id: "yen", publicationEligible: false },
    { id: "refining", publicationEligible: false },
  ]);
});

test("a canonical requirement from another Story cannot block an unrelated Story", () => {
  const gate = runtimeGate({
    decisiveCount: 3,
    missingRequirementIds: ["diesel-crack"],
    allowedRequirementIds: ["front-end-yields", "policy-pricing"],
  });

  assert.equal(gate.publicationEligible, true);
  assert.equal(gate.missingCritical, false);
  assert.deepEqual(gate.outOfScopeRequirementIds, ["diesel-crack"]);
  assert.match(gate.warnings.join(" "), /outside this hypothesis Story scope/);
});

test("unknown Challenger IDs block explicitly and never become general requirements", () => {
  const gate = runtimeGate({
    decisiveCount: 3,
    missingRequirementIds: ["foreign-provider-invented-id"],
    allowedRequirementIds: [],
  });

  assert.equal(gate.publicationEligible, false);
  assert.deepEqual(gate.unknownRequirementIds, ["foreign-provider-invented-id"]);
  assert.match(gate.reasons.join(" "), /unknown requirement IDs returned by Challenger/);
  assert.doesNotMatch(gate.reasons.join(" "), /general-corroboration/);
});

test("missingEvidence prose is explanatory only and cannot manufacture a gate requirement", () => {
  const gate = runtimeGate({
    decisiveCount: 3,
    missingRequirementIds: [],
    allowedRequirementIds: ["us-japan-2y-spread", "diesel-crack"],
    missingEvidence: ["Missing US-Japan 2Y spread, carrier resumptions and diesel cracks"],
  });

  assert.equal(gate.publicationEligible, true);
  assert.equal(gate.missingCritical, false);
  assert.deepEqual(gate.unknownRequirementIds, []);
});

test("90% completeness still blocks when one canonical critical requirement is missing", () => {
  const gate = runtimeGate({ decisiveCount: 9, missingRequirementIds: ["us-japan-2y-spread"] });
  assert.equal(gate.researchCompleteness, 90);
  assert.equal(gate.publicationEligible, false);
});

test("analytical qualification and confidence thresholds remain hard blockers", () => {
  const lowQualification = evaluatePublicationGate({
    candidate: mockCandidate({ qualificationScore: 65 }),
    decisiveCount: 3,
    independenceGroupsCount: 3,
    hasHighGradeSource: true,
    challengerVerdict: "promote",
  });
  const lowConfidence = evaluatePublicationGate({
    candidate: mockCandidate({ confidence: 55 }),
    decisiveCount: 3,
    independenceGroupsCount: 3,
    hasHighGradeSource: true,
    challengerVerdict: "promote",
  });

  assert.ok(lowQualification.reasons.includes("qualification below 70"));
  assert.ok(lowConfidence.reasons.includes("confidence below 60"));
  assert.equal(lowQualification.publicationEligible, false);
  assert.equal(lowConfidence.publicationEligible, false);
});

test("creator transcript admission remains strict", () => {
  assert.equal(evaluateIntakeStatus({
    itemType: "video",
    transcriptStatus: "unavailable",
    recommendedAction: "collect_evidence",
  }, true), "blocked");
});