import type { RoutedDossierInvestigation } from "./regime-investigations.ts";
import type { RegimeLiveStoryReasoning } from "./regime-live-reasoning.ts";
import type { ProjectedRegimeSubgroup } from "./regimes.ts";

export type UnderstandLiveBridge = {
  subgroupKey: string;
  subgroupLabel: string;
  structuralWhy: string;
  structuralMechanism: string;
  liveStory: {
    storyId: string;
    storyTitle: string;
    question: string;
    mechanism: string;
    decisionState: string;
    confidence: number;
    updatedAt: string | null;
    causalChain: RegimeLiveStoryReasoning["causalChain"];
  } | null;
  latestContribution: {
    id: string;
    title: string;
    detail: string;
    state: string;
    timestamp: string | null;
    href: string | null;
  } | null;
  nextTest: {
    investigationId: string;
    question: string;
    divergence: RoutedDossierInvestigation["divergence"];
    expectedReaction: string | null;
    observedReaction: string | null;
    researchNext: string;
    confirmationCondition: string;
    invalidationCondition: string;
  } | null;
  coverage: {
    telemetryCount: number;
    liveReasoningCount: number;
    observedEdgeCount: number;
    supportedEdgeCount: number;
    inferredEdgeCount: number;
    speculativeEdgeCount: number;
  };
};

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function divergenceRank(value: RoutedDossierInvestigation["divergence"]) {
  if (value === "MATERIAL") return 4;
  if (value === "PARTIAL") return 3;
  if (value === "UNRESOLVED") return 2;
  if (value === "NONE") return 1;
  return 0;
}

export function buildUnderstandLiveBridge(input: {
  subgroup: ProjectedRegimeSubgroup;
  liveReasoning: RegimeLiveStoryReasoning[];
  investigations: RoutedDossierInvestigation[];
}): UnderstandLiveBridge {
  const storyById = new Map(input.subgroup.durableStories.map((story) => [story.id, story]));

  const liveReasoning = input.liveReasoning
    .filter((item) => storyById.has(item.storyId))
    .sort((left, right) =>
      timestamp(right.updatedAt) - timestamp(left.updatedAt)
      || right.confidence - left.confidence
      || left.storyId.localeCompare(right.storyId)
    );

  const primaryReasoning = liveReasoning[0] ?? null;
  const primaryStory = primaryReasoning ? storyById.get(primaryReasoning.storyId) ?? null : null;

  // The caller supplies investigations already scoped through the exact
  // Regime ↔ Story routing boundary. Do not re-route or widen identity here.
  const nextTest = [...input.investigations]
    .sort((left, right) =>
      divergenceRank(right.divergence) - divergenceRank(left.divergence)
      || Number(right.reactionCalibration.requiresReview) - Number(left.reactionCalibration.requiresReview)
      || left.id.localeCompare(right.id)
    )[0] ?? null;

  const edges = liveReasoning.flatMap((item) => item.causalChain);

  return {
    subgroupKey: input.subgroup.key,
    subgroupLabel: input.subgroup.label,
    structuralWhy: input.subgroup.whyItMatters,
    structuralMechanism: input.subgroup.mechanism,
    liveStory: primaryReasoning && primaryStory ? {
      storyId: primaryStory.id,
      storyTitle: primaryStory.title,
      question: primaryReasoning.question || primaryReasoning.statement,
      mechanism: primaryReasoning.mechanism,
      decisionState: primaryReasoning.decisionState,
      confidence: primaryReasoning.confidence,
      updatedAt: primaryReasoning.updatedAt,
      causalChain: [...primaryReasoning.causalChain],
    } : null,
    latestContribution: input.subgroup.nodes[0] ? {
      id: input.subgroup.nodes[0].id,
      title: input.subgroup.nodes[0].title,
      detail: input.subgroup.nodes[0].detail,
      state: input.subgroup.nodes[0].state,
      timestamp: input.subgroup.nodes[0].timestamp,
      href: input.subgroup.nodes[0].href,
    } : null,
    nextTest: nextTest ? {
      investigationId: nextTest.id,
      question: nextTest.question,
      divergence: nextTest.divergence,
      expectedReaction: nextTest.journey.previousExpectedReaction || nextTest.expectedReaction,
      observedReaction: nextTest.observedReaction,
      researchNext: nextTest.researchNext,
      confirmationCondition: nextTest.confirmationCondition,
      invalidationCondition: nextTest.invalidationCondition,
    } : null,
    coverage: {
      telemetryCount: input.subgroup.telemetry.length,
      liveReasoningCount: liveReasoning.length,
      observedEdgeCount: edges.filter((edge) => edge.evidenceState === "observed").length,
      supportedEdgeCount: edges.filter((edge) => edge.evidenceState === "strongly_supported").length,
      inferredEdgeCount: edges.filter((edge) => edge.evidenceState === "inferred").length,
      speculativeEdgeCount: edges.filter((edge) => edge.evidenceState === "speculative").length,
    },
  };
}
