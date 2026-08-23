import { createHash } from "node:crypto";

export const CANONICAL_STORY_REASONING_V1 = "canonical-story-reasoning/v1" as const;

export type EvidenceState =
  | "observed"
  | "strongly_supported"
  | "inferred"
  | "speculative";

export type ClaimType =
  | "fact"
  | "interpretation"
  | "thesis"
  | "speculation";

export type StoryLifecycleStatus =
  | "detected"
  | "developing"
  | "confirmed"
  | "weakening"
  | "invalidated"
  | "archived";

export type AssetBias =
  | "bullish"
  | "bearish"
  | "neutral"
  | "mixed"
  | "unscored";

export type NextTestStatus =
  | "upcoming"
  | "due"
  | "resolved"
  | "expired";

export type CanonicalClaimV1 = {
  id: string;
  type: ClaimType;
  text: string;
  evidenceIds: string[];
};

export type CanonicalCausalEdgeV1 = {
  id: string;
  sourceHypothesisId: string;
  from: string;
  relationship: string;
  to: string;
  evidenceState: EvidenceState;
  evidenceIds: string[];
};

export type CanonicalCountercaseV1 = {
  strongest: string | null;
  evidenceIds: string[];
  weakestLink: string | null;
  marketMayBeRight: string | null;
};

export type CanonicalScenarioCaseV1 = {
  summary: string;
  probability: number | null;
};

export type CanonicalOverlookedVariableV1 = {
  text: string | null;
  evidenceState: EvidenceState | null;
  evidenceIds: string[];
};

export type CanonicalAssetImplicationV1 = {
  asset: string;
  bias: AssetBias;
  conviction: number | null;
  baseCase: CanonicalScenarioCaseV1;
  bullCase: CanonicalScenarioCaseV1;
  bearCase: CanonicalScenarioCaseV1;
  tailCase: CanonicalScenarioCaseV1 | null;
  evidenceIds: string[];
  confirmation: string;
  invalidation: string;
};

export type CanonicalNextTestV1 = {
  id: string;
  label: string;
  status: NextTestStatus;
  catalystRef: string | null;
  dueAt: string | null;
  expiresAt: string | null;
  evidenceIds: string[];
  resolutionEvidenceIds: string[];
};

export type CanonicalSeriesRefV1 = {
  seriesId: string;
  label: string;
  geography: string | null;
  transform: "level" | "change" | "yoy" | "mom" | "return" | "spread" | "indexed";
  role: "driver" | "asset" | "benchmark" | "observed" | "expected" | "spread";
};

export type CanonicalEntityRefV1 = {
  entityId: string;
  label: string;
  geography:
    | { kind: "country"; countryCode: string }
    | { kind: "coordinate"; lat: number; lon: number };
  evidenceIds: string[];
};

type VisualBaseV1 = { id: string; title: string };
export type VisualPlanV1 =
  | (VisualBaseV1 & { type: "linear_chain"; edgeIds: string[] })
  | (VisualBaseV1 & { type: "feedback_loop"; edgeIds: string[]; loopClosureEdgeId: string })
  | (VisualBaseV1 & { type: "money_or_commodity_flow"; edgeIds: string[]; entities: CanonicalEntityRefV1[]; flowLabel: string })
  | (VisualBaseV1 & { type: "entity_map"; entities: CanonicalEntityRefV1[]; connectionEdgeIds: string[] })
  | (VisualBaseV1 & {
      type: "divergence_chart";
      series: CanonicalSeriesRefV1[];
      expectedRelationship: "positive" | "inverse" | "divergent" | "none_asserted";
      evidenceIds: string[];
      window: { start: string | null; end: string | null; observations: number | null };
    })
  | (VisualBaseV1 & {
      type: "before_after";
      beforeClaimIds: string[];
      afterClaimIds: string[];
      changeEvidenceIds: string[];
      series: CanonicalSeriesRefV1[];
    })
  | (VisualBaseV1 & {
      type: "decision_tree";
      rootClaimId: string;
      branches: Array<{
        conditionRef:
          | { kind: "confirmation"; index: number }
          | { kind: "invalidation"; index: number }
          | { kind: "next_test" };
        outcomeClaimIds: string[];
      }>;
    });

