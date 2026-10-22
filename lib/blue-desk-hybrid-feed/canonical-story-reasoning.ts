// @ts-nocheck
// Hybrid source parity; projection only, no new canonical reasoning writes.
export const CANONICAL_STORY_REASONING_V1 = "canonical-story-reasoning/v1";

export const REASONING_AVAILABILITY = Object.freeze({
  V1: "v1",
  LEGACY_CORE_ONLY: "legacy_core_only",
  UNAVAILABLE: "unavailable",
});

const EVIDENCE_STATES = new Set(["observed", "strongly_supported", "inferred", "speculative"]);
const CLAIM_TYPES = new Set(["fact", "interpretation", "thesis", "speculation"]);
const LIFECYCLE_STATES = new Set(["detected", "developing", "confirmed", "weakening", "invalidated", "archived"]);
const ASSET_BIASES = new Set(["bullish", "bearish", "neutral", "mixed", "unscored"]);
const NEXT_TEST_STATES = new Set(["upcoming", "due", "resolved", "expired"]);
const SERIES_TRANSFORMS = new Set(["level", "change", "yoy", "mom", "return", "spread", "indexed"]);
const SERIES_ROLES = new Set(["driver", "asset", "benchmark", "observed", "expected", "spread"]);
const EXPECTED_RELATIONSHIPS = new Set(["positive", "inverse", "divergent", "none_asserted"]);

export const LEGACY_CAUSAL_DIAGNOSTIC = "Canonical causal reasoning was not preserved for this legacy Story version.";
export const MISSING_SERIES_DIAGNOSTIC = "No canonical series relationship was attached to this Story version.";
export const INVALID_V1_DIAGNOSTIC = "Canonical V1 reasoning was present but failed validation. Hybrid will render preserved core fields only.";
export const UNAVAILABLE_DIAGNOSTIC = "This Story version does not contain enough preserved canonical state for a safe analytical presentation.";

