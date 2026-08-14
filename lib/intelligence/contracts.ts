export const REASONING_STAGES = [
  "normalizer",
  "entity_extractor",
  "market_belief",
  "divergence",
  "hypothesis",
  "challenger",
  "scenario",
  "story_synthesis",
  "semantic_deduplication",
  "lifecycle",
  "positioning_recommender",
] as const;

export type ReasoningStage = (typeof REASONING_STAGES)[number];

export const STORY_LIFECYCLE_STATUSES = [
  "detected",
  "developing",
  "confirmed",
  "weakening",
  "invalidated",
  "archived",
] as const;

export type StoryLifecycleStatus = (typeof STORY_LIFECYCLE_STATUSES)[number];

export type EvidenceClass =
  | "official_release"
  | "market_observation"
  | "company_primary"
  | "transcript"
  | "regulatory_filing"
  | "news_report"
  | "research_analysis"
  | "derived_metric"
  | "other";

export type EvidenceObject = {
  id?: string;
  providerKey: string;
  sourceExternalId?: string | null;
  sourceName: string;
  sourceType: string;
  sourceUrl?: string | null;
  sourceAncestryKey: string;
  sourceTier: number;
  reliabilityScore: number;
  externalEvidenceId?: string | null;
  evidenceClass: EvidenceClass;
  supportDirection: "supports" | "contradicts" | "mixed" | "neutral" | "context";
  claimText: string;
  summary?: string | null;
  eventAt?: string | null;
  publishedAt?: string | null;
  availableAt?: string | null;
  receivedAt: string;
  geography?: string | null;
  affectedAssets: string[];
  affectedTopics: string[];
  confidence: number;
  provenanceUrls: string[];
  contentHash: string;
  structuredPayload: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  normalizerVersion: string;
};

export type EntityExtraction = {
  entities: Array<{
    canonicalKey: string;
    type: string;
    name: string;
    aliases: string[];
    identifiers: Record<string, string>;
    salience: number;
  }>;
  relationships: Array<{
    fromCanonicalKey: string;
    relationship: string;
    toCanonicalKey: string;
    direction: "directed" | "bidirectional";
    confidence: number;
    evidenceSummary: string;
  }>;
};

export type MarketBelief = {
  beliefKey: string;
  statement: string;
  pricedState: string;
  consensusStrength: number;
  affectedAssets: string[];
  evidenceIds: string[];
};

export type Divergence = {
  divergenceKey: string;
  material: boolean;
  observedChange: string;
  expectedChange: string;
  magnitude: number;
  persistenceScore: number;
  decisiveEvidenceIds: string[];
};

export type Hypothesis = {
  hypothesisKey: string;
  question: string;
  statement: string;
  marketBelief: string | null;
  divergence: string;
  causalMechanism: string;
  affectedAssets: string[];
  evidenceForIds: string[];
  evidenceAgainstIds: string[];
  decisiveEvidenceIds: string[];
  sourceAncestryGroupIds: string[];
  causalChain: Array<{
    from: string;
    to: string;
    mechanism: string;
    evidenceStatus: "observed" | "strongly_supported" | "inferred" | "speculative";
  }>;
  confirmationCriteria: string[];
  invalidationCriteria: string[];
  nextCatalysts: string[];
  confidence: number;
};

export type ChallengerAssessment = {
  hypothesisKey: string;
  verdict: "promote" | "downgrade" | "watch" | "reject";
  weakestLink: string | null;
  strongestCountercase: string;
  conflictingEvidenceIds: string[];
  pricingConfirmation: string | null;
  crossAssetConfirmation: string | null;
  timingRisk: string | null;
  nextResolvingEvidence: string | null;
  hiddenAssumptions: string[];
  alternativeMechanisms: string[];
  missingEvidence: string[];
  missingRequirementIds: string[];
  confidenceAdjustment: number;
  adjustedConfidence: number;
};

export type ScenarioScore = {
  hypothesisKey: string;
  asset: string;
  bias: "bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "bearish" | "unscored";
  conviction: number | null;
  baseCase: { description: string; probability: number };
  bullCase: { description: string; probability: number };
  bearCase: { description: string; probability: number };
  tailCase?: { description: string; probability: number } | null;
  confirmation: string;
  invalidation: string;
  explanatoryEvidenceIds: string[];
};

export type StoryCandidate = {
  id?: string;
  slug?: string;
  title: string;
  question?: string;
  thesis: string;
  marketBelief?: string | null;
  divergence?: string;
  bias?: ScenarioScore["bias"];
  conviction?: number | null;
  baseCase?: string;
  bullCase?: string;
  bearCase?: string;
  tailCase?: string | null;
  strongestSupport?: string;
  strongestContradiction?: string;
  hypothesisKey?: string;
  eventSignature: string;
  causalMechanism: string;
  affectedAssets: string[];
  decisiveEvidenceIds: string[];
  sourceAncestryGroupIds: string[];
  confirmationCriteria: string[];
  invalidationCriteria: string[];
  nextCatalysts: string[];
  confidence: number;
  lifecycleStatus: StoryLifecycleStatus;
  publicationEligible: boolean;
  qualificationScore: number;
  canonicalExternalUrl?: string | null;
  researchSynthesis?: string | null;
  rank?: number | null;
  /** Most recent material evidence, thesis revision, or canonical Story event. */
  recencyAt?: string | null;
  noveltyClass?: NoveltyClass;
  duplicateOfId?: string | null;
  noveltyRationale?: string | null;
};

export const MAX_PUBLISHED_STORIES = 15;
export const MAX_FEATURED_STORIES = 6;

export type NoveltyClass =
  | "new_story"
  | "existing_story_update"
  | "duplicate"
  | "related_distinct"
  | "insufficient_novelty";

export type DuplicateExceptionProof = {
  causalMechanismDistinct: boolean;
  affectedMarketDistinct: boolean;
  independentEvidenceDistinct: boolean;
  confirmationAndInvalidationDistinct: boolean;
  satisfied: boolean;
};

export type StoryComparison = {
  classification: NoveltyClass;
  similarityScore: number;
  sameEvent: boolean;
  duplicateOfId: string | null;
  exceptionProof: DuplicateExceptionProof;
  rationale: string;
};

export type StageDefinition<TOutput = unknown> = {
  key: ReasoningStage;
  version: number;
  instructions: string;
  outputSchema: Record<string, unknown>;
  parse: (value: unknown) => TOutput;
};

export type StageExecution<TOutput = unknown> = {
  stage: ReasoningStage;
  version: number;
  model: string;
  requestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  output: TOutput;
};

export type ReasoningProvider = {
  execute<TOutput>(definition: StageDefinition<TOutput>, input: unknown): Promise<StageExecution<TOutput>>;
};

export type IntelligencePipelineResult = {
  evidence: EvidenceObject;
  entities: EntityExtraction;
  belief: MarketBelief;
  divergence: Divergence;
  hypotheses: Hypothesis[];
  challengerAssessments: ChallengerAssessment[];
  scenarios: ScenarioScore[];
  storyCandidates: StoryCandidate[];
  stageExecutions: StageExecution[];
};
