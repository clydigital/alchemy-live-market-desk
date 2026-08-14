import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  STABLE_REQUIREMENT_IDS,
  evaluateCandidateIntegrity,
  evaluateIntakeStatus,
  evaluateResearchState,
  evaluateRuntimeResearchState,
  getRequirementCriticality,
  researchRequirementRegistry,
} from "../lib/intelligence/research-state.ts";

function runtimeState({
  decisiveEvidenceCount,
  missingRequirementIds = [],
  allowedRequirementIds = missingRequirementIds,
  verdict = "promote",
  independentSourceGroupCount = 3,
  hasTierOneOrTwoSource = true,
  missingEvidence = [],
}: {
  decisiveEvidenceCount: number;
  missingRequirementIds?: string[];
  allowedRequirementIds?: string[];
  verdict?: "promote" | "watch" | "downgrade" | "reject";
  independentSourceGroupCount?: number;
  hasTierOneOrTwoSource?: boolean;
  missingEvidence?: string[];
}) {
  return evaluateRuntimeResearchState({
    decisiveEvidenceCount,
    independentSourceGroupCount,
    hasTierOneOrTwoSource,
    challenger: {
      verdict,
      missingRequirementIds,
      allowedRequirementIds,
      missingEvidence,
    },
  });
}

function publishable(decisiveEvidenceCount: number, noveltyClass = "new_story") {
  return evaluateCandidateIntegrity({ decisiveEvidenceCount, noveltyClass }).publishable;
}

test("canonical requirement IDs and criticalities remain unchanged", () => {
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
});

