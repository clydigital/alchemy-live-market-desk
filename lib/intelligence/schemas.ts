import type { JsonSchema } from "./openai.ts";
import { STABLE_REQUIREMENT_IDS } from "./research-state.ts";

export type EvidencePackItem = {
  id: string;
  claim: string;
  summary: string | null;
  evidenceClass: string;
  sourceName: string;
  sourceTier: number;
  reliabilityScore: number;
  ancestryGroupId: string | null;
  supportDirection: string;
  eventAt: string | null;
  publishedAt: string | null;
  affectedAssets: string[];
  affectedTopics: string[];
  provenanceUrls: string[];
};

export type ExistingStoryPackItem = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  marketQuestion: string | null;
  dominantNarrative: string | null;
  strongestSupport: string | null;
  strongestContradiction: string | null;
  confirmationTrigger: string | null;
  invalidationTrigger: string | null;
  nextCatalyst: string | null;
  assets: string[];
};

export type StoryReviewTargetPackItem = {
  story: ExistingStoryPackItem;
  reason: string;
  reasonRank: number;
  reasons: string[];
  queueIds: string[];
  relevantEvidence: EvidencePackItem[];
  selectedAt: string;
  reviewContext?: {
    queueReasons: string[];
    researchDebt: Array<{
      debtKey: string;
      severity: string;
      reason: string | null;
      nextAction: string | null;
      nextCheckAt: string | null;
    }>;
    dueCatalysts: string[];
    triggerEvidenceIds: string[];
    catalystCandidates: Array<{
      label: string;
      catalystRef: string | null;
    }>;
  };
};

export type StoryAssessmentDisposition = "unchanged" | "reinforced" | "weakened" | "reframed" | "invalidated";

export type StoryAssessmentOutput = {
  storyId: string;
  disposition: StoryAssessmentDisposition;
  rationale: string;
  confidenceDelta: number;
  evidenceIds: string[];
  proposedTitle: string | null;
  proposedThesis: string | null;
  proposedMarketQuestion: string | null;
  proposedConfirmation: string[] | null;
  proposedInvalidation: string[] | null;
  proposedNextCatalyst: {
    label: string;
    catalystRef: string | null;
  } | null;
};

export type MarketBeliefOutput = {
  beliefs: Array<{
    statement: string;
    pricedState: string | null;
    consensusStrength: number;
    affectedAssets: string[];
    evidenceIds: string[];
  }>;
  storyAssessments: StoryAssessmentOutput[];
};

export type DivergenceOutput = {
  divergences: Array<{
    marketBeliefId: string;
    observedChange: string;
    expectedChange: string | null;
    magnitude: number;
    persistenceScore: number;
    decisiveEvidenceIds: string[];
  }>;
};

export type HypothesisOutput = {
  hypotheses: Array<{
    divergenceId: string;
    question: string;
    statement: string;
    causalMechanism: string;
    affectedAssets: string[];
    evidenceForIds: string[];
    evidenceAgainstIds: string[];
    causalChain: Array<{
      from: string;
      relationship: string;
      to: string;
      evidenceState: "observed" | "strongly_supported" | "inferred" | "speculative";
      evidenceIds: string[];
    }>;
    confirmationCriteria: string[];
    invalidationCriteria: string[];
    nextCatalysts: string[];
    confidence: number;
  }>;
};

export type ChallengerOutput = {
  assessments: Array<{
    hypothesisId: string;
    verdict: "promote" | "downgrade" | "watch" | "reject";
    strongestCountercase: string;
    weakestLink: string | null;
    hiddenAssumptions: string[];
    alternativeMechanisms: string[];
    missingEvidence: string[];
    missingRequirementIds: string[];
    conflictingEvidenceIds: string[];
    pricingConfirmation: string | null;
    crossAssetConfirmation: string | null;
    timingRisk: string | null;
    nextResolvingEvidence: string | null;
    adjustedConfidence: number;
    confidenceAdjustment: number;
  }>;
};

export type ScenarioOutput = {
  scenarios: Array<{
    hypothesisId: string;
    asset: string;
    bias: "bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "bearish" | "unscored";
    conviction: number | null;
    baseCase: { summary: string; probability: number | null };
    bullCase: { summary: string; probability: number | null };
    bearCase: { summary: string; probability: number | null };
    tailCase: { summary: string; probability: number | null } | null;
    confirmation: string;
    invalidation: string;
    explanatoryEvidenceIds: string[];
  }>;
};