export type CanonicalStoryReasoningV1 = {
  contractVersion: typeof CANONICAL_STORY_REASONING_V1;
  storyId: string;
  storyVersionId: string;
  versionNumber: number;
  effectiveAt: string;
  title: string;
  centralQuestion: string | null;
  lifecycle: StoryLifecycleStatus;
  confidence: number;
  thesis: string;
  whatChanged: string | null;
  previousState: string | null;
  currentState: string | null;
  marketReaction: string | null;
  acceptedExplanation: string | null;
  causalMechanism: string;
  claims: CanonicalClaimV1[];
  causalChain: CanonicalCausalEdgeV1[];
  countercase: CanonicalCountercaseV1;
  overlookedVariable: CanonicalOverlookedVariableV1;
  assetImplications: CanonicalAssetImplicationV1[];
  confirmation: string[];
  invalidation: string[];
  nextCatalysts: string[];
  nextTest: CanonicalNextTestV1 | null;
  visualPlan: VisualPlanV1[];
};

export type CanonicalStoryReasoningSnapshotV1 = Omit<
  CanonicalStoryReasoningV1,
  "storyId" | "storyVersionId" | "versionNumber" | "effectiveAt" | "title" | "centralQuestion" | "confidence" | "thesis"
>;

export type StoryReasoningEvidence = {
  id: string;
  claim: string;
};

export type StoryReasoningHypothesis = {
  id: string;
  causalMechanism: string;
  evidenceForIds: string[];
  causalChain: Array<{
    from: string;
    relationship: string;
    to: string;
    evidenceState: EvidenceState;
    evidenceIds: string[];
  }>;
  confirmationCriteria: string[];
  invalidationCriteria: string[];
  nextCatalysts: string[];
};

export type StoryReasoningChallenger = {
  strongestCountercase: string | null;
  conflictingEvidenceIds: string[];
  weakestLink: string | null;
};

export type StoryReasoningScenario = {
  asset: string;
  bias: "bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "bearish" | "unscored";
  conviction: number | null;
  baseCase: CanonicalScenarioCaseV1;
  bullCase: CanonicalScenarioCaseV1;
  bearCase: CanonicalScenarioCaseV1;
  tailCase: CanonicalScenarioCaseV1 | null;
  explanatoryEvidenceIds: string[];
  confirmation: string;
  invalidation: string;
};

export type StoryReasoningSynthesis = {
  lifecycleStatus: StoryLifecycleStatus;
  thesis: string;
  whatChanged: string | null;
  previousState: string | null;
  currentState: string | null;
  marketReaction: string | null;
  acceptedExplanation: string | null;
  acceptedExplanationEvidenceIds?: string[];
  overlookedVariable: string | null;
  overlookedVariableEvidenceStatus: EvidenceState | null;
  overlookedVariableEvidenceIds?: string[];
  marketMayBeRight: string | null;
  decisiveEvidenceIds: string[];
};

export type ImmutableStoryVersionV1 = {
  id: string;
  story_id: string;
  version_number: number;
  effective_at: string;
  title: string;
  market_question: string | null;
  status: string;
  confidence: number;
  thesis: string;
  snapshot: unknown;
};

function hash(value: string, length = 16) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function normalizeIdentityPart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function assertKnownEvidenceIds(ids: string[], knownEvidenceIds: ReadonlySet<string>, context: string) {
  const normalized = unique(ids);
  const unknown = normalized.filter((id) => !knownEvidenceIds.has(id));
  if (unknown.length) throw new Error(`${context} references unknown canonical evidence ID(s): ${unknown.join(", ")}`);
  return normalized;
}

