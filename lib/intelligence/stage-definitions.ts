import type {
  ChallengerAssessment,
  Divergence,
  EntityExtraction,
  EvidenceClass,
  EvidenceObject,
  Hypothesis,
  MarketBelief,
  NoveltyClass,
  ScenarioScore,
  StageDefinition,
  StoryCandidate,
  StoryLifecycleStatus,
} from "./contracts.ts";

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as JsonRecord;
}

function text(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  return value;
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
}

function nullableNumber(value: unknown, label: string) {
  return value === null || value === undefined ? null : numberValue(value, label);
}

function booleanValue(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map((item, index) => record(item, `item ${index}`)) : [];
}

const stringSchema = { type: "string" };
const numberSchema = { type: "number" };
const booleanSchema = { type: "boolean" };
const stringArraySchema = { type: "array", items: stringSchema };

function objectSchema(properties: JsonRecord, required: string[]) {
  return { type: "object", properties, required, additionalProperties: false };
}

export const normalizerDefinition: StageDefinition<EvidenceObject> = {
  key: "normalizer",
  version: 1,
  instructions: "Normalize one acquired provider record into the canonical Evidence Object. Keep source identity, event time, availability time, provenance URLs, affected assets/topics, uncertainty and the original payload. Do not infer a missing observation.",
  outputSchema: objectSchema({
    providerKey: stringSchema,
    sourceExternalId: { type: ["string", "null"] },
    sourceName: stringSchema,
    sourceType: stringSchema,
    sourceUrl: { type: ["string", "null"] },
    sourceAncestryKey: stringSchema,
    sourceTier: numberSchema,
    reliabilityScore: numberSchema,
    externalEvidenceId: { type: ["string", "null"] },
    evidenceClass: { type: "string", enum: ["official_release", "market_observation", "company_primary", "transcript", "regulatory_filing", "news_report", "research_analysis", "derived_metric", "other"] },
    supportDirection: { type: "string", enum: ["supports", "contradicts", "mixed", "neutral", "context"] },
    claimText: stringSchema,
    summary: { type: ["string", "null"] },
    eventAt: { type: ["string", "null"] },
    publishedAt: { type: ["string", "null"] },
    availableAt: { type: ["string", "null"] },
    receivedAt: stringSchema,
    geography: { type: ["string", "null"] },
    affectedAssets: stringArraySchema,
    affectedTopics: stringArraySchema,
    confidence: numberSchema,
    provenanceUrls: stringArraySchema,
    contentHash: stringSchema,
    structuredPayload: { type: "object" },
    rawPayload: { type: "object" },
    normalizerVersion: stringSchema,
  }, ["providerKey", "sourceName", "sourceType", "sourceAncestryKey", "sourceTier", "reliabilityScore", "evidenceClass", "supportDirection", "claimText", "receivedAt", "affectedAssets", "affectedTopics", "confidence", "provenanceUrls", "contentHash", "structuredPayload", "rawPayload", "normalizerVersion"]),
  parse(value) {
    const item = record(value, "normalizer output");
    return {
      providerKey: text(item.providerKey, "providerKey"),
      sourceExternalId: optionalText(item.sourceExternalId),
      sourceName: text(item.sourceName, "sourceName"),
      sourceType: text(item.sourceType, "sourceType"),
      sourceUrl: optionalText(item.sourceUrl),
      sourceAncestryKey: text(item.sourceAncestryKey, "sourceAncestryKey"),
      sourceTier: numberValue(item.sourceTier, "sourceTier"),
      reliabilityScore: numberValue(item.reliabilityScore, "reliabilityScore"),
      externalEvidenceId: optionalText(item.externalEvidenceId),
      evidenceClass: text(item.evidenceClass, "evidenceClass") as EvidenceClass,
      supportDirection: text(item.supportDirection, "supportDirection") as EvidenceObject["supportDirection"],
      claimText: text(item.claimText, "claimText"),
      summary: optionalText(item.summary),
      eventAt: optionalText(item.eventAt),
      publishedAt: optionalText(item.publishedAt),
      availableAt: optionalText(item.availableAt),
      receivedAt: text(item.receivedAt, "receivedAt"),
      geography: optionalText(item.geography),
      affectedAssets: strings(item.affectedAssets),
      affectedTopics: strings(item.affectedTopics),
      confidence: numberValue(item.confidence, "confidence"),
      provenanceUrls: strings(item.provenanceUrls),
      contentHash: text(item.contentHash, "contentHash"),
      structuredPayload: record(item.structuredPayload, "structuredPayload"),
      rawPayload: record(item.rawPayload, "rawPayload"),
      normalizerVersion: text(item.normalizerVersion, "normalizerVersion"),
    };
  },
};