export type StorySynthesisOutput = {
  candidates: Array<{
    primaryHypothesisId: string;
    title: string;
    thesis: string;
    question: string;
    marketBelief: string;
    divergenceSummary: string;
    eventSignature: string;
    causalMechanism: string;
    affectedAssets: string[];
    decisiveEvidenceIds: string[];
    confirmationCriteria: string[];
    invalidationCriteria: string[];
    nextCatalysts: string[];
    confidence: number;
    qualificationScore: number;

    lifecycleStatus: "detected" | "developing" | "confirmed" | "weakening" | "invalidated" | "archived";
    bias: "bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "bearish" | "unscored";
    conviction: number | null;
    baseCase: string;
    bullCase: string;
    bearCase: string;
    tailCase: string | null;
    strongestSupport: string;
    strongestContradiction: string;
    researchSynthesis: string;
    whatChanged: string;
    previousState: string;
    currentState: string;
    marketReaction: string;
    acceptedExplanation: string;
    acceptedExplanationEvidenceIds: string[];
    overlookedVariable: string;
    overlookedVariableEvidenceStatus: "observed" | "strongly_supported" | "inferred" | "speculative";
    overlookedVariableEvidenceIds: string[];
    marketMayBeRight: string;
    mechanismSteps: Array<{
      step: number;
      text: string;
      evidenceStatus: "observed" | "strongly_supported" | "inferred" | "speculative";
    }>;
    plainEnglish: string | null;
    themes: string[];
    prohibitedClaims: string[];
    changeKinds: Array<"evidence" | "catalyst" | "price_confirmation" | "probability" | "cross_asset_transmission" | "official_communication" | "management_communication" | "watchlist_state">;
  }>;
};

export type DeduplicationOutput = {
  decisions: Array<{
    candidateKey: string;
    noveltyClass: "new_story" | "existing_story_update" | "duplicate" | "related_distinct" | "insufficient_novelty";
    matchedStoryId: string | null;
    similarityScore: number;
    rationale: string;
    exceptionProof: {
      distinctEvent: boolean;
      distinctMechanism: boolean;
      distinctDecisiveEvidence: boolean;
      distinctCatalyst: boolean;
    };
  }>;
};

export type LifecycleOutput = {
  decisions: Array<{
    candidateKey: string;
    lifecycleStatus: "detected" | "developing" | "confirmed" | "weakening" | "invalidated" | "archived";
    reason: string;
  }>;
};

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"], minimum: 0, maximum: 100 };
const stringArray = { type: "array", items: { type: "string" } };
const nullableStringArray4 = {
  anyOf: [
    { type: "array", maxItems: 4, items: { type: "string" } },
    { type: "null" },
  ],
};
const nullableNextCatalyst = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["label", "catalystRef"],
      properties: {
        label: { type: "string" },
        catalystRef: nullableString,
      },
    },
    { type: "null" },
  ],
};
const requirementIdArray = {
  type: "array",
  items: { type: "string", enum: STABLE_REQUIREMENT_IDS },
  uniqueItems: true,
};

export const MARKET_BELIEF_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["beliefs", "storyAssessments"],
  properties: {
    beliefs: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "pricedState", "consensusStrength", "affectedAssets", "evidenceIds"],
        properties: {
          statement: { type: "string" },
          pricedState: nullableString,
          consensusStrength: { type: "number", minimum: 0, maximum: 100 },
          affectedAssets: stringArray,
          evidenceIds: stringArray,
        },
      },
    },
    storyAssessments: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "storyId",
          "disposition",
          "rationale",
          "confidenceDelta",
          "evidenceIds",
          "proposedTitle",
          "proposedThesis",
          "proposedMarketQuestion",
          "proposedConfirmation",
          "proposedInvalidation",
          "proposedNextCatalyst",
        ],
        properties: {
          storyId: { type: "string" },
          disposition: { type: "string", enum: ["unchanged", "reinforced", "weakened", "reframed", "invalidated"] },
          rationale: { type: "string" },
          confidenceDelta: { type: "number", minimum: -100, maximum: 100 },
          evidenceIds: stringArray,
          proposedTitle: nullableString,
          proposedThesis: nullableString,
          proposedMarketQuestion: nullableString,
          proposedConfirmation: nullableStringArray4,
          proposedInvalidation: nullableStringArray4,
          proposedNextCatalyst: nullableNextCatalyst,
        },
      },
    },
  },
};