export function canonicalCausalEdgeId(
  hypothesisId: string,
  ordinal: number,
  edge: Pick<CanonicalCausalEdgeV1, "from" | "relationship" | "to">,
) {
  const content = [edge.from, edge.relationship, edge.to].map(normalizeIdentityPart).join("|");
  return `hyp:${hypothesisId}:edge:${ordinal}:${hash(content)}`;
}

function mapBias(value: StoryReasoningScenario["bias"]): AssetBias {
  if (value === "slightly_bullish") return "bullish";
  if (value === "slightly_bearish") return "bearish";
  return value;
}

function factClaims(
  decisiveEvidenceIds: string[],
  evidenceById: ReadonlyMap<string, StoryReasoningEvidence>,
  knownEvidenceIds: ReadonlySet<string>,
): CanonicalClaimV1[] {
  return assertKnownEvidenceIds(decisiveEvidenceIds, knownEvidenceIds, "Decisive evidence")
    .map((id) => evidenceById.get(id))
    .filter((item): item is StoryReasoningEvidence => Boolean(item))
    .map((item) => ({ id: `claim:fact:${item.id}`, type: "fact" as const, text: item.claim, evidenceIds: [item.id] }));
}

export function buildCanonicalStoryReasoningSnapshotV1(input: {
  synthesis: StoryReasoningSynthesis;
  hypothesis: StoryReasoningHypothesis;
  challenger: StoryReasoningChallenger | null;
  scenarios: StoryReasoningScenario[];
  evidenceById: ReadonlyMap<string, StoryReasoningEvidence>;
  nextTest?: CanonicalNextTestV1 | null;
  visualPlan?: VisualPlanV1[];
}): CanonicalStoryReasoningSnapshotV1 {
  const knownEvidenceIds = new Set(input.evidenceById.keys());
  const causalChain: CanonicalCausalEdgeV1[] = input.hypothesis.causalChain.map((edge, ordinal) => {
    const evidenceIds = assertKnownEvidenceIds(edge.evidenceIds, knownEvidenceIds, `Causal edge ${ordinal}`);
    if ((edge.evidenceState === "observed" || edge.evidenceState === "strongly_supported") && evidenceIds.length === 0) {
      throw new Error(`Causal edge ${ordinal} with state ${edge.evidenceState} requires canonical evidence.`);
    }
    return {
      id: canonicalCausalEdgeId(input.hypothesis.id, ordinal, edge),
      sourceHypothesisId: input.hypothesis.id,
      from: edge.from,
      relationship: edge.relationship,
      to: edge.to,
      evidenceState: edge.evidenceState,
      evidenceIds,
    };
  });

  const claims: CanonicalClaimV1[] = factClaims(input.synthesis.decisiveEvidenceIds, input.evidenceById, knownEvidenceIds);
  const thesisEvidenceIds = assertKnownEvidenceIds(input.hypothesis.evidenceForIds, knownEvidenceIds, "Primary hypothesis thesis evidence");
  claims.push({
    id: `claim:thesis:${hash(input.synthesis.thesis, 20)}`,
    type: "thesis",
    text: input.synthesis.thesis,
    evidenceIds: thesisEvidenceIds,
  });

  const interpretationEvidenceIds = assertKnownEvidenceIds(
    input.synthesis.acceptedExplanationEvidenceIds ?? [],
    knownEvidenceIds,
    "Accepted explanation",
  );
  if (input.synthesis.acceptedExplanation && interpretationEvidenceIds.length) {
    claims.push({
      id: `claim:interpretation:${hash(input.synthesis.acceptedExplanation, 20)}`,
      type: "interpretation",
      text: input.synthesis.acceptedExplanation,
      evidenceIds: interpretationEvidenceIds,
    });
  }

  for (const edge of causalChain.filter((item) => item.evidenceState === "speculative")) {
    claims.push({
      id: `claim:speculation:${edge.id}`,
      type: "speculation",
      text: `${edge.from} ${edge.relationship} ${edge.to}`,
      evidenceIds: edge.evidenceIds,
    });
  }

  const countercaseEvidenceIds = assertKnownEvidenceIds(
    input.challenger?.conflictingEvidenceIds ?? [],
    knownEvidenceIds,
    "Countercase",
  );
  const overlookedVariableEvidenceIds = assertKnownEvidenceIds(
    input.synthesis.overlookedVariableEvidenceIds ?? [],
    knownEvidenceIds,
    "Overlooked variable",
  );

  const assetImplications = input.scenarios.map((scenario) => ({
    asset: scenario.asset,
    bias: mapBias(scenario.bias),
    conviction: scenario.bias === "unscored" ? null : scenario.conviction,
    baseCase: structuredClone(scenario.baseCase),
    bullCase: structuredClone(scenario.bullCase),
    bearCase: structuredClone(scenario.bearCase),
    tailCase: scenario.tailCase ? structuredClone(scenario.tailCase) : null,
    evidenceIds: assertKnownEvidenceIds(scenario.explanatoryEvidenceIds, knownEvidenceIds, `Scenario ${scenario.asset}`),
    confirmation: scenario.confirmation,
    invalidation: scenario.invalidation,
  }));

  return {
    contractVersion: CANONICAL_STORY_REASONING_V1,
    lifecycle: input.synthesis.lifecycleStatus,
    whatChanged: input.synthesis.whatChanged,
    previousState: input.synthesis.previousState,
    currentState: input.synthesis.currentState,
    marketReaction: input.synthesis.marketReaction,
    acceptedExplanation: input.synthesis.acceptedExplanation,
    causalMechanism: input.hypothesis.causalMechanism,
    claims,
    causalChain,
    countercase: {
      strongest: input.challenger?.strongestCountercase ?? null,
      evidenceIds: countercaseEvidenceIds,
      weakestLink: input.challenger?.weakestLink ?? null,
      marketMayBeRight: input.synthesis.marketMayBeRight,
    },
    overlookedVariable: {
      text: input.synthesis.overlookedVariable,
      evidenceState: input.synthesis.overlookedVariable ? input.synthesis.overlookedVariableEvidenceStatus : null,
      evidenceIds: overlookedVariableEvidenceIds,
    },
    assetImplications,
    confirmation: [...input.hypothesis.confirmationCriteria],
    invalidation: [...input.hypothesis.invalidationCriteria],
    nextCatalysts: [...input.hypothesis.nextCatalysts],
    nextTest: input.nextTest ?? null,
    visualPlan: input.visualPlan ?? [],
  };
}