function clone(value) {
  if (value == null) return value;
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isString(value) {
  return typeof value === "string";
}

function isNullableString(value) {
  return value === null || isString(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isString);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value) {
  return value === null || isNumber(value);
}

function exactlyOneOf(value, allowed) {
  return isString(value) && allowed.has(value);
}

function validClaim(value) {
  return isObject(value)
    && isString(value.id)
    && exactlyOneOf(value.type, CLAIM_TYPES)
    && isString(value.text)
    && isStringArray(value.evidenceIds);
}

function validCausalEdge(value) {
  return isObject(value)
    && isString(value.id)
    && isString(value.sourceHypothesisId)
    && isString(value.from)
    && isString(value.relationship)
    && isString(value.to)
    && exactlyOneOf(value.evidenceState, EVIDENCE_STATES)
    && isStringArray(value.evidenceIds);
}

function validCountercase(value) {
  return isObject(value)
    && isNullableString(value.strongest)
    && isStringArray(value.evidenceIds)
    && isNullableString(value.weakestLink)
    && isNullableString(value.marketMayBeRight);
}

function validOverlookedVariable(value) {
  return isObject(value)
    && isNullableString(value.text)
    && (value.evidenceState === null || exactlyOneOf(value.evidenceState, EVIDENCE_STATES))
    && isStringArray(value.evidenceIds);
}

function validAssetImplication(value) {
  return isObject(value)
    && isString(value.asset)
    && exactlyOneOf(value.bias, ASSET_BIASES)
    && isNullableNumber(value.conviction)
    && isString(value.baseCase)
    && isStringArray(value.evidenceIds)
    && isString(value.confirmation)
    && isString(value.invalidation);
}

function validNextTest(value) {
  return value === null || (
    isObject(value)
    && isString(value.id)
    && isString(value.label)
    && exactlyOneOf(value.status, NEXT_TEST_STATES)
    && isNullableString(value.catalystRef)
    && isNullableString(value.dueAt)
    && isNullableString(value.expiresAt)
    && isStringArray(value.evidenceIds)
    && isStringArray(value.resolutionEvidenceIds)
  );
}

function validSeries(value) {
  return isObject(value)
    && isString(value.seriesId)
    && isString(value.label)
    && isNullableString(value.geography)
    && exactlyOneOf(value.transform, SERIES_TRANSFORMS)
    && exactlyOneOf(value.role, SERIES_ROLES);
}

function validEntity(value) {
  if (!isObject(value) || !isString(value.entityId) || !isString(value.label) || !isStringArray(value.evidenceIds)) return false;
  if (!isObject(value.geography)) return false;
  if (value.geography.kind === "country") return isString(value.geography.countryCode);
  if (value.geography.kind === "coordinate") {
    return isNumber(value.geography.lat)
      && value.geography.lat >= -90
      && value.geography.lat <= 90
      && isNumber(value.geography.lon)
      && value.geography.lon >= -180
      && value.geography.lon <= 180;
  }
  return false;
}

function validConditionRef(value, reasoning) {
  if (!isObject(value) || !isString(value.kind)) return false;
  if (value.kind === "next_test") return reasoning.nextTest !== null;
  if (!Number.isInteger(value.index) || value.index < 0) return false;
  if (value.kind === "confirmation") return value.index < reasoning.confirmation.length;
  if (value.kind === "invalidation") return value.index < reasoning.invalidation.length;
  return false;
}

function allKnown(values, allowed) {
  return values.every((value) => allowed.has(value));
}

function validVisual(value, reasoning, edgeIds, claimIds) {
  if (!isObject(value) || !isString(value.id) || !isString(value.title) || !isString(value.type)) return false;

  if (value.type === "linear_chain") {
    return isStringArray(value.edgeIds) && value.edgeIds.length > 0 && allKnown(value.edgeIds, edgeIds);
  }
  if (value.type === "feedback_loop") {
    return isStringArray(value.edgeIds)
      && value.edgeIds.length > 0
      && allKnown(value.edgeIds, edgeIds)
      && isString(value.loopClosureEdgeId)
      && edgeIds.has(value.loopClosureEdgeId);
  }
  if (value.type === "money_or_commodity_flow") {
    return isStringArray(value.edgeIds)
      && value.edgeIds.length > 0
      && allKnown(value.edgeIds, edgeIds)
      && Array.isArray(value.entities)
      && value.entities.length > 0
      && value.entities.every(validEntity)
      && isString(value.flowLabel);
  }
  if (value.type === "entity_map") {
    return Array.isArray(value.entities)
      && value.entities.length > 0
      && value.entities.every(validEntity)
      && isStringArray(value.connectionEdgeIds)
      && allKnown(value.connectionEdgeIds, edgeIds);
  }
  if (value.type === "divergence_chart") {
    return Array.isArray(value.series)
      && value.series.length > 0
      && value.series.every(validSeries)
      && exactlyOneOf(value.expectedRelationship, EXPECTED_RELATIONSHIPS)
      && isStringArray(value.evidenceIds)
      && isObject(value.window)
      && isNullableString(value.window.start)
      && isNullableString(value.window.end)
      && (value.window.observations === null || (Number.isInteger(value.window.observations) && value.window.observations >= 0));
  }
  if (value.type === "before_after") {
    return isStringArray(value.beforeClaimIds)
      && isStringArray(value.afterClaimIds)
      && allKnown(value.beforeClaimIds, claimIds)
      && allKnown(value.afterClaimIds, claimIds)
      && isStringArray(value.changeEvidenceIds)
      && Array.isArray(value.series)
      && value.series.every(validSeries);
  }
  if (value.type === "decision_tree") {
    return isString(value.rootClaimId)
      && claimIds.has(value.rootClaimId)
      && Array.isArray(value.branches)
      && value.branches.length > 0
      && value.branches.every((branch) => (
        isObject(branch)
        && validConditionRef(branch.conditionRef, reasoning)
        && isStringArray(branch.outcomeClaimIds)
        && allKnown(branch.outcomeClaimIds, claimIds)
      ));
  }
  return false;
}

function directValue(story, camel, snake = null) {
  if (story?.[camel] !== undefined) return story[camel];
  return snake && story?.[snake] !== undefined ? story[snake] : null;
}

export function canonicalCoreFromStory(story) {
  if (!isObject(story)) return null;
  const id = directValue(story, "id");
  const title = directValue(story, "title");
  const thesis = directValue(story, "thesis");
  if (!isString(id) || !isString(title) || !isString(thesis) || !title.trim() || !thesis.trim()) return null;

  return {
    id,
    slug: directValue(story, "slug"),
    title,
    marketQuestion: directValue(story, "marketQuestion", "market_question"),
    thesis,
    confidence: directValue(story, "confidence"),
    status: directValue(story, "status"),
    confirmation: directValue(story, "confirmationCondition", "confirmation_trigger"),
    invalidation: directValue(story, "invalidationCondition", "invalidation_trigger"),
    nextCatalyst: directValue(story, "nextCatalyst", "next_catalyst"),
    assets: Array.isArray(story.assets) ? clone(story.assets) : [],
    thesisVersion: clone(directValue(story, "thesisVersion", "thesis_version")),
  };
}

export function isCanonicalStoryReasoningV1(value, story = null) {
  if (!isObject(value)) return false;
  if (value.contractVersion !== CANONICAL_STORY_REASONING_V1) return false;
  if (!isString(value.storyId) || !isString(value.storyVersionId)) return false;
  if (!Number.isInteger(value.versionNumber) || value.versionNumber < 1) return false;
  if (!isString(value.effectiveAt) || !isString(value.title) || !isNullableString(value.centralQuestion)) return false;
  if (!exactlyOneOf(value.lifecycle, LIFECYCLE_STATES)) return false;
  if (!isNumber(value.confidence) || value.confidence < 0 || value.confidence > 100 || !isString(value.thesis)) return false;
  if (!["whatChanged", "previousState", "currentState", "marketReaction", "acceptedExplanation"].every((key) => isNullableString(value[key]))) return false;
  if (!Array.isArray(value.claims) || !value.claims.every(validClaim)) return false;
  if (!Array.isArray(value.causalChain) || !value.causalChain.every(validCausalEdge)) return false;
  if (!validCountercase(value.countercase) || !validOverlookedVariable(value.overlookedVariable)) return false;
  if (!Array.isArray(value.assetImplications) || !value.assetImplications.every(validAssetImplication)) return false;
  if (!isStringArray(value.confirmation) || !isStringArray(value.invalidation) || !validNextTest(value.nextTest)) return false;
  if (!Array.isArray(value.visualPlan)) return false;

  const claimIds = new Set(value.claims.map((claim) => claim.id));
  const edgeIds = new Set(value.causalChain.map((edge) => edge.id));
  if (claimIds.size !== value.claims.length || edgeIds.size !== value.causalChain.length) return false;
  if (!value.visualPlan.every((visual) => validVisual(visual, value, edgeIds, claimIds))) return false;

  const core = canonicalCoreFromStory(story);
  if (core) {
    if (value.storyId !== core.id || value.title !== core.title || value.thesis !== core.thesis) return false;
    if (core.marketQuestion !== null && value.centralQuestion !== core.marketQuestion) return false;
    if (isNumber(core.confidence) && value.confidence !== core.confidence) return false;
    const versionId = core.thesisVersion?.id || core.thesisVersion?.versionId || core.thesisVersion?.version_id || null;
    if (versionId && value.storyVersionId !== versionId) return false;
  }
  return true;
}

function visualPlanHasCanonicalSeries(visualPlan) {
  return visualPlan.some((visual) => Array.isArray(visual.series) && visual.series.length > 0);
}

export function readCanonicalStoryReasoning(story) {
  const core = canonicalCoreFromStory(story);
  const supplied = isObject(story) ? story.canonicalStoryReasoning : null;

  if (isCanonicalStoryReasoningV1(supplied, story)) {
    const reasoning = clone(supplied);
    const diagnostics = visualPlanHasCanonicalSeries(reasoning.visualPlan)
      ? []
      : [MISSING_SERIES_DIAGNOSTIC];
    return {
      reasoningAvailability: REASONING_AVAILABILITY.V1,
      reasoning,
      core,
      diagnostics,
    };
  }

  if (core) {
    return {
      reasoningAvailability: REASONING_AVAILABILITY.LEGACY_CORE_ONLY,
      reasoning: null,
      core,
      diagnostics: [
        supplied ? INVALID_V1_DIAGNOSTIC : LEGACY_CAUSAL_DIAGNOSTIC,
        MISSING_SERIES_DIAGNOSTIC,
      ],
    };
  }

  return {
    reasoningAvailability: REASONING_AVAILABILITY.UNAVAILABLE,
    reasoning: null,
    core: null,
    diagnostics: [UNAVAILABLE_DIAGNOSTIC, MISSING_SERIES_DIAGNOSTIC],
  };
}