export const DIVERGENCE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["divergences"],
  properties: {
    divergences: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["marketBeliefId", "observedChange", "expectedChange", "magnitude", "persistenceScore", "decisiveEvidenceIds"],
        properties: {
          marketBeliefId: { type: "string" },
          observedChange: { type: "string" },
          expectedChange: nullableString,
          magnitude: { type: "number", minimum: 0, maximum: 100 },
          persistenceScore: { type: "number", minimum: 0, maximum: 100 },
          decisiveEvidenceIds: stringArray,
        },
      },
    },
  },
};

const boundedStringArray4 = { type: "array", maxItems: 4, items: { type: "string" } };

export const HYPOTHESIS_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["hypotheses"],
  properties: {
    hypotheses: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["divergenceId", "question", "statement", "causalMechanism", "affectedAssets", "evidenceForIds", "evidenceAgainstIds", "causalChain", "confirmationCriteria", "invalidationCriteria", "nextCatalysts", "confidence"],
        properties: {
          divergenceId: { type: "string" },
          question: { type: "string" },
          statement: { type: "string" },
          causalMechanism: { type: "string" },
          affectedAssets: stringArray,
          evidenceForIds: stringArray,
          evidenceAgainstIds: stringArray,
          causalChain: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["from", "relationship", "to", "evidenceState", "evidenceIds"],
              properties: {
                from: { type: "string" },
                relationship: { type: "string" },
                to: { type: "string" },
                evidenceState: { type: "string", enum: ["observed", "strongly_supported", "inferred", "speculative"] },
                evidenceIds: stringArray,
              },
            },
          },
          confirmationCriteria: boundedStringArray4,
          invalidationCriteria: boundedStringArray4,
          nextCatalysts: boundedStringArray4,
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
      },
    },
  },
};

export const CHALLENGER_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assessments"],
  properties: {
    assessments: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["hypothesisId", "verdict", "strongestCountercase", "weakestLink", "hiddenAssumptions", "alternativeMechanisms", "missingEvidence", "missingRequirementIds", "conflictingEvidenceIds", "pricingConfirmation", "crossAssetConfirmation", "timingRisk", "nextResolvingEvidence", "adjustedConfidence", "confidenceAdjustment"],
        properties: {
          hypothesisId: { type: "string" },
          verdict: { type: "string", enum: ["promote", "downgrade", "watch", "reject"] },
          strongestCountercase: { type: "string" },
          weakestLink: nullableString,
          hiddenAssumptions: stringArray,
          alternativeMechanisms: stringArray,
          missingEvidence: stringArray,
          missingRequirementIds: requirementIdArray,
          conflictingEvidenceIds: stringArray,
          pricingConfirmation: nullableString,
          crossAssetConfirmation: nullableString,
          timingRisk: nullableString,
          nextResolvingEvidence: nullableString,
          adjustedConfidence: { type: "number", minimum: 0, maximum: 100 },
          confidenceAdjustment: { type: "number", minimum: -100, maximum: 100 },
        },
      },
    },
  },
};

const scenarioCase = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "probability"],
  properties: {
    summary: { type: "string" },
    probability: nullableNumber,
  },
};

export const SCENARIO_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scenarios"],
  properties: {
    scenarios: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["hypothesisId", "asset", "bias", "conviction", "baseCase", "bullCase", "bearCase", "tailCase", "confirmation", "invalidation", "explanatoryEvidenceIds"],
        properties: {
          hypothesisId: { type: "string" },
          asset: { type: "string" },
          bias: { type: "string", enum: ["bullish", "slightly_bullish", "neutral", "slightly_bearish", "bearish", "unscored"] },
          conviction: nullableNumber,
          baseCase: scenarioCase,
          bullCase: scenarioCase,
          bearCase: scenarioCase,
          tailCase: { anyOf: [scenarioCase, { type: "null" }] },
          confirmation: { type: "string" },
          invalidation: { type: "string" },
          explanatoryEvidenceIds: stringArray,
        },
      },
    },
  },
};