function reasoningSnapshot(value: unknown): CanonicalStoryReasoningSnapshotV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as { reasoning?: unknown };
  if (!snapshot.reasoning || typeof snapshot.reasoning !== "object" || Array.isArray(snapshot.reasoning)) return null;
  const reasoning = snapshot.reasoning as Partial<CanonicalStoryReasoningSnapshotV1>;
  return reasoning.contractVersion === CANONICAL_STORY_REASONING_V1
    ? reasoning as CanonicalStoryReasoningSnapshotV1
    : null;
}

function lifecycleFromVersionStatus(status: string): StoryLifecycleStatus {
  const normalized = status.toLowerCase();
  if (normalized.includes("archive")) return "archived";
  if (normalized.includes("invalid")) return "invalidated";
  if (normalized.includes("weaken")) return "weakening";
  if (normalized.includes("confirm") || normalized.includes("publish")) return "confirmed";
  if (normalized.includes("develop") || normalized.includes("monitor")) return "developing";
  return "detected";
}

export function materialiseCanonicalStoryReasoningV1(version: ImmutableStoryVersionV1): CanonicalStoryReasoningV1 | null {
  const reasoning = reasoningSnapshot(version.snapshot);
  if (!reasoning) return null;
  return {
    ...reasoning,
    lifecycle: reasoning.lifecycle ?? lifecycleFromVersionStatus(version.status),
    storyId: version.story_id,
    storyVersionId: version.id,
    versionNumber: version.version_number,
    effectiveAt: version.effective_at,
    title: version.title,
    centralQuestion: version.market_question,
    confidence: version.confidence,
    thesis: version.thesis,
  };
}