export const entityExtractorDefinition: StageDefinition<EntityExtraction> = {
  key: "entity_extractor",
  version: 1,
  instructions: "Extract only canonical entities and explicit, evidence-supported relationships. Use stable lowercase canonical keys. Do not infer ownership or causality from co-mention alone.",
  outputSchema: objectSchema({
    entities: { type: "array", items: objectSchema({ canonicalKey: stringSchema, type: stringSchema, name: stringSchema, aliases: stringArraySchema, identifiers: { type: "object" }, salience: numberSchema }, ["canonicalKey", "type", "name", "aliases", "identifiers", "salience"]) },
    relationships: { type: "array", items: objectSchema({ fromCanonicalKey: stringSchema, relationship: stringSchema, toCanonicalKey: stringSchema, direction: { type: "string", enum: ["directed", "bidirectional"] }, confidence: numberSchema, evidenceSummary: stringSchema }, ["fromCanonicalKey", "relationship", "toCanonicalKey", "direction", "confidence", "evidenceSummary"]) },
  }, ["entities", "relationships"]),
  parse(value) {
    const item = record(value, "entity output");
    return {
      entities: records(item.entities).map((entity) => ({
        canonicalKey: text(entity.canonicalKey, "canonicalKey"),
        type: text(entity.type, "entity type"),
        name: text(entity.name, "entity name"),
        aliases: strings(entity.aliases),
        identifiers: Object.fromEntries(Object.entries(record(entity.identifiers, "identifiers")).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
        salience: numberValue(entity.salience, "salience"),
      })),
      relationships: records(item.relationships).map((relationship) => ({
        fromCanonicalKey: text(relationship.fromCanonicalKey, "fromCanonicalKey"),
        relationship: text(relationship.relationship, "relationship"),
        toCanonicalKey: text(relationship.toCanonicalKey, "toCanonicalKey"),
        direction: text(relationship.direction, "direction") as "directed" | "bidirectional",
        confidence: numberValue(relationship.confidence, "confidence"),
        evidenceSummary: text(relationship.evidenceSummary, "evidenceSummary"),
      })),
    };
  },
};

export const marketBeliefDefinition: StageDefinition<MarketBelief> = {
  key: "market_belief",
  version: 1,
  instructions: "State the prior market belief or priced assumption independently of the new evidence. If pricing evidence is weak, lower consensus strength rather than presenting certainty.",
  outputSchema: objectSchema({ beliefKey: stringSchema, statement: stringSchema, pricedState: stringSchema, consensusStrength: numberSchema, affectedAssets: stringArraySchema, evidenceIds: stringArraySchema }, ["beliefKey", "statement", "pricedState", "consensusStrength", "affectedAssets", "evidenceIds"]),
  parse(value) {
    const item = record(value, "market belief output");
    return { beliefKey: text(item.beliefKey, "beliefKey"), statement: text(item.statement, "statement"), pricedState: text(item.pricedState, "pricedState"), consensusStrength: numberValue(item.consensusStrength, "consensusStrength"), affectedAssets: strings(item.affectedAssets), evidenceIds: strings(item.evidenceIds) };
  },
};

export const divergenceDefinition: StageDefinition<Divergence> = {
  key: "divergence",
  version: 1,
  instructions: "Compare the observed evidence with the prior market belief. Mark material false when the difference is already priced, immaterial, stale or insufficiently supported.",
  outputSchema: objectSchema({ divergenceKey: stringSchema, material: booleanSchema, observedChange: stringSchema, expectedChange: stringSchema, magnitude: numberSchema, persistenceScore: numberSchema, decisiveEvidenceIds: stringArraySchema }, ["divergenceKey", "material", "observedChange", "expectedChange", "magnitude", "persistenceScore", "decisiveEvidenceIds"]),
  parse(value) {
    const item = record(value, "divergence output");
    return { divergenceKey: text(item.divergenceKey, "divergenceKey"), material: booleanValue(item.material, "material"), observedChange: text(item.observedChange, "observedChange"), expectedChange: text(item.expectedChange, "expectedChange"), magnitude: numberValue(item.magnitude, "magnitude"), persistenceScore: numberValue(item.persistenceScore, "persistenceScore"), decisiveEvidenceIds: strings(item.decisiveEvidenceIds) };
  },
};

export const hypothesisDefinition: StageDefinition<Hypothesis[]> = {
  key: "hypothesis",
  version: 2,
  instructions: "Generate two or three genuinely competing, testable causal hypotheses for the material divergence. Every causal link must be labelled observed, strongly_supported, inferred or speculative. Use only supplied evidence IDs and source ancestry. Include evidence for and against, confirmation, invalidation and the next resolving catalyst.",
  outputSchema: objectSchema({ hypotheses: { type: "array", minItems: 2, maxItems: 3, items: objectSchema({
    hypothesisKey: stringSchema,
    question: stringSchema,
    statement: stringSchema,
    marketBelief: { type: ["string", "null"] },
    divergence: stringSchema,
    causalMechanism: stringSchema,
    affectedAssets: stringArraySchema,
    evidenceForIds: stringArraySchema,
    evidenceAgainstIds: stringArraySchema,
    decisiveEvidenceIds: stringArraySchema,
    sourceAncestryGroupIds: stringArraySchema,
    causalChain: { type: "array", items: objectSchema({ from: stringSchema, to: stringSchema, mechanism: stringSchema, evidenceStatus: { type: "string", enum: ["observed", "strongly_supported", "inferred", "speculative"] } }, ["from", "to", "mechanism", "evidenceStatus"]) },
    confirmationCriteria: stringArraySchema,
    invalidationCriteria: stringArraySchema,
    nextCatalysts: stringArraySchema,
    confidence: numberSchema,
  }, ["hypothesisKey", "question", "statement", "marketBelief", "divergence", "causalMechanism", "affectedAssets", "evidenceForIds", "evidenceAgainstIds", "decisiveEvidenceIds", "sourceAncestryGroupIds", "causalChain", "confirmationCriteria", "invalidationCriteria", "nextCatalysts", "confidence"]) } }, ["hypotheses"]),
  parse(value) {
    const item = record(value, "hypothesis output");
    return records(item.hypotheses).map((hypothesis) => ({
      hypothesisKey: text(hypothesis.hypothesisKey, "hypothesisKey"),
      question: text(hypothesis.question, "question"),
      statement: text(hypothesis.statement, "statement"),
      marketBelief: optionalText(hypothesis.marketBelief),
      divergence: text(hypothesis.divergence, "divergence"),
      causalMechanism: text(hypothesis.causalMechanism, "causalMechanism"),
      affectedAssets: strings(hypothesis.affectedAssets),
      evidenceForIds: strings(hypothesis.evidenceForIds),
      evidenceAgainstIds: strings(hypothesis.evidenceAgainstIds),
      decisiveEvidenceIds: strings(hypothesis.decisiveEvidenceIds),
      sourceAncestryGroupIds: strings(hypothesis.sourceAncestryGroupIds),
      causalChain: records(hypothesis.causalChain).map((link) => ({
        from: text(link.from, "causal from"),
        to: text(link.to, "causal to"),
        mechanism: text(link.mechanism, "causal mechanism"),
        evidenceStatus: text(link.evidenceStatus, "causal evidenceStatus") as Hypothesis["causalChain"][number]["evidenceStatus"],
      })),
      confirmationCriteria: strings(hypothesis.confirmationCriteria),
      invalidationCriteria: strings(hypothesis.invalidationCriteria),
      nextCatalysts: strings(hypothesis.nextCatalysts),
      confidence: numberValue(hypothesis.confidence, "confidence"),
    }));
  },
};

export const challengerDefinition: StageDefinition<ChallengerAssessment> = {
  key: "challenger",
  version: 2,
  instructions: "Audit one hypothesis using only supplied evidence or explicit absence of evidence. Test whether it is priced, confirmed by price/rates/cross-assets/positioning/fundamentals, whether the causal chain is active, its weakest link, timing risk and the next resolving evidence. Never invent counterevidence.",
  outputSchema: objectSchema({
    hypothesisKey: stringSchema,
    verdict: { type: "string", enum: ["promote", "downgrade", "watch", "reject"] },
    weakestLink: { type: ["string", "null"] },
    strongestCountercase: stringSchema,
    conflictingEvidenceIds: stringArraySchema,
    pricingConfirmation: { type: ["string", "null"] },
    crossAssetConfirmation: { type: ["string", "null"] },
    timingRisk: { type: ["string", "null"] },
    nextResolvingEvidence: { type: ["string", "null"] },
    hiddenAssumptions: stringArraySchema,
    alternativeMechanisms: stringArraySchema,
    missingEvidence: stringArraySchema,
    confidenceAdjustment: numberSchema,
    adjustedConfidence: numberSchema,
  }, ["hypothesisKey", "verdict", "weakestLink", "strongestCountercase", "conflictingEvidenceIds", "pricingConfirmation", "crossAssetConfirmation", "timingRisk", "nextResolvingEvidence", "hiddenAssumptions", "alternativeMechanisms", "missingEvidence", "confidenceAdjustment", "adjustedConfidence"]),
  parse(value) {
    const item = record(value, "challenger output");
    return {
      hypothesisKey: text(item.hypothesisKey, "hypothesisKey"),
      verdict: text(item.verdict, "verdict") as ChallengerAssessment["verdict"],
      weakestLink: optionalText(item.weakestLink),
      strongestCountercase: text(item.strongestCountercase, "strongestCountercase"),
      conflictingEvidenceIds: strings(item.conflictingEvidenceIds),
      pricingConfirmation: optionalText(item.pricingConfirmation),
      crossAssetConfirmation: optionalText(item.crossAssetConfirmation),
      timingRisk: optionalText(item.timingRisk),
      nextResolvingEvidence: optionalText(item.nextResolvingEvidence),
      hiddenAssumptions: strings(item.hiddenAssumptions),
      alternativeMechanisms: strings(item.alternativeMechanisms),
      missingEvidence: strings(item.missingEvidence),
      confidenceAdjustment: numberValue(item.confidenceAdjustment, "confidenceAdjustment"),
      adjustedConfidence: numberValue(item.adjustedConfidence, "adjustedConfidence"),
    };
  },
};

export const scenarioDefinition: StageDefinition<ScenarioScore[]> = {
  key: "scenario",
  version: 1,
  instructions: "Create asset-specific base, bull, bear and optional tail scenarios for one promoted hypothesis. Probabilities must sum to 100, avoid false precision, and use unscored with null conviction when evidence is insufficient. Different assets may have different conclusions.",
  outputSchema: objectSchema({ scenarios: { type: "array", minItems: 1, maxItems: 12, items: objectSchema({
    hypothesisKey: stringSchema,
    asset: stringSchema,
    bias: { type: "string", enum: ["bullish", "slightly_bullish", "neutral", "slightly_bearish", "bearish", "unscored"] },
    conviction: { type: ["number", "null"] },
    baseCase: objectSchema({ description: stringSchema, probability: numberSchema }, ["description", "probability"]),
    bullCase: objectSchema({ description: stringSchema, probability: numberSchema }, ["description", "probability"]),
    bearCase: objectSchema({ description: stringSchema, probability: numberSchema }, ["description", "probability"]),
    tailCase: { anyOf: [{ type: "null" }, objectSchema({ description: stringSchema, probability: numberSchema }, ["description", "probability"])] },
    confirmation: stringSchema,
    invalidation: stringSchema,
    explanatoryEvidenceIds: stringArraySchema,
  }, ["hypothesisKey", "asset", "bias", "conviction", "baseCase", "bullCase", "bearCase", "tailCase", "confirmation", "invalidation", "explanatoryEvidenceIds"]) } }, ["scenarios"]),
  parse(value) {
    const item = record(value, "scenario output");
    return records(item.scenarios).map((scenario) => {
      const base = record(scenario.baseCase, "baseCase");
      const bull = record(scenario.bullCase, "bullCase");
      const bear = record(scenario.bearCase, "bearCase");
      const tail = scenario.tailCase === null ? null : record(scenario.tailCase, "tailCase");
      const parsed: ScenarioScore = {
        hypothesisKey: text(scenario.hypothesisKey, "scenario hypothesisKey"),
        asset: text(scenario.asset, "scenario asset"),
        bias: text(scenario.bias, "scenario bias") as ScenarioScore["bias"],
        conviction: nullableNumber(scenario.conviction, "scenario conviction"),
        baseCase: { description: text(base.description, "base description"), probability: numberValue(base.probability, "base probability") },
        bullCase: { description: text(bull.description, "bull description"), probability: numberValue(bull.probability, "bull probability") },
        bearCase: { description: text(bear.description, "bear description"), probability: numberValue(bear.probability, "bear probability") },
        tailCase: tail ? { description: text(tail.description, "tail description"), probability: numberValue(tail.probability, "tail probability") } : null,
        confirmation: text(scenario.confirmation, "scenario confirmation"),
        invalidation: text(scenario.invalidation, "scenario invalidation"),
        explanatoryEvidenceIds: strings(scenario.explanatoryEvidenceIds),
      };
      const total = parsed.baseCase.probability + parsed.bullCase.probability + parsed.bearCase.probability + (parsed.tailCase?.probability || 0);
      if (Math.abs(total - 100) > 1) throw new Error(`Scenario probabilities for ${parsed.asset} must sum to 100; received ${total}.`);
      if (parsed.bias === "unscored" && parsed.conviction !== null) throw new Error(`Unscored scenario ${parsed.asset} must have null conviction.`);
      return parsed;
    });
  },
};

function parseStoryCandidate(item: JsonRecord): StoryCandidate {
  return {
    title: text(item.title, "title"),
    question: text(item.question, "question"),
    thesis: text(item.thesis, "thesis"),
    marketBelief: optionalText(item.marketBelief),
    divergence: text(item.divergence, "divergence"),
    bias: text(item.bias, "bias") as ScenarioScore["bias"],
    conviction: nullableNumber(item.conviction, "conviction"),
    baseCase: text(item.baseCase, "baseCase"),
    bullCase: text(item.bullCase, "bullCase"),
    bearCase: text(item.bearCase, "bearCase"),
    tailCase: optionalText(item.tailCase),
    strongestSupport: text(item.strongestSupport, "strongestSupport"),
    strongestContradiction: text(item.strongestContradiction, "strongestContradiction"),
    hypothesisKey: text(item.hypothesisKey, "hypothesisKey"),
    eventSignature: text(item.eventSignature, "eventSignature"),
    causalMechanism: text(item.causalMechanism, "causalMechanism"),
    affectedAssets: strings(item.affectedAssets),
    decisiveEvidenceIds: strings(item.decisiveEvidenceIds),
    sourceAncestryGroupIds: strings(item.sourceAncestryGroupIds),
    confirmationCriteria: strings(item.confirmationCriteria),
    invalidationCriteria: strings(item.invalidationCriteria),
    nextCatalysts: strings(item.nextCatalysts),
    confidence: numberValue(item.confidence, "confidence"),
    lifecycleStatus: text(item.lifecycleStatus, "lifecycleStatus") as StoryLifecycleStatus,
    publicationEligible: booleanValue(item.publicationEligible, "publicationEligible"),
    qualificationScore: numberValue(item.qualificationScore, "qualificationScore"),
    canonicalExternalUrl: optionalText(item.canonicalExternalUrl),
    researchSynthesis: optionalText(item.researchSynthesis),
  };
}

const storyCandidateSchema = objectSchema({
  title: stringSchema,
  question: stringSchema,
  thesis: stringSchema,
  marketBelief: { type: ["string", "null"] },
  divergence: stringSchema,
  bias: { type: "string", enum: ["bullish", "slightly_bullish", "neutral", "slightly_bearish", "bearish", "unscored"] },
  conviction: { type: ["number", "null"] },
  baseCase: stringSchema,
  bullCase: stringSchema,
  bearCase: stringSchema,
  tailCase: { type: ["string", "null"] },
  strongestSupport: stringSchema,
  strongestContradiction: stringSchema,
  hypothesisKey: stringSchema,
  eventSignature: stringSchema,
  causalMechanism: stringSchema,
  affectedAssets: stringArraySchema,
  decisiveEvidenceIds: stringArraySchema,
  sourceAncestryGroupIds: stringArraySchema,
  confirmationCriteria: stringArraySchema,
  invalidationCriteria: stringArraySchema,
  nextCatalysts: stringArraySchema,
  confidence: numberSchema,
  lifecycleStatus: { type: "string", enum: ["detected", "developing", "confirmed", "weakening", "invalidated", "archived"] },
  publicationEligible: booleanSchema,
  qualificationScore: numberSchema,
  canonicalExternalUrl: { type: ["string", "null"] },
  researchSynthesis: { type: ["string", "null"] },
}, ["title", "question", "thesis", "marketBelief", "divergence", "bias", "conviction", "baseCase", "bullCase", "bearCase", "tailCase", "strongestSupport", "strongestContradiction", "hypothesisKey", "eventSignature", "causalMechanism", "affectedAssets", "decisiveEvidenceIds", "sourceAncestryGroupIds", "confirmationCriteria", "invalidationCriteria", "nextCatalysts", "confidence", "lifecycleStatus", "publicationEligible", "qualificationScore", "canonicalExternalUrl", "researchSynthesis"]);

export const storySynthesisDefinition: StageDefinition<StoryCandidate[]> = {
  key: "story_synthesis",
  version: 2,
  instructions: "Synthesize zero or one original first-party Alchemy Story from one promoted hypothesis and its asset scenarios. Include the question, market belief, divergence, bias, conviction, cases, support, contradiction and falsifiable tests. Do not create filler. canonicalExternalUrl may be null because provenance belongs in the Evidence Room.",
  outputSchema: objectSchema({ candidates: { type: "array", maxItems: 1, items: storyCandidateSchema } }, ["candidates"]),
  parse(value) {
    const item = record(value, "story synthesis output");
    return records(item.candidates).map(parseStoryCandidate);
  },
};

export type SemanticDeduplicationDecision = {
  classification: NoveltyClass;
  duplicateOfId: string | null;
  similarityScore: number;
  rationale: string;
};

export const semanticDeduplicationDefinition: StageDefinition<SemanticDeduplicationDecision> = {
  key: "semantic_deduplication",
  version: 1,
  instructions: "Compare one candidate with novelty memory and active Stories. Prefer an existing Story update over a new duplicate. Same-event Stories are distinct only when mechanism, market, independent evidence and confirmation/invalidation are all distinct.",
  outputSchema: objectSchema({ classification: { type: "string", enum: ["new_story", "existing_story_update", "duplicate", "related_distinct", "insufficient_novelty"] }, duplicateOfId: { type: ["string", "null"] }, similarityScore: numberSchema, rationale: stringSchema }, ["classification", "duplicateOfId", "similarityScore", "rationale"]),
  parse(value) {
    const item = record(value, "semantic deduplication output");
    return { classification: text(item.classification, "classification") as NoveltyClass, duplicateOfId: optionalText(item.duplicateOfId), similarityScore: numberValue(item.similarityScore, "similarityScore"), rationale: text(item.rationale, "rationale") };
  },
};

export type LifecycleDecision = { status: StoryLifecycleStatus; reason: string; confidence: number };

export const lifecycleDefinition: StageDefinition<LifecycleDecision> = {
  key: "lifecycle",
  version: 1,
  instructions: "Choose the persistent lifecycle transition caused by the supplied new evidence. Do not reset a mature Story to detected and do not archive merely because it was not selected for today's Live set.",
  outputSchema: objectSchema({ status: { type: "string", enum: ["detected", "developing", "confirmed", "weakening", "invalidated", "archived"] }, reason: stringSchema, confidence: numberSchema }, ["status", "reason", "confidence"]),
  parse(value) {
    const item = record(value, "lifecycle output");
    return { status: text(item.status, "status") as StoryLifecycleStatus, reason: text(item.reason, "reason"), confidence: numberValue(item.confidence, "confidence") };
  },
};

export const positioningRecommenderDefinition: StageDefinition<JsonRecord> = {
  key: "positioning_recommender",
  version: 1,
  instructions: "Evaluate positioning and order-book evidence as an independent lens. State coverage limitations, concentration, horizon and whether the signal confirms, contradicts or merely contextualizes the hypothesis.",
  outputSchema: objectSchema({ assessment: stringSchema, direction: { type: "string", enum: ["supports", "contradicts", "mixed", "context", "unavailable"] }, limitations: stringArraySchema, confidence: numberSchema }, ["assessment", "direction", "limitations", "confidence"]),
  parse(value) {
    return record(value, "positioning output");
  },
};