test("88% with missing important evidence publishes as DEVELOPING", () => {
  const state = runtimeState({ decisiveEvidenceCount: 7, missingRequirementIds: ["freight-insurance-premia"] });
  assert.equal(state.researchCompleteness, 88);
  assert.equal(state.researchState, "DEVELOPING");
  assert.equal(state.missingImportant, true);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("75% with missing critical evidence publishes", () => {
  const state = runtimeState({
    decisiveEvidenceCount: 6,
    missingRequirementIds: ["us-japan-2y-spread", "yen-cross-breadth"],
  });
  assert.equal(state.researchCompleteness, 75);
  assert.equal(state.missingCritical, true);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("Refining missing both crack requirements publishes as DEVELOPING", () => {
  const state = runtimeState({
    decisiveEvidenceCount: 6,
    missingRequirementIds: ["diesel-crack", "gasoline-crack"],
  });
  assert.equal(state.researchCompleteness, 75);
  assert.equal(state.researchState, "DEVELOPING");
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("50% completeness publishes", () => {
  const state = runtimeState({ decisiveEvidenceCount: 1, missingRequirementIds: ["front-end-yields"] });
  assert.equal(state.researchCompleteness, 50);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("below 50% publishes when material and traceable", () => {
  const state = runtimeState({
    decisiveEvidenceCount: 2,
    missingRequirementIds: ["front-end-yields", "july-cpi", "policy-pricing"],
    independentSourceGroupCount: 2,
  });
  assert.equal(state.researchCompleteness, 40);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("missing critical evidence never suppresses publication", () => {
  const state = runtimeState({ decisiveEvidenceCount: 1, missingRequirementIds: ["mof-intervention"] });
  assert.equal(state.missingCritical, true);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("confidence below 60 is absent from structural publication integrity", () => {
  const integrity = evaluateCandidateIntegrity({
    decisiveEvidenceCount: 1,
    noveltyClass: "new_story",
    confidence: 59,
  } as Parameters<typeof evaluateCandidateIntegrity>[0] & { confidence: number });
  assert.equal(integrity.publishable, true);
});

test("qualification below 70 is absent from structural publication integrity", () => {
  const integrity = evaluateCandidateIntegrity({
    decisiveEvidenceCount: 1,
    noveltyClass: "existing_story_update",
    qualificationScore: 42,
  } as Parameters<typeof evaluateCandidateIntegrity>[0] & { qualificationScore: number });
  assert.equal(integrity.publishable, true);
});

test("fewer than three decisive records does not suppress publication", () => {
  assert.equal(publishable(1), true);
});

test("fewer than three independent groups remains a diagnostic only", () => {
  const state = runtimeState({ decisiveEvidenceCount: 2, independentSourceGroupCount: 1 });
  assert.equal(state.researchState, "EARLY");
  assert.match(state.warnings.join(" "), /corroboration depth/);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("no Tier 1-2 source remains a diagnostic only", () => {
  const state = runtimeState({ decisiveEvidenceCount: 3, hasTierOneOrTwoSource: false });
  assert.match(state.warnings.join(" "), /no Tier 1-2 source/);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("Challenger watch publishes as DEVELOPING", () => {
  const state = runtimeState({ decisiveEvidenceCount: 3, verdict: "watch" });
  assert.equal(state.researchState, "DEVELOPING");
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("Challenger downgrade publishes as CONTESTED", () => {
  const state = runtimeState({ decisiveEvidenceCount: 3, verdict: "downgrade" });
  assert.equal(state.researchState, "CONTESTED");
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("Challenger reject publishes a material traceable update as CONTESTED with warning", () => {
  const state = runtimeState({ decisiveEvidenceCount: 1, verdict: "reject" });
  assert.equal(state.researchState, "CONTESTED");
  assert.match(state.warnings.join(" "), /does not decide publication/);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("unknown requirement ID warns without blocking or changing completeness", () => {
  const state = runtimeState({
    decisiveEvidenceCount: 1,
    missingRequirementIds: ["foreign-provider-invented-id"],
    allowedRequirementIds: [],
  });
  assert.deepEqual(state.unknownRequirementIds, ["foreign-provider-invented-id"]);
  assert.equal(state.researchCompleteness, 100);
  assert.match(state.warnings.join(" "), /unknown requirement IDs/);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("out-of-scope canonical IDs remain isolated from an unrelated Story", () => {
  const state = runtimeState({
    decisiveEvidenceCount: 1,
    missingRequirementIds: ["diesel-crack"],
    allowedRequirementIds: ["front-end-yields"],
  });
  assert.deepEqual(state.missingRequirementIds, []);
  assert.deepEqual(state.outOfScopeRequirementIds, ["diesel-crack"]);
  assert.equal(state.missingCritical, false);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("missingEvidence prose is explanatory only", () => {
  const state = runtimeState({
    decisiveEvidenceCount: 2,
    missingRequirementIds: [],
    allowedRequirementIds: ["us-japan-2y-spread", "diesel-crack"],
    missingEvidence: ["Missing US-Japan 2Y spread and diesel cracks"],
  });
  assert.deepEqual(state.missingEvidence, ["Missing US-Japan 2Y spread and diesel cracks"]);
  assert.deepEqual(state.missingRequirementIds, []);
  assert.equal(state.researchCompleteness, 100);
  assert.equal(publishable(state.decisiveEvidenceCount), true);
});

test("duplicate or no-material-change candidate is skipped structurally", () => {
  assert.deepEqual(evaluateCandidateIntegrity({ decisiveEvidenceCount: 3, noveltyClass: "duplicate" }), {
    publishable: false,
    structuralReasons: ["duplicate or no material new state"],
  });
  assert.equal(evaluateCandidateIntegrity({ decisiveEvidenceCount: 3, noveltyClass: "insufficient_novelty" }).publishable, false);
});

test("mixed Morning can publish Oil, Fed, Yen, Refining and AI together", () => {
  const stories = [
    runtimeState({ decisiveEvidenceCount: 7, missingRequirementIds: ["freight-insurance-premia"] }),
    runtimeState({ decisiveEvidenceCount: 5 }),
    runtimeState({ decisiveEvidenceCount: 6, missingRequirementIds: ["us-japan-2y-spread", "yen-cross-breadth"] }),
    runtimeState({ decisiveEvidenceCount: 6, missingRequirementIds: ["diesel-crack", "gasoline-crack"] }),
    runtimeState({ decisiveEvidenceCount: 5 }),
  ];
  assert.deepEqual(stories.map((state) => publishable(state.decisiveEvidenceCount)), [true, true, true, true, true]);
});

test("optional provider or transcript failure cannot globally block an edition", () => {
  assert.equal(evaluateIntakeStatus({
    itemType: "video",
    transcriptStatus: "unavailable",
    recommendedAction: "collect_evidence",
  }), "blocked");
  assert.equal(evaluateIntakeStatus({
    itemType: "news",
    transcriptStatus: "not_applicable",
    recommendedAction: "recalibrate_story",
    evidence: [{ url: "https://example.com/traceable" }],
  }), "published");

  const route = readFileSync(new URL("../app/api/research-update/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /if \(intelligenceEnabled && validation\.sourceCoverageAvailable\)/);
  assert.match(route, /if \(intelligenceEnabled\) \{/);
});

test("malformed canonical state and fatal runtime errors remain run-level failures", () => {
  assert.throws(() => researchRequirementRegistry([{
    requirementId: "invented-key",
    name: "Invented",
    storyId: "story-id",
    storySlug: "story",
  }]), /No research criticality policy exists/);

  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  assert.match(runtime, /status: "failed"/);
  assert.match(runtime, /failure_detail: message/);
});

test("runtime contains no research-quality publication threshold path", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../lib/intelligence/schemas.ts", import.meta.url), "utf8");
  assert.doesNotMatch(runtime, /candidateGate|gate\.open|MIN_CONFIDENCE|MIN_QUALIFICATION|MIN_DECISIVE_EVIDENCE|MIN_INDEPENDENT_SOURCES/);
  assert.doesNotMatch(runtime, /assessment\?\.verdict === "promote"/);
  assert.doesNotMatch(schema, /publicationEligible/);
});