export const STORY_SYNTHESIS_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["primaryHypothesisId", "title", "thesis", "question", "marketBelief", "divergenceSummary", "eventSignature", "causalMechanism", "affectedAssets", "decisiveEvidenceIds", "confirmationCriteria", "invalidationCriteria", "nextCatalysts", "confidence", "qualificationScore", "lifecycleStatus", "bias", "conviction", "baseCase", "bullCase", "bearCase", "tailCase", "strongestSupport", "strongestContradiction", "researchSynthesis", "whatChanged", "previousState", "currentState", "marketReaction", "acceptedExplanation", "acceptedExplanationEvidenceIds", "overlookedVariable", "overlookedVariableEvidenceStatus", "overlookedVariableEvidenceIds", "marketMayBeRight", "mechanismSteps", "plainEnglish", "themes", "prohibitedClaims", "changeKinds"],
        properties: {
          primaryHypothesisId: { type: "string" },
          title: { type: "string" },
          thesis: { type: "string" },
          question: { type: "string" },
          marketBelief: { type: "string" },
          divergenceSummary: { type: "string" },
          eventSignature: { type: "string" },
          causalMechanism: { type: "string" },
          affectedAssets: stringArray,
          decisiveEvidenceIds: stringArray,
          confirmationCriteria: stringArray,
          invalidationCriteria: stringArray,
          nextCatalysts: stringArray,
          confidence: { type: "number", minimum: 0, maximum: 100 },
          qualificationScore: { type: "number", minimum: 0, maximum: 100 },

          lifecycleStatus: { type: "string", enum: ["detected", "developing", "confirmed", "weakening", "invalidated", "archived"] },
          bias: { type: "string", enum: ["bullish", "slightly_bullish", "neutral", "slightly_bearish", "bearish", "unscored"] },
          conviction: nullableNumber,
          baseCase: { type: "string" },
          bullCase: { type: "string" },
          bearCase: { type: "string" },
          tailCase: nullableString,
          strongestSupport: { type: "string" },
          strongestContradiction: { type: "string" },
          researchSynthesis: { type: "string" },
          whatChanged: { type: "string" },
          previousState: { type: "string" },
          currentState: { type: "string" },
          marketReaction: { type: "string" },
          acceptedExplanation: { type: "string" },
          acceptedExplanationEvidenceIds: stringArray,
          overlookedVariable: { type: "string" },
          overlookedVariableEvidenceStatus: { type: "string", enum: ["observed", "strongly_supported", "inferred", "speculative"] },
          overlookedVariableEvidenceIds: stringArray,
          marketMayBeRight: { type: "string" },
          mechanismSteps: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["step", "text", "evidenceStatus"],
              properties: {
                step: { type: "integer", minimum: 1 },
                text: { type: "string" },
                evidenceStatus: { type: "string", enum: ["observed", "strongly_supported", "inferred", "speculative"] },
              },
            },
          },
          plainEnglish: nullableString,
          themes: stringArray,
          prohibitedClaims: stringArray,
          changeKinds: {
            type: "array",
            items: { type: "string", enum: ["evidence", "catalyst", "price_confirmation", "probability", "cross_asset_transmission", "official_communication", "management_communication", "watchlist_state"] },
          },
        },
      },
    },
  },
};

export const DEDUPLICATION_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["candidateKey", "noveltyClass", "matchedStoryId", "similarityScore", "rationale", "exceptionProof"],
        properties: {
          candidateKey: { type: "string" },
          noveltyClass: { type: "string", enum: ["new_story", "existing_story_update", "duplicate", "related_distinct", "insufficient_novelty"] },
          matchedStoryId: nullableString,
          similarityScore: { type: "number", minimum: 0, maximum: 100 },
          rationale: { type: "string" },
          exceptionProof: {
            type: "object",
            additionalProperties: false,
            required: ["distinctEvent", "distinctMechanism", "distinctDecisiveEvidence", "distinctCatalyst"],
            properties: {
              distinctEvent: { type: "boolean" },
              distinctMechanism: { type: "boolean" },
              distinctDecisiveEvidence: { type: "boolean" },
              distinctCatalyst: { type: "boolean" },
            },
          },
        },
      },
    },
  },
};

export const LIFECYCLE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["candidateKey", "lifecycleStatus", "reason"],
        properties: {
          candidateKey: { type: "string" },
          lifecycleStatus: { type: "string", enum: ["detected", "developing", "confirmed", "weakening", "invalidated", "archived"] },
          reason: { type: "string" },
        },
      },
    },
  },
};