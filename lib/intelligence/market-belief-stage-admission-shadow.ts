import type { MarketBeliefOutput } from "./schemas.ts";

export const MARKET_BELIEF_ADMISSION_SHADOW_VERSION = "market-belief-admission-shadow-v1" as const;

export type MarketBeliefAdmissionShadowDecision = {
  version: typeof MARKET_BELIEF_ADMISSION_SHADOW_VERSION;
  stageKey: "market_belief";
  decision: "would_run" | "would_skip";
  reason: "fresh_evidence_present" | "story_review_targets_present" | "no_fresh_evidence_or_story_reviews";
  freshEvidenceCandidateCount: number;
  storyReviewTargetCount: number;
};

export type MarketBeliefAdmissionShadowResult = MarketBeliefAdmissionShadowDecision & {
  actualMaterialResult: boolean;
  actualBeliefCount: number;
  actualRecruitedClusterCount: number;
  actualMaterialStoryAssessmentCount: number;
};

/**
 * Shadow-only Market Belief admission. No model call is skipped.
 *
 * A skip candidate exists only when the stage has neither recruited fresh
 * evidence nor an existing Story that requires review. Any real work item keeps
 * the shadow decision at would_run.
 */
export function buildMarketBeliefAdmissionShadow(input: {
  freshEvidenceCandidates?: unknown[];
  storyReviewTargets?: unknown[];
}): MarketBeliefAdmissionShadowDecision {
  const freshEvidenceCandidateCount = Array.isArray(input.freshEvidenceCandidates)
    ? input.freshEvidenceCandidates.length
    : 0;
  const storyReviewTargetCount = Array.isArray(input.storyReviewTargets)
    ? input.storyReviewTargets.length
    : 0;

  if (freshEvidenceCandidateCount > 0) {
    return {
      version: MARKET_BELIEF_ADMISSION_SHADOW_VERSION,
      stageKey: "market_belief",
      decision: "would_run",
      reason: "fresh_evidence_present",
      freshEvidenceCandidateCount,
      storyReviewTargetCount,
    };
  }
  if (storyReviewTargetCount > 0) {
    return {
      version: MARKET_BELIEF_ADMISSION_SHADOW_VERSION,
      stageKey: "market_belief",
      decision: "would_run",
      reason: "story_review_targets_present",
      freshEvidenceCandidateCount,
      storyReviewTargetCount,
    };
  }
  return {
    version: MARKET_BELIEF_ADMISSION_SHADOW_VERSION,
    stageKey: "market_belief",
    decision: "would_skip",
    reason: "no_fresh_evidence_or_story_reviews",
    freshEvidenceCandidateCount,
    storyReviewTargetCount,
  };
}

export function observeMarketBeliefAdmissionShadow(
  decision: MarketBeliefAdmissionShadowDecision,
  output: unknown,
): MarketBeliefAdmissionShadowResult {
  const record = output && typeof output === "object" && !Array.isArray(output)
    ? output as Partial<MarketBeliefOutput>
    : {};
  const beliefs = Array.isArray(record.beliefs) ? record.beliefs : [];
  const clusters = Array.isArray(record.recruitmentClusters) ? record.recruitmentClusters : [];
  const assessments = Array.isArray(record.storyAssessments) ? record.storyAssessments : [];
  const recruitedClusters = clusters.filter((cluster) => cluster.verdict === "recruit");
  const materialAssessments = assessments.filter((assessment) => assessment.disposition !== "unchanged");

  return {
    ...decision,
    actualMaterialResult: beliefs.length > 0 || recruitedClusters.length > 0 || materialAssessments.length > 0,
    actualBeliefCount: beliefs.length,
    actualRecruitedClusterCount: recruitedClusters.length,
    actualMaterialStoryAssessmentCount: materialAssessments.length,
  };
}
