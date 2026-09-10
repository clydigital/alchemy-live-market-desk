import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildMarketBeliefAdmissionShadow,
  observeMarketBeliefAdmissionShadow,
} from "../lib/intelligence/market-belief-stage-admission-shadow.ts";

test("Market Belief shadow would skip only with no fresh evidence and no Story reviews", () => {
  const decision = buildMarketBeliefAdmissionShadow({
    freshEvidenceCandidates: [],
    storyReviewTargets: [],
  });
  assert.equal(decision.decision, "would_skip");
  assert.equal(decision.reason, "no_fresh_evidence_or_story_reviews");
});

test("Market Belief shadow would run for fresh evidence", () => {
  const decision = buildMarketBeliefAdmissionShadow({
    freshEvidenceCandidates: [{ id: "evidence" }],
    storyReviewTargets: [],
  });
  assert.equal(decision.decision, "would_run");
  assert.equal(decision.reason, "fresh_evidence_present");
});

test("Market Belief shadow would run for Story review work even without fresh evidence", () => {
  const decision = buildMarketBeliefAdmissionShadow({
    freshEvidenceCandidates: [],
    storyReviewTargets: [{ story: { id: "story" } }],
  });
  assert.equal(decision.decision, "would_run");
  assert.equal(decision.reason, "story_review_targets_present");
});

test("Market Belief shadow compares decision with material model output", () => {
  const decision = buildMarketBeliefAdmissionShadow({ freshEvidenceCandidates: [], storyReviewTargets: [] });
  const empty = observeMarketBeliefAdmissionShadow(decision, {
    recruitmentClusters: [], beliefs: [], storyAssessments: [],
  });
  const unchangedOnly = observeMarketBeliefAdmissionShadow(decision, {
    recruitmentClusters: [],
    beliefs: [],
    storyAssessments: [{ disposition: "unchanged" }],
  });
  const material = observeMarketBeliefAdmissionShadow(decision, {
    recruitmentClusters: [{ verdict: "recruit" }],
    beliefs: [],
    storyAssessments: [],
  });
  assert.equal(empty.actualMaterialResult, false);
  assert.equal(unchangedOnly.actualMaterialResult, false);
  assert.equal(material.actualMaterialResult, true);
  assert.equal(material.actualRecruitedClusterCount, 1);
});

test("provider telemetry never branches around Market Belief model execution", () => {
  const source = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");
  const structuredStage = source.slice(source.indexOf("export async function runStructuredStage"));
  assert.match(structuredStage, /marketBeliefAdmissionShadow/);
  assert.match(structuredStage, /stage_admission_shadow_decision/);
  assert.match(structuredStage, /executeProviderWithRetry<T>/);
  assert.match(structuredStage, /stage_admission_shadow_result/);
  assert.doesNotMatch(structuredStage, /marketBeliefAdmissionShadow[\s\S]{0,180}decision\s*===\s*["']would_skip["'][\s\S]{0,180}(?:return|throw)/);
});
