import "server-only";

import { createHash } from "node:crypto";

import {
  applyExplanationPass,
  composeAlchemyEdition,
  type AlchemyEdition,
  type EditionStory,
  type ThemeWatch,
  type WatchlistItem,
} from "@/lib/intelligence/edition";
import { startIntelligenceEngineRun } from "@/lib/intelligence/engine-run";
import { OpenAIStageError, openAIIntelligenceEnabled, runStructuredStage } from "@/lib/intelligence/openai";
import { buildStageFailurePersistencePayload } from "./openai-core.ts";
import {
  completedStageCheckpoints,
  hasReusableStagePayload,
  type PersistedStageRun,
  type StageCheckpoint,
} from "@/lib/intelligence/resumable-checkpoints";
import {
  ScheduledIntelligenceDeadlineError,
  createScheduledStageBudgetController,
  scheduledStageTimeoutFailure,
  type ScheduledStageBudgetController,
} from "@/lib/intelligence/scheduled-runtime-budget";
import {
  CHALLENGER_SCHEMA,
  DEDUPLICATION_SCHEMA,
  DIVERGENCE_SCHEMA,
  HYPOTHESIS_SCHEMA,
  LIFECYCLE_SCHEMA,
  MARKET_BELIEF_SCHEMA,
  SCENARIO_SCHEMA,
  type ChallengerOutput,
  type DeduplicationOutput,
  type DivergenceOutput,
  type EvidencePackItem,
  type ExistingStoryPackItem,
  type HypothesisOutput,
  type LifecycleOutput,
  type MarketBeliefOutput,
  type ScenarioOutput,
  type StoryReviewTargetPackItem,
} from "@/lib/intelligence/schemas";
import {
  STORY_SYNTHESIS_WITH_PLAN_SCHEMA,
  type StorySynthesisWithPlanOutputV1,
} from "@/lib/intelligence/story-synthesis-contract-v1";
import {
  STABLE_REQUIREMENT_IDS,
  evaluateCandidateIntegrity,
  evaluateRuntimeResearchState,
  researchRequirementRegistry,
  validateScopedRequirementIds,
  type ResearchRequirement,
  type ResearchStateResult,
} from "@/lib/intelligence/research-state";
import {
  buildHypothesisEvidencePack,
  buildHypothesisStoryPack,
} from "./hypothesis-core.ts";
import { buildAncestryUpsertSpecs } from "@/lib/intelligence/intake-normalization";
import { freezeStoryReviewTargets, intelligenceDatabaseConfigured, intelligenceRest } from "@/lib/intelligence/supabase";
import { currentIntelligenceInvocation } from "@/lib/intelligence/invocation-context";
import { materialAssessmentHasEligibleEvidence, selectStoryReviewTargets, type StoryEvidenceLink, type StoryReviewDebt, type StoryReviewQueueItem, type StoryReviewStory } from "@/lib/intelligence/story-review";
import { explicitlyMentionedAssets, normaliseInstrument } from "@/lib/instrument-mentions";
import { getHybridDeskData } from "@/lib/data";
import { getHybridPublicationRecords, selectHybridPublicationStoryStates } from "@/lib/hybrid-publication";
import { getStoryHeaderImages } from "@/lib/story-images";
import {
  buildCanonicalStoryReasoningSnapshotV1,
  canonicalCausalEdgeId,
  type EvidenceState,
  type StoryReasoningEvidence,
  type StoryReasoningHypothesis,
} from "@/lib/intelligence/story-reasoning";
import { buildValidatedStorySynthesisPlanV1 } from "@/lib/intelligence/story-synthesis-plan";

export type IntelligenceTriggerKind = "scheduled" | "new_evidence" | "manual" | "targeted_reevaluation" | "api";

export type IntelligenceRunResult = {
  enabled: boolean;
  engineRunId: string | null;
  status: "completed" | "partial" | "failed" | "blocked" | "skipped";
  evidenceConsidered: number;
  hypothesesGenerated: number;
  hypothesesPromoted: number;
  storiesConsidered: number;
  storiesPublished: number;
  storyIds: string[];
  warnings: string[];
};

type IntakeRow = {
  id: string;
  run_id: string;
  item_key: string;
  item_type: "video" | "news" | "alchemy_article";
  publisher: string;
  title: string;
  url: string;
  published_at: string;
  transcript_status: string | null;
  summary: string;
  affected_story_slugs: string[];
  source_quality: number;
  relevance: number;
  novelty: number;
  materiality: number;
  candidate_score: number;
  recommended_action: string;
  status: string;
  divergence_kind: string | null;
  divergence_note: string | null;
  evidence_links: unknown;
};

type StoryRow = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  market_question: string | null;
  dominant_narrative: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  assets: string[];
  created_by?: string;
};

type StoryRequirementRow = {
  story_id: string;
  requirement_key: string;
  label: string;
};

type PromptVersion = {
  id: string;
  stage_key: string;
  version: number;
  prompt_text: string;
  model_hint: string | null;
};

type StageRunRow = PersistedStageRun;
type StageClaimRow = {
  stage_run_id: string;
  claim_state: "claimed" | "completed" | "busy";
  output_payload: unknown;
};
type CanonicalSource = {
  id: string;
  external_source_id: string | null;
  source_name: string;
  source_tier: number;
  reliability_score: number;
  ancestry_group_id: string | null;
};

type CanonicalEvidenceRow = {
  id: string;
  source_id: string;
  claim_text: string;
  summary: string | null;
  evidence_class: string;
  support_direction: string;
  event_at: string | null;
  published_at: string | null;
  affected_assets: string[];
  affected_topics: string[];
  provenance_urls: string[];
  source?: CanonicalSource | CanonicalSource[] | null;
};

type BeliefRow = {
  id: string;
  belief_key: string;
  statement: string;
  priced_state: string | null;
  consensus_strength: number;
  affected_assets: string[];
  evidence_ids: string[];
};

type DivergenceRow = {
  id: string;
  divergence_key: string;
  market_belief_id: string;
  observed_change: string;
  expected_change: string | null;
  magnitude: number;
  persistence_score: number;
  decisive_evidence_ids: string[];
};

type HypothesisRow = {
  id: string;
  hypothesis_key: string;
  divergence_id: string | null;
  question: string | null;
  statement: string;
  causal_mechanism: string;
  affected_assets: string[];
  evidence_for_ids: string[];
  evidence_against_ids: string[];
  causal_chain: unknown;
  confirmation_criteria: string[];
  invalidation_criteria: string[];
  next_catalysts: string[];
  confidence: number;
  status: string;
  decision_state: string;
};

type ChallengerRow = ChallengerOutput["assessments"][number] & {
  stageRunId: string | null;
  allowedRequirementIds: string[];
  unknownRequirementIds: string[];
  outOfScopeRequirementIds: string[];
};

type ScenarioRow = {
  engine_run_id: string;
  hypothesis_id: string;
  asset: string;
  bias: ScenarioOutput["scenarios"][number]["bias"];
  conviction: number | null;
  base_case: ScenarioOutput["scenarios"][number]["baseCase"];
  bull_case: ScenarioOutput["scenarios"][number]["bullCase"];
  bear_case: ScenarioOutput["scenarios"][number]["bearCase"];
  tail_case: ScenarioOutput["scenarios"][number]["tailCase"];
  confirmation: string;
  invalidation: string;
  explanatory_evidence_ids: string[];
};

type StoryReasoningContext = {
  hypothesis: HypothesisRow;
  challenger: ChallengerRow;
  scenarios: ScenarioRow[];
  evidenceById: Map<string, EvidencePackItem>;
};

type CandidateWorking = StorySynthesisWithPlanOutputV1["candidates"][number] & {
  candidateKey: string;
  noveltyFingerprint: string;
};

type CandidatePersisted = { id: string; candidateKey: string; primaryHypothesisId: string };

const MAX_EVIDENCE = 72;
const LOOKBACK_DAYS = 90;


const CORE_RULES = `You are the reasoning layer inside the Alchemy Markets Live Desk. The Live Desk is the canonical research brain.
Use only the evidence, Stories, hypotheses and scenario records supplied in this request. Never invent a source, fact, market move, consensus view, evidence ID or Story ID.
This is not a news summarisation task. Synthesize across independent evidence, distinguish the accepted market view from the overlooked variable, build explicit causal mechanisms, test the strongest countercase and preserve uncertainty.
Creator/video commentary is research-lead material, not proof unless independently verified. Source depth and corroboration inform research state, confidence and follow-up priority; they do not decide publication.
Do not claim that something is unpriced or mispriced unless the supplied evidence directly supports that conclusion.
Prefer updating an existing Story when the event, thesis, mechanism and deciding evidence are substantially the same. Do not create a duplicate Story merely because the headline changed.
Every confirmation or invalidation condition must be observable.
Rank sources in this order: official releases; company filings, earnings releases and official transcripts; direct market data; specialist physical or industry data; reputable named-source reporting; analyst commentary; social media.
Treat political and social statements as evidence of messaging or intent unless independent evidence verifies the real-world condition.
Use British English, calm probabilistic language and short grade-8 sentences. Return only the requested structured output.`;

const HYPOTHESIS_ROLE_RULES = `For stage "hypothesis": Hypothesis owns causal-thesis formation only.
For each material divergence:
- Formulate testable causal mechanisms explaining why the observed divergence occurred.
- Produce exactly ONE primary causal hypothesis for each divergence by default.
- A second hypothesis is permitted ONLY if it represents a genuinely different competing causal mechanism (e.g. supply disruption versus demand destruction).
- FORBIDDEN: Do NOT create opposite (yes/no), bullish/bearish, or partial/degree variants of the same causal mechanism. Those scenario branches belong in Scenario and Challenger, not Hypothesis.
- Do NOT write full bull/base/bear cases, hidden assumptions, counterarguments, publication eligibility, or customer prose. Focus strictly on central question, causal statement, causal mechanism, affected assets, supporting and conflicting evidence IDs, bounded causal chain, confirmation/invalidation criteria, resolving catalysts, and confidence.`;

const CHALLENGER_REQUIREMENT_RULES = `For each assessment, select missingRequirementIds only from the requirements in that hypothesisId's requirementScopes entry.
These are canonical public.research_story_requirements.requirement_key values. Never translate them into another vocabulary and never use a requirement from another hypothesis scope.
Do not invent or infer requirement IDs from prose. Use missingEvidence only for a human-readable explanation. Missing research informs state and priority; it never decides publication.
Return an empty missingRequirementIds array when the scoped requirements are satisfied or the hypothesis has no scoped requirements.`;

const MARKET_BELIEF_STORY_REVIEW_RULES = `For stage "market_belief", produce normal market beliefs and exactly one existing-Story assessment for every supplied storyReviewTargets item.
Use only that target's maximum-ten relevantEvidence records. Allowed dispositions are unchanged, reinforced, weakened, reframed and invalidated.
An unchanged assessment advances freshness only. It must not rewrite the thesis or manufacture a recalibration.
Creator/video transcript evidence may create a lead or test, but cannot by itself materially change thesis, lifecycle or confidence.
Do not omit a supplied Story. Return an empty storyAssessments array only when storyReviewTargets is empty.`;

const STORY_SYNTHESIS_METHOD_RULES = `Apply the Alchemy Mixed Research Voice Method inside this existing Story Synthesis stage.
For every candidate, reuse question as the one central question. State what changed versus the previous canonical state, the observed market reaction, the accepted explanation, one measurable overlooked variable, and the strongest case for why the market may still be right.
Explain causal arrows one at a time and label each mechanism step observed, strongly_supported, inferred or speculative. Plain-English wording may improve comprehension but must not change thesis, confidence, evidence status, confirmation or invalidation.
Populate changeKinds only when canonical evidence shows a material change in evidence, catalyst, price confirmation or invalidation, probability, cross-asset transmission, official or management communication, or watchlist state. Leave it empty for an unchanged recurring Story.
Do not manufacture four changes. Do not split several updates to one parent Story into separate changes. Use themes selectively and record any claims the evidence does not permit in prohibitedClaims. All descriptive research states may publish when the update is material and has usable traceable evidence.
For nextTestSelection, choose exactly one {label,catalystRef} pair from the matching storyPlanCandidates.catalystCandidates, or null. Never rewrite or invent a catalyst.
For visualPlan, choose presentation form only. Every edge ID, claim ID, series ID, entity ID and analytical relationship must already exist in the matching storyPlanCandidates entry or supplied canonical evidence. If a candidate list is empty, do not invent a replacement. Use [] when no valid visual form can be expressed from the supplied references.
Visual IDs are non-authoritative placeholders and will be replaced deterministically. Do not use title, slug, theme, asset name or general market knowledge to manufacture a series, geography, entity, causal edge or expected relationship.`;

export { buildHypothesisEvidencePack, buildHypothesisStoryPack };

function hash(value: string, length = 32) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function stableKey(prefix: string, ...parts: unknown[]) {
  return `${prefix}:${hash(JSON.stringify(parts), 28)}`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function onlyExplicitAssets(candidates: string[], allowed: string[]) {
  const allowedKeys = new Set(allowed.map(normaliseInstrument));
  return unique(candidates.filter((asset) => allowedKeys.has(normaliseInstrument(asset))));
}

function validUrlList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return unique(value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const url = (item as { url?: unknown }).url;
    if (typeof url !== "string") return [];
    try {
      return new URL(url).protocol === "https:" ? [url] : [];
    } catch {
      return [];
    }
  }));
}

function canonicalDomain(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function slugPart(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "story";
}

function sourceTier(item: IntakeRow) {
  const domain = canonicalDomain(item.url);
  const publisher = item.publisher.toLowerCase();
  if (domain.endsWith(".gov") || domain.includes("federalreserve.gov") || domain.includes("ecb.europa.eu") || domain.includes("boj.or.jp") || domain.includes("bankofengland.co.uk") || domain.includes("rba.gov.au") || domain.includes("bis.org")) return 1;
  if (publisher.includes("tradingview") || publisher.includes("cme") || publisher.includes("ice") || publisher.includes("exchange")) return 2;
  if (item.item_type === "video") return 5;
  if (item.item_type === "alchemy_article") return 4;
  return 3;
}

function evidenceClass(item: IntakeRow) {
  const tier = sourceTier(item);
  const domain = canonicalDomain(item.url);
  if (tier === 1) return "official_release";
  if (tier === 2) return "market_observation";
  if (item.item_type === "video") return "transcript";
  if (item.item_type === "alchemy_article") return "research_analysis";
  if (domain.includes("sec.gov")) return "regulatory_filing";
  return "news_report";
}

function supportDirection(item: IntakeRow) {
  if (item.divergence_kind === "contradiction") return "mixed";
  return "context";
}

function existingStoryPack(stories: StoryRow[]): ExistingStoryPackItem[] {
  return stories.map((story) => ({
    id: story.id,
    slug: story.slug,
    title: story.title,
    thesis: story.thesis,
    status: story.status,
    confidence: story.confidence,
    marketQuestion: story.market_question,
    dominantNarrative: story.dominant_narrative,
    strongestSupport: story.strongest_support,
    strongestContradiction: story.strongest_contradiction,
    confirmationTrigger: story.confirmation_trigger,
    invalidationTrigger: story.invalidation_trigger,
    nextCatalyst: story.next_catalyst,
    assets: story.assets ?? [],
  }));
}

function sourceFromEvidence(row: CanonicalEvidenceRow) {
  return Array.isArray(row.source) ? row.source[0] : row.source;
}

function evidencePack(rows: CanonicalEvidenceRow[]): EvidencePackItem[] {
  return rows.map((row) => {
    const source = sourceFromEvidence(row);
    return {
      id: row.id,
      claim: row.claim_text,
      summary: row.summary,
      evidenceClass: row.evidence_class,
      sourceName: source?.source_name || "Unknown source",
      sourceTier: source?.source_tier ?? 5,
      reliabilityScore: Number(source?.reliability_score ?? 0),
      ancestryGroupId: source?.ancestry_group_id ?? null,
      supportDirection: row.support_direction,
      eventAt: row.event_at,
      publishedAt: row.published_at,
      affectedAssets: row.affected_assets ?? [],
      affectedTopics: row.affected_topics ?? [],
      provenanceUrls: row.provenance_urls ?? [],
    };
  });
}

function onlyKnownIds(values: string[], allowed: Set<string>) {
  return unique((values ?? []).filter((value) => allowed.has(value)));
}

function requireKnownEvidenceIds(values: unknown, allowed: ReadonlySet<string>, context: string) {
  if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
    throw new Error(`${context} must be an array of canonical evidence IDs.`);
  }
  const normalized = unique(values);
  const unknown = normalized.filter((value) => !allowed.has(value));
  if (unknown.length) {
    throw new Error(`${context} references unknown canonical evidence ID(s): ${unknown.join(", ")}`);
  }
  return normalized;
}

async function loadPrompt(stageKey: string) {
  const rows = await intelligenceRest<PromptVersion[]>(
    `intelligence_prompt_versions?select=id,stage_key,version,prompt_text,model_hint&stage_key=eq.${encodeURIComponent(stageKey)}&is_active=eq.true&order=version.desc&limit=1`,
  );
  return rows[0] ?? null;
}

class IntelligenceStageClaimUnavailableError extends Error {
  stageKey: string;
  stageRunId: string;

  constructor(stageKey: string, stageRunId: string) {
    super(`Intelligence stage "${stageKey}" is already claimed by another continuation invocation.`);
    this.name = "IntelligenceStageClaimUnavailableError";
    this.stageKey = stageKey;
    this.stageRunId = stageRunId;
  }
}

async function loadCompletedStageCheckpoints(engineRunId: string) {
  const rows = await intelligenceRest<StageRunRow[]>(
    `intelligence_stage_runs?select=id,stage_key,status,output_payload,started_at,completed_at&engine_run_id=eq.${encodeURIComponent(engineRunId)}&status=eq.completed&order=completed_at.desc.nullslast,started_at.desc`,
  );
  return completedStageCheckpoints(rows);
}

async function claimStage(engineRunId: string, stageKey: string, promptVersionId: string | null, inputRefs: unknown) {
  const rows = await intelligenceRest<StageClaimRow[]>("rpc/claim_intelligence_stage", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_engine_run_id: engineRunId,
      p_stage_key: stageKey,
      p_prompt_version_id: promptVersionId,
      p_input_refs: inputRefs,
      p_stale_after_seconds: 360,
    }),
  });
  const claim = rows[0];
  if (!claim?.stage_run_id || !claim.claim_state) throw new Error(`Unable to claim intelligence stage ${stageKey}.`);
  return claim;
}

async function finishStage(stageRunId: string, payload: {
  status: "completed" | "failed" | "blocked" | "skipped";
  outputPayload?: unknown;
  modelName?: string | null;
  providerRequestId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  failureCode?: string | null;
  failureDetail?: string | null;
}) {
  await intelligenceRest(`intelligence_stage_runs?id=eq.${encodeURIComponent(stageRunId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: payload.status,
      output_payload: payload.outputPayload ?? {},
      model_name: payload.modelName ?? null,
      provider_request_id: payload.providerRequestId ?? null,
      input_tokens: payload.inputTokens ?? null,
      output_tokens: payload.outputTokens ?? null,
      failure_code: payload.failureCode ?? null,
      failure_detail: payload.failureDetail ?? null,
      completed_at: new Date().toISOString(),
    }),
  });
}

async function modelStage<T>({
  engineRunId,
  stageKey,
  input,
  schema,
  modelKind,
  maxOutputTokens,
  requestTimeoutMs,
  maxAttempts,
  scheduledBudgetController,
  completedCheckpoints,
}: {
  engineRunId: string;
  stageKey: string;
  input: unknown;
  schema: Record<string, unknown>;
  modelKind: "complex" | "fast";
  maxOutputTokens?: number;
  requestTimeoutMs?: number;
  maxAttempts?: number;
  scheduledBudgetController?: ScheduledStageBudgetController;
  completedCheckpoints?: Map<string, StageCheckpoint>;
}) {
  const checkpoint = completedCheckpoints?.get(stageKey);
  if (checkpoint) {
    return { data: checkpoint.outputPayload as T, stageRunId: checkpoint.stageRunId, reused: true as const };
  }
  const prompt = await loadPrompt(stageKey);
  const inputRefs = {
    evidenceCount: Array.isArray((input as { evidence?: unknown[] })?.evidence) ? (input as { evidence: unknown[] }).evidence.length : undefined,
    storyCount: Array.isArray((input as { existingStories?: unknown[] })?.existingStories) ? (input as { existingStories: unknown[] }).existingStories.length : undefined,
    storyReviewTargetCount: Array.isArray((input as { storyReviewTargets?: unknown[] })?.storyReviewTargets) ? (input as { storyReviewTargets: unknown[] }).storyReviewTargets.length : undefined,
    storyReviewTargetIds: Array.isArray((input as { storyReviewTargets?: Array<{ story?: { id?: string } }> })?.storyReviewTargets)
      ? (input as { storyReviewTargets: Array<{ story?: { id?: string } }> }).storyReviewTargets.map((target) => target.story?.id).filter(Boolean)
      : undefined,
  };
  const claim = await claimStage(engineRunId, stageKey, prompt?.id ?? null, inputRefs);
  if (claim.claim_state === "busy") throw new IntelligenceStageClaimUnavailableError(stageKey, claim.stage_run_id);
  if (claim.claim_state === "completed") {
    if (!hasReusableStagePayload(stageKey, claim.output_payload)) {
      throw new Error(`Completed intelligence checkpoint ${stageKey} has an invalid persisted payload and cannot be reused.`);
    }
    const recovered = { stageRunId: claim.stage_run_id, stageKey, outputPayload: claim.output_payload };
    completedCheckpoints?.set(stageKey, recovered);
    return { data: claim.output_payload as T, stageRunId: claim.stage_run_id, reused: true as const };
  }
  const stageRunId = claim.stage_run_id;
  let effectiveTimeoutMs = requestTimeoutMs;
  try {
    effectiveTimeoutMs = scheduledBudgetController
      ? scheduledBudgetController.timeoutFor(stageKey)
      : requestTimeoutMs;
    const result = await runStructuredStage<T>({
      stageKey,
      instructions: `${CORE_RULES}\n\nStage mandate: ${prompt?.prompt_text || stageKey}.${stageKey === "market_belief" ? `\n\n${MARKET_BELIEF_STORY_REVIEW_RULES}` : ""}${stageKey === "hypothesis" ? `\n\n${HYPOTHESIS_ROLE_RULES}` : ""}${stageKey === "challenger" ? `\n\n${CHALLENGER_REQUIREMENT_RULES}` : ""}${stageKey === "story_synthesis" ? `\n\n${STORY_SYNTHESIS_METHOD_RULES}` : ""}`,
      input,
      schema,
      modelKind,
      maxOutputTokens,
      requestTimeoutMs: effectiveTimeoutMs,
      maxAttempts,
    });
    await finishStage(stageRunId, {
      status: "completed",
      outputPayload: result.data,
      modelName: result.model,
      providerRequestId: result.requestId || result.responseId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    completedCheckpoints?.set(stageKey, { stageRunId, stageKey, outputPayload: result.data });
    return { data: result.data, stageRunId, reused: false as const };
  } catch (error) {
    const stageError = error instanceof OpenAIStageError ? error : null;
    const code = error instanceof ScheduledIntelligenceDeadlineError
      ? error.code
      : stageError ? stageError.code : "stage_error";
    const originalMessage = error instanceof Error ? error.message : "Unknown intelligence stage failure.";
    const message = code === "timeout" && Number.isFinite(effectiveTimeoutMs)
      ? scheduledStageTimeoutFailure(stageKey, effectiveTimeoutMs!)
      : originalMessage;
    const failurePayload = buildStageFailurePersistencePayload({
      message,
      failureCode: code,
      stageError,
    });
    await finishStage(stageRunId, {
      status: error instanceof OpenAIStageError && error.code === "configuration_required" ? "blocked" : "failed",
      ...failurePayload,
    });
    if (message !== originalMessage && error instanceof OpenAIStageError) {
      throw new OpenAIStageError(message, {
        code: error.code,
        status: error.status,
        retryable: error.retryable,
        model: error.model,
        requestId: error.requestId,
        responseId: error.responseId,
        inputTokens: error.inputTokens,
        outputTokens: error.outputTokens,
        totalTokens: error.totalTokens,
        providerStatus: error.providerStatus,
        incompleteReason: error.incompleteReason,
        generatedLength: error.generatedLength,
        generatedHash: error.generatedHash,
      });
    }
    throw error;
  }
}

async function loadStories() {
  return intelligenceRest<StoryRow[]>(
    "stories?select=id,slug,title,thesis,status,confidence,market_question,dominant_narrative,strongest_support,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,assets,created_by&status=neq.archived&status=neq.discarded&order=updated_at.desc",
  );
}

async function loadStoryRequirements(stories: StoryRow[]) {
  const storyById = new Map(stories.map((story) => [story.id, story]));
  const rows = await intelligenceRest<StoryRequirementRow[]>(
    "research_story_requirements?select=story_id,requirement_key,label&is_active=eq.true&is_required=eq.true",
  );
  return researchRequirementRegistry(rows.flatMap((row) => {
    const story = storyById.get(row.story_id);
    return story ? [{
      requirementId: row.requirement_key,
      name: row.label,
      storyId: story.id,
      storySlug: story.slug,
    }] : [];
  }));
}

function scopeRequirementsByHypothesis(
  hypotheses: HypothesisRow[],
  evidenceById: Map<string, EvidencePackItem>,
  stories: StoryRow[],
  requirements: ResearchRequirement[],
) {
  const storyBySlug = new Map(stories.map((story) => [story.slug, story]));
  const requirementsByStory = new Map<string, ResearchRequirement[]>();
  for (const requirement of requirements) {
    const existing = requirementsByStory.get(requirement.storyId) ?? [];
    existing.push(requirement);
    requirementsByStory.set(requirement.storyId, existing);
  }

  return hypotheses.map((hypothesis) => {
    const evidenceIds = unique([...(hypothesis.evidence_for_ids ?? []), ...(hypothesis.evidence_against_ids ?? [])]);
    const storySlugs = unique(evidenceIds.flatMap((id) => evidenceById.get(id)?.affectedTopics ?? []))
      .filter((slug) => storyBySlug.has(slug));
    const storyIds = storySlugs.map((slug) => storyBySlug.get(slug)!.id);
    const scopedRequirements = storyIds.flatMap((storyId) => requirementsByStory.get(storyId) ?? []);
    return {
      hypothesisId: hypothesis.id,
      storyIds,
      storySlugs,
      requirements: scopedRequirements,
    };
  });
}

async function canonicaliseIntake(stories: StoryRow[]) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const rows = await intelligenceRest<IntakeRow[]>(
    `research_intake_items?select=id,run_id,item_key,item_type,publisher,title,url,published_at,transcript_status,summary,affected_story_slugs,source_quality,relevance,novelty,materiality,candidate_score,recommended_action,status,divergence_kind,divergence_note,evidence_links&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=180`,
  );
  const usable = rows.filter((item) => {
    if (!item.summary?.trim() || !item.url?.startsWith("https://")) return false;
    if (item.status === "rejected" || item.status === "blocked") return false;
    if (item.recommended_action === "ignore") return false;
    if (item.item_type === "video" && item.transcript_status !== "ready") return false;
    return true;
  });
  if (!usable.length) return [];

  const storyAssets = new Map(stories.map((story) => [story.slug, story.assets ?? []]));
  const ancestrySpecs = buildAncestryUpsertSpecs(usable);

  const ancestryRows = await intelligenceRest<Array<{ id: string; ancestry_key: string }>>(
    "intelligence_source_ancestry_groups?on_conflict=ancestry_key",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(ancestrySpecs),
    },
  );
  const ancestryByKey = new Map(ancestryRows.map((row) => [row.ancestry_key, row.id]));

  const sourceSpecsByExternal = new Map<string, Record<string, unknown>>();
  for (const item of usable) {
    const domain = canonicalDomain(item.url);
    const externalId = `${domain}|${slugPart(item.publisher)}`;
    sourceSpecsByExternal.set(externalId, {
      ancestry_group_id: ancestryByKey.get(`domain:${domain}`) ?? null,
      provider_key: "research_intake",
      external_source_id: externalId,
      source_name: item.publisher,
      source_type: item.item_type,
      source_url: `https://${domain === "unknown" ? canonicalDomain(item.url) : domain}`,
      source_tier: sourceTier(item),
      reliability_score: clamp(item.source_quality),
      methodology_notes: "Normalized from the validated Alchemy research-intake ledger.",
      metadata: { domain },
      last_seen_at: item.published_at,
      updated_at: new Date().toISOString(),
    });
  }

  const sourceRows = await intelligenceRest<CanonicalSource[]>(
    "intelligence_evidence_sources?on_conflict=provider_key,external_source_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([...sourceSpecsByExternal.values()]),
    },
  );
  const sourceByExternal = new Map(sourceRows.map((row) => [row.external_source_id, row]));

  const evidenceSpecs = usable.flatMap((item) => {
    const domain = canonicalDomain(item.url);
    const source = sourceByExternal.get(`${domain}|${slugPart(item.publisher)}`);
    if (!source) return [];
    const routedAssets = unique((item.affected_story_slugs ?? []).flatMap((slug) => storyAssets.get(slug) ?? []));
    const affectedAssets = explicitlyMentionedAssets(`${item.title}\n${item.summary}\n${item.divergence_note || ""}`, routedAssets);
    return [{
      source_id: source.id,
      research_run_id: item.run_id,
      external_evidence_id: `research-intake:${item.id}`,
      evidence_class: evidenceClass(item),
      support_direction: supportDirection(item),
      claim_text: item.summary.trim(),
      summary: item.divergence_note?.trim() || null,
      event_at: item.published_at,
      published_at: item.published_at,
      available_at: item.published_at,
      affected_assets: affectedAssets,
      affected_topics: item.affected_story_slugs ?? [],
      confidence: clamp((item.source_quality * 0.55) + (item.materiality * 0.25) + (item.relevance * 0.2)),
      freshness_status: "current",
      content_hash: hash(`${item.item_key}|${item.summary}|${item.published_at}`, 64),
      provenance_urls: unique([item.url, ...validUrlList(item.evidence_links)]),
      structured_payload: {
        itemKey: item.item_key,
        title: item.title,
        candidateScore: item.candidate_score,
        relevance: item.relevance,
        novelty: item.novelty,
        materiality: item.materiality,
        recommendedAction: item.recommended_action,
        divergenceKind: item.divergence_kind,
      },
      raw_payload: {},
      normalizer_version: "research-intake-v1",
      updated_at: new Date().toISOString(),
    }];
  });

  if (!evidenceSpecs.length) return [];
  return intelligenceRest<CanonicalEvidenceRow[]>(
    "intelligence_evidence?on_conflict=source_id,content_hash",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(evidenceSpecs),
    },
  );
}

async function loadEvidence() {
  const rows = await intelligenceRest<CanonicalEvidenceRow[]>(
    `intelligence_evidence?select=id,source_id,claim_text,summary,evidence_class,support_direction,event_at,published_at,affected_assets,affected_topics,provenance_urls,source:intelligence_evidence_sources(id,external_source_id,source_name,source_tier,reliability_score,ancestry_group_id)&freshness_status=neq.superseded&order=event_at.desc.nullslast,received_at.desc&limit=${MAX_EVIDENCE}`,
  );
  return evidencePack(rows);
}

type ResearchDebtRow = {
  story_id: string | null;
  debt_key: string;
  severity: string;
  status: string;
  reason: string;
  next_action: string | null;
  next_check_at: string | null;
};

async function loadResearchDebt() {
  return intelligenceRest<ResearchDebtRow[]>(
    "research_debt?select=story_id,debt_key,severity,status,reason,next_action,next_check_at&status=eq.open&order=next_check_at.asc.nullslast&limit=30",
  ).catch(() => []);
}

function validFrozenStoryReviewTargets(value: unknown): value is StoryReviewTargetPackItem[] {
  return Array.isArray(value) && value.every((target) => Boolean(
    target && typeof target === "object"
    && (target as StoryReviewTargetPackItem).story?.id
    && Array.isArray((target as StoryReviewTargetPackItem).relevantEvidence)
    && Array.isArray((target as StoryReviewTargetPackItem).queueIds),
  ));
}

async function claimStoryReviewQueues(engineRunId: string, targets: StoryReviewTargetPackItem[]) {
  const queueIds = unique(targets.flatMap((target) => target.queueIds));
  if (!queueIds.length) return;
  await intelligenceRest("rpc/claim_intelligence_story_reevaluations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ p_engine_run_id: engineRunId, p_queue_ids: queueIds }),
  });
}

async function loadOrCreateStoryReviewTargets(
  engineRunId: string,
  stories: StoryRow[],
  evidence: EvidencePackItem[],
  researchDebt: ResearchDebtRow[],
) {
  const frozen = currentIntelligenceInvocation()?.frozenInputs?.storyReviewTargets;
  if (validFrozenStoryReviewTargets(frozen)) {
    const persisted = structuredClone(frozen);
    await claimStoryReviewQueues(engineRunId, persisted);
    return persisted;
  }
  if (!stories.length) return freezeStoryReviewTargets([]) as Promise<StoryReviewTargetPackItem[]>;

  const storyIds = stories.map((story) => story.id).join(",");
  const [states, links, queued] = await Promise.all([
    intelligenceRest<Array<{
      story_id: string;
      lifecycle_status: string;
      last_evidence_at: string | null;
      last_evaluated_at: string | null;
      next_catalysts: string[];
    }>>("intelligence_story_states?select=story_id,lifecycle_status,last_evidence_at,last_evaluated_at,next_catalysts&story_id=in.(" + storyIds + ")"),
    intelligenceRest<Array<{ story_id: string; evidence_id: string; evidence_role: string; linked_at: string }>>(
      "intelligence_story_evidence?select=story_id,evidence_id,evidence_role,linked_at&story_id=in.(" + storyIds + ")",
    ),
    intelligenceRest<Array<{
      id: string;
      target_id: string;
      status: string;
      reason: string;
      priority: number;
      available_at: string;
      created_at: string;
    }>>("intelligence_reevaluation_queue?select=id,target_id,status,reason,priority,available_at,created_at&target_kind=eq.story&status=in.(pending,retryable)&available_at=lte.now()"),
  ]);
  const stateByStory = new Map(states.map((state) => [state.story_id, state]));
  const packedById = new Map(existingStoryPack(stories).map((story) => [story.id, story]));
  const selectableStories: StoryReviewStory[] = stories.map((story) => {
    const state = stateByStory.get(story.id);
    return {
      ...packedById.get(story.id)!,
      status: state?.lifecycle_status || story.status,
      lastEvaluatedAt: state?.last_evaluated_at ?? null,
      lastEvidenceAt: state?.last_evidence_at ?? null,
      nextCatalysts: unique([...(state?.next_catalysts ?? []), ...(story.next_catalyst ? [story.next_catalyst] : [])]),
    };
  });
  const queue: StoryReviewQueueItem[] = queued.map((item) => ({
    id: item.id,
    storyId: item.target_id,
    status: item.status,
    reason: item.reason,
    priority: item.priority,
    availableAt: item.available_at,
    createdAt: item.created_at,
  }));
  const evidenceLinks: StoryEvidenceLink[] = links.map((link) => ({
    storyId: link.story_id,
    evidenceId: link.evidence_id,
    evidenceRole: link.evidence_role,
    linkedAt: link.linked_at,
  }));
  const debt: StoryReviewDebt[] = researchDebt.map((item) => ({
    storyId: item.story_id,
    debtKey: item.debt_key,
    severity: item.severity,
    status: item.status,
    nextCheckAt: item.next_check_at,
  }));
  const analysisAsOf = currentIntelligenceInvocation()?.frozenInputs?.analysisAsOf || new Date().toISOString();
  const selected = selectStoryReviewTargets({
    stories: selectableStories,
    evidence,
    evidenceLinks,
    queue,
    debt,
    now: new Date(analysisAsOf),
  });
  const persisted = await freezeStoryReviewTargets(selected) as StoryReviewTargetPackItem[];
  await claimStoryReviewQueues(engineRunId, persisted);
  return persisted;
}

async function markStoryReviewRetryable(engineRunId: string, targets: StoryReviewTargetPackItem[]) {
  const queueIds = unique(targets.flatMap((target) => target.queueIds));
  if (!queueIds.length) return;
  await intelligenceRest("intelligence_reevaluation_queue?id=in.(" + queueIds.join(",") + ")&claimed_by_engine_run_id=eq." + encodeURIComponent(engineRunId), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "retryable",
      available_at: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
      last_error: "The Market Belief response omitted or duplicated the required Story assessment.",
      updated_at: new Date().toISOString(),
    }),
  });
}

async function persistStoryAssessments(input: {
  engineRunId: string;
  stageRunId: string;
  output: MarketBeliefOutput;
  targets: StoryReviewTargetPackItem[];
}) {
  const supplied = Array.isArray(input.output.storyAssessments) ? input.output.storyAssessments : [];
  const grouped = new Map<string, typeof supplied>();
  for (const assessment of supplied) {
    const existing = grouped.get(assessment.storyId) ?? [];
    existing.push(assessment);
    grouped.set(assessment.storyId, existing);
  }
  const omitted = input.targets.filter((target) => (grouped.get(target.story.id)?.length ?? 0) !== 1);
  await markStoryReviewRetryable(input.engineRunId, omitted);

  for (const target of input.targets) {
    const matches = grouped.get(target.story.id) ?? [];
    if (matches.length !== 1) continue;
    const assessment = matches[0];
    const allowedEvidence = new Map(target.relevantEvidence.map((item) => [item.id, item]));
    const evidenceIds = unique(assessment.evidenceIds.filter((id) => allowedEvidence.has(id)));
    const eligibleEvidenceIds = evidenceIds.filter((id) => allowedEvidence.get(id)?.evidenceClass !== "transcript");
    const materialAllowed = materialAssessmentHasEligibleEvidence(assessment.disposition, evidenceIds, target);
    const disposition = materialAllowed ? assessment.disposition : "unchanged";
    const evidenceTimes = evidenceIds
      .map((id) => allowedEvidence.get(id)?.eventAt ?? allowedEvidence.get(id)?.publishedAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => Date.parse(right) - Date.parse(left));
    const payload = {
      engine_run_id: input.engineRunId,
      market_belief_stage_run_id: input.stageRunId,
      story_id: target.story.id,
      queue_ids: target.queueIds,
      model_disposition: assessment.disposition,
      disposition,
      rationale: materialAllowed
        ? assessment.rationale
        : assessment.rationale + " Material mutation was suppressed because no eligible non-creator evidence was supplied.",
      confidence_delta: assessment.confidenceDelta,
      proposed_thesis: assessment.proposedThesis?.trim() || null,
      evidence_ids: evidenceIds,
      eligible_evidence_ids: eligibleEvidenceIds,
      last_evidence_at: evidenceTimes[0] ?? null,
      selected_reason: target.reason,
      selected_at: target.selectedAt,
    };
    let rows = await intelligenceRest<Array<{ id: string; applied_at: string | null }>>(
      "intelligence_story_assessments?on_conflict=engine_run_id,story_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(payload),
      },
    );
    if (!rows[0]) {
      rows = await intelligenceRest<Array<{ id: string; applied_at: string | null }>>(
        "intelligence_story_assessments?select=id,applied_at&engine_run_id=eq." + encodeURIComponent(input.engineRunId)
          + "&story_id=eq." + encodeURIComponent(target.story.id) + "&limit=1",
      );
    }
    const row = rows[0];
    if (!row || row.applied_at) continue;
    await intelligenceRest("rpc/apply_intelligence_story_assessment", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ p_assessment_id: row.id }),
    });
  }
}

async function persistBeliefs(output: MarketBeliefOutput, evidenceById: Map<string, EvidencePackItem>) {
  const knownEvidence = new Set(evidenceById.keys());
  const specs = output.beliefs.flatMap((belief) => {
    const evidenceIds = onlyKnownIds(belief.evidenceIds, knownEvidence);
    const allowedAssets = unique(evidenceIds.flatMap((id) => evidenceById.get(id)?.affectedAssets ?? []));
    if (!belief.statement.trim()) return [];
    const beliefKey = stableKey("belief", belief.statement.trim().toLowerCase(), [...belief.affectedAssets].sort());
    return [{
      belief_key: beliefKey,
      statement: belief.statement.trim(),
      priced_state: belief.pricedState?.trim() || null,
      consensus_strength: clamp(belief.consensusStrength),
      affected_assets: onlyExplicitAssets(belief.affectedAssets, allowedAssets),
      evidence_ids: evidenceIds,
      observed_at: new Date().toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
    }];
  });
  if (!specs.length) return [];
  return intelligenceRest<BeliefRow[]>("intelligence_market_beliefs?on_conflict=belief_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(specs),
  });
}

async function persistDivergences(output: DivergenceOutput, beliefs: BeliefRow[], knownEvidence: Set<string>) {
  const beliefIds = new Set(beliefs.map((row) => row.id));
  const specs = output.divergences.flatMap((divergence) => {
    if (!beliefIds.has(divergence.marketBeliefId) || !divergence.observedChange.trim()) return [];
    const decisiveEvidenceIds = onlyKnownIds(divergence.decisiveEvidenceIds, knownEvidence);
    if (!decisiveEvidenceIds.length) return [];
    return [{
      market_belief_id: divergence.marketBeliefId,
      divergence_key: stableKey("divergence", divergence.marketBeliefId, divergence.observedChange.toLowerCase()),
      observed_change: divergence.observedChange.trim(),
      expected_change: divergence.expectedChange?.trim() || null,
      magnitude: clamp(divergence.magnitude),
      persistence_score: clamp(divergence.persistenceScore),
      decisive_evidence_ids: decisiveEvidenceIds,
      status: "open",
      detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
  });
  if (!specs.length) return [];
  return intelligenceRest<DivergenceRow[]>("intelligence_divergences?on_conflict=divergence_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(specs),
  });
}

async function persistHypotheses(
  output: HypothesisOutput,
  divergences: DivergenceRow[],
  beliefs: BeliefRow[],
  knownEvidence: Set<string>,
  allowedHypothesisEvidenceIds?: Set<string>,
) {
  const divergenceIds = new Set(divergences.map((row) => row.id));
  const beliefById = new Map(beliefs.map((row) => [row.id, row]));
  const divergenceById = new Map(divergences.map((row) => [row.id, row]));
  const allowedEvidence = allowedHypothesisEvidenceIds ?? knownEvidence;

  const specs = output.hypotheses.flatMap((hypothesis) => {
    if (!divergenceIds.has(hypothesis.divergenceId) || !hypothesis.statement.trim()) return [];
    const divergence = divergenceById.get(hypothesis.divergenceId)!;
    const belief = beliefById.get(divergence.market_belief_id);
    const evidenceFor = requireKnownEvidenceIds(
      hypothesis.evidenceForIds,
      allowedEvidence,
      `Hypothesis ${hypothesis.divergenceId} supporting evidence`,
    );
    const evidenceAgainst = requireKnownEvidenceIds(
      hypothesis.evidenceAgainstIds,
      allowedEvidence,
      `Hypothesis ${hypothesis.divergenceId} conflicting evidence`,
    );
    const causalChain = hypothesis.causalChain.map((edge, ordinal) => ({
      ...edge,
      evidenceIds: requireKnownEvidenceIds(
        edge.evidenceIds,
        allowedEvidence,
        `Hypothesis ${hypothesis.divergenceId} causal edge ${ordinal}`,
      ),
    }));
    return [{
      divergence_id: hypothesis.divergenceId,
      hypothesis_key: stableKey("hypothesis", hypothesis.statement.toLowerCase(), hypothesis.causalMechanism.toLowerCase(), [...hypothesis.affectedAssets].sort()),
      statement: hypothesis.statement.trim(),
      causal_mechanism: hypothesis.causalMechanism.trim(),
      affected_assets: onlyExplicitAssets(hypothesis.affectedAssets, belief?.affected_assets ?? []),
      confirmation_criteria: unique(hypothesis.confirmationCriteria.filter(Boolean)),
      invalidation_criteria: unique(hypothesis.invalidationCriteria.filter(Boolean)),
      next_catalysts: unique(hypothesis.nextCatalysts.filter(Boolean)),
      confidence: clamp(hypothesis.confidence),
      status: "detected",
      last_evaluated_at: new Date().toISOString(),
      question: hypothesis.question.trim(),
      market_belief: belief?.statement ?? null,
      divergence_summary: divergence.observed_change,
      evidence_for_ids: evidenceFor,
      evidence_against_ids: evidenceAgainst,
      causal_chain: causalChain,
      decision_state: "watch",
      updated_at: new Date().toISOString(),
    }];
  });
  if (!specs.length) return [];
  const rows = await intelligenceRest<HypothesisRow[]>("intelligence_hypotheses?on_conflict=hypothesis_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(specs),
  });

  const links = rows.flatMap((row) => [
    ...(row.evidence_for_ids ?? []).map((evidenceId) => ({ hypothesis_id: row.id, evidence_id: evidenceId, evidence_role: "supporting", weight: 70 })),
    ...(row.evidence_against_ids ?? []).map((evidenceId) => ({ hypothesis_id: row.id, evidence_id: evidenceId, evidence_role: "contradicting", weight: 70 })),
  ]);
  if (links.length) {
    await intelligenceRest("intelligence_hypothesis_evidence?on_conflict=hypothesis_id,evidence_id,evidence_role", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(links),
    });
  }
  return rows;
}

async function persistChallenger(
  output: ChallengerOutput,
  hypotheses: HypothesisRow[],
  stageRunId: string | null,
  knownEvidence: Set<string>,
  knownRequirementIds: ReadonlySet<string>,
  allowedRequirementIdsByHypothesis: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const hypothesisIds = new Set(hypotheses.map((row) => row.id));
  const rows: ChallengerRow[] = output.assessments.flatMap((assessment) => {
    if (!hypothesisIds.has(assessment.hypothesisId)) return [];
    const allowedRequirementIds = allowedRequirementIdsByHypothesis.get(assessment.hypothesisId) ?? new Set<string>();
    const requirementIds = validateScopedRequirementIds(assessment.missingRequirementIds, knownRequirementIds, allowedRequirementIds);
    return [{
      ...assessment,
      missingRequirementIds: requirementIds.known,
      allowedRequirementIds: [...allowedRequirementIds],
      unknownRequirementIds: requirementIds.unknown,
      outOfScopeRequirementIds: requirementIds.outOfScope,
      conflictingEvidenceIds: requireKnownEvidenceIds(
        assessment.conflictingEvidenceIds,
        knownEvidence,
        `Challenger assessment ${assessment.hypothesisId} conflicting evidence`,
      ),
      adjustedConfidence: clamp(assessment.adjustedConfidence),
      confidenceAdjustment: Math.max(-100, Math.min(100, assessment.confidenceAdjustment)),
      stageRunId,
    }];
  });
  if (!rows.length) return [];
  await intelligenceRest("intelligence_challenger_assessments?on_conflict=stage_run_id,hypothesis_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows.map((row) => ({
      hypothesis_id: row.hypothesisId,
      stage_run_id: row.stageRunId,
      verdict: row.verdict,
      strongest_countercase: row.strongestCountercase,
      hidden_assumptions: row.hiddenAssumptions,
      alternative_mechanisms: row.alternativeMechanisms,
      missing_evidence: row.missingEvidence,
      adjusted_confidence: row.adjustedConfidence,
      assessment_payload: {
        missingRequirementIds: row.missingRequirementIds,
        allowedRequirementIds: row.allowedRequirementIds,
        unknownRequirementIds: row.unknownRequirementIds,
        outOfScopeRequirementIds: row.outOfScopeRequirementIds,
        pricingConfirmation: row.pricingConfirmation,
        crossAssetConfirmation: row.crossAssetConfirmation,
        timingRisk: row.timingRisk,
      },
      weakest_link: row.weakestLink,
      conflicting_evidence_ids: row.conflictingEvidenceIds,
      pricing_confirmation: row.pricingConfirmation,
      cross_asset_confirmation: row.crossAssetConfirmation,
      timing_risk: row.timingRisk,
      next_resolving_evidence: row.nextResolvingEvidence,
      confidence_adjustment: row.confidenceAdjustment,
      assessed_at: new Date().toISOString(),
    }))),
  });
  return rows;
}

async function persistScenarios(engineRunId: string, output: ScenarioOutput, promotedHypothesisIds: Set<string>, knownEvidence: Set<string>) {
  const specs: ScenarioRow[] = output.scenarios.flatMap((scenario) => {
    if (!promotedHypothesisIds.has(scenario.hypothesisId) || !scenario.asset.trim()) return [];
    const bias = scenario.bias;
    const conviction = bias === "unscored" ? null : (scenario.conviction === null ? 0 : clamp(scenario.conviction));
    return [{
      engine_run_id: engineRunId,
      hypothesis_id: scenario.hypothesisId,
      asset: scenario.asset.trim(),
      bias,
      conviction,
      base_case: scenario.baseCase,
      bull_case: scenario.bullCase,
      bear_case: scenario.bearCase,
      tail_case: scenario.tailCase,
      confirmation: scenario.confirmation,
      invalidation: scenario.invalidation,
      explanatory_evidence_ids: requireKnownEvidenceIds(
        scenario.explanatoryEvidenceIds,
        knownEvidence,
        `Scenario ${scenario.hypothesisId}/${scenario.asset} explanatory evidence`,
      ),
      updated_at: new Date().toISOString(),
    }];
  });
  if (!specs.length) return [];
  return intelligenceRest<ScenarioRow[]>("intelligence_scenarios?on_conflict=engine_run_id,hypothesis_id,asset", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(specs),
  });
}

function candidateResearchState(candidate: CandidateWorking, evidenceById: Map<string, EvidencePackItem>, challengerByHypothesis: Map<string, ChallengerRow>) {
  const decisive = unique(candidate.decisiveEvidenceIds).flatMap((id) => evidenceById.has(id) ? [evidenceById.get(id)!] : []);
  const independenceGroups = new Set(decisive.map((item) => item.ancestryGroupId).filter(Boolean));
  const hasTierOneOrTwoSource = decisive.some((item) => item.sourceTier <= 2);
  const challenger = challengerByHypothesis.get(candidate.primaryHypothesisId);
  const research = evaluateRuntimeResearchState({
    decisiveEvidenceCount: decisive.length,
    independentSourceGroupCount: independenceGroups.size,
    hasTierOneOrTwoSource,
    challenger,
  });

  const diagnosticLines = [
    `[RESEARCH STATE: ${research.researchState} | completeness ${research.researchCompleteness}%]`,
    research.missingRequirementIds.length ? `Missing canonical requirement IDs: ${research.missingRequirementIds.join(", ")}` : null,
    research.missingEvidence.length ? `Missing evidence: ${research.missingEvidence.join("; ")}` : null,
    research.unknownRequirementIds.length ? `Unknown requirement IDs (diagnostic only): ${research.unknownRequirementIds.join(", ")}` : null,
    research.outOfScopeRequirementIds.length ? `Out-of-scope requirement IDs (isolated): ${research.outOfScopeRequirementIds.join(", ")}` : null,
    `Source depth: ${research.decisiveEvidenceCount} decisive record(s), ${research.independentSourceGroupCount} independent group(s), Tier 1-2 ${research.hasTierOneOrTwoSource ? "present" : "absent"}`,
  ].filter((line): line is string => Boolean(line));
  if (!candidate.researchSynthesis.includes("[RESEARCH STATE:")) {
    candidate.researchSynthesis = `${diagnosticLines.join("\n")}\n${candidate.researchSynthesis}`;
  }

  return { research, decisive };
}
function statusFromLifecycle(value: CandidateWorking["lifecycleStatus"]) {
  if (value === "confirmed") return "publish";
  if (value === "developing") return "develop";
  if (value === "invalidated" || value === "archived") return "archived";
  return "monitor";
}

const EVIDENCE_STATES = new Set<EvidenceState>(["observed", "strongly_supported", "inferred", "speculative"]);

function persistedCausalChain(hypothesis: HypothesisRow): StoryReasoningHypothesis["causalChain"] {
  if (!Array.isArray(hypothesis.causal_chain)) {
    throw new Error(`Persisted Hypothesis ${hypothesis.id} has no canonical causal chain.`);
  }
  return hypothesis.causal_chain.map((value, ordinal) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Persisted Hypothesis ${hypothesis.id} causal edge ${ordinal} is invalid.`);
    }
    const edge = value as Record<string, unknown>;
    if (
      typeof edge.from !== "string"
      || typeof edge.relationship !== "string"
      || typeof edge.to !== "string"
      || typeof edge.evidenceState !== "string"
      || !EVIDENCE_STATES.has(edge.evidenceState as EvidenceState)
      || !Array.isArray(edge.evidenceIds)
      || !edge.evidenceIds.every((id) => typeof id === "string")
    ) {
      throw new Error(`Persisted Hypothesis ${hypothesis.id} causal edge ${ordinal} is invalid.`);
    }
    return {
      from: edge.from,
      relationship: edge.relationship,
      to: edge.to,
      evidenceState: edge.evidenceState as EvidenceState,
      evidenceIds: edge.evidenceIds as string[],
    };
  });
}

function storyPlanCandidatesForHypotheses(hypotheses: HypothesisRow[]) {
  return hypotheses.map((hypothesis) => {
    const causalChain = persistedCausalChain(hypothesis);
    return {
      hypothesisId: hypothesis.id,
      catalystCandidates: unique(hypothesis.next_catalysts.filter(Boolean)).map((label) => ({ label, catalystRef: null })),
      edgeIds: causalChain.map((edge, ordinal) => canonicalCausalEdgeId(hypothesis.id, ordinal, edge)),
      claimIds: [],
      seriesCandidates: [],
      entityCandidates: [],
      expectedRelationships: [],
      confirmationCount: hypothesis.confirmation_criteria.length,
      invalidationCount: hypothesis.invalidation_criteria.length,
    };
  });
}

function buildStoryReasoningSnapshot(
  synthesis: CandidateWorking,
  context: StoryReasoningContext,
  lifecycleStatus: CandidateWorking["lifecycleStatus"],
) {
  if (synthesis.primaryHypothesisId !== context.hypothesis.id) {
    throw new Error(`Story candidate ${synthesis.candidateKey} does not match persisted primary Hypothesis ${context.hypothesis.id}.`);
  }
  if (context.challenger.hypothesisId !== context.hypothesis.id) {
    throw new Error(`Challenger assessment does not match persisted primary Hypothesis ${context.hypothesis.id}.`);
  }
  const evidenceById = new Map<string, StoryReasoningEvidence>(
    [...context.evidenceById.values()].map((item) => [item.id, { id: item.id, claim: item.claim }]),
  );
  const reasoningInput = {
    synthesis: {
      lifecycleStatus,
      thesis: synthesis.thesis,
      whatChanged: synthesis.whatChanged,
      previousState: synthesis.previousState,
      currentState: synthesis.currentState,
      marketReaction: synthesis.marketReaction,
      acceptedExplanation: synthesis.acceptedExplanation,
      acceptedExplanationEvidenceIds: synthesis.acceptedExplanationEvidenceIds,
      overlookedVariable: synthesis.overlookedVariable,
      overlookedVariableEvidenceStatus: synthesis.overlookedVariableEvidenceStatus,
      overlookedVariableEvidenceIds: synthesis.overlookedVariableEvidenceIds,
      marketMayBeRight: synthesis.marketMayBeRight,
      decisiveEvidenceIds: synthesis.decisiveEvidenceIds,
    },
    hypothesis: {
      id: context.hypothesis.id,
      evidenceForIds: context.hypothesis.evidence_for_ids,
      causalChain: persistedCausalChain(context.hypothesis),
      confirmationCriteria: context.hypothesis.confirmation_criteria,
      invalidationCriteria: context.hypothesis.invalidation_criteria,
    },
    challenger: {
      strongestCountercase: context.challenger.strongestCountercase,
      conflictingEvidenceIds: context.challenger.conflictingEvidenceIds,
      weakestLink: context.challenger.weakestLink,
    },
    scenarios: context.scenarios
      .filter((scenario) => scenario.hypothesis_id === context.hypothesis.id)
      .map((scenario) => ({
        asset: scenario.asset,
        bias: scenario.bias,
        conviction: scenario.conviction,
        baseCase: scenario.base_case.summary,
        explanatoryEvidenceIds: scenario.explanatory_evidence_ids,
        confirmation: scenario.confirmation,
        invalidation: scenario.invalidation,
      })),
    evidenceById,
  };
  const baseReasoning = buildCanonicalStoryReasoningSnapshotV1(reasoningInput);
  const knownEvidenceIds = new Set(evidenceById.keys());
  const plan = buildValidatedStorySynthesisPlanV1({
    ownerKey: synthesis.candidateKey,
    selection: {
      nextTest: synthesis.nextTestSelection,
      visualPlan: synthesis.visualPlan,
    },
    catalystCandidates: unique(context.hypothesis.next_catalysts.filter(Boolean)).map((label) => ({ label, catalystRef: null })),
    knownEvidenceIds,
    visualAllowList: {
      edgeIds: new Set(baseReasoning.causalChain.map((edge) => edge.id)),
      claimIds: new Set(baseReasoning.claims.map((claim) => claim.id)),
      evidenceIds: knownEvidenceIds,
      seriesById: new Map(),
      entityById: new Map(),
      expectedRelationships: new Set(),
      confirmationCount: baseReasoning.confirmation.length,
      invalidationCount: baseReasoning.invalidation.length,
    },
    now: currentIntelligenceInvocation()?.frozenInputs?.analysisAsOf || new Date().toISOString(),
  });
  return buildCanonicalStoryReasoningSnapshotV1({
    ...reasoningInput,
    nextTest: plan.nextTest,
    visualPlan: plan.visualPlan,
  });
}

type CanonicalStoryPersistenceResult = {
  story: StoryRow & { current_thesis_version_id: string | null };
  version_id: string;
  event_id: string;
  version_number: number;
  created: boolean;
  applied: boolean;
};

async function persistCanonicalStoryReasoning({
  mutationKey,
  storyId,
  storyPayload,
  reasoning,
  event,
}: {
  mutationKey: string;
  storyId: string | null;
  storyPayload: Record<string, unknown>;
  reasoning: ReturnType<typeof buildStoryReasoningSnapshot>;
  event: { headline: string; detail: string; eventAt: string; metadata: Record<string, unknown> };
}) {
  const rows = await intelligenceRest<CanonicalStoryPersistenceResult[]>("rpc/persist_canonical_story_reasoning", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_mutation_key: mutationKey,
      p_story_id: storyId,
      p_story: storyPayload,
      p_reasoning: reasoning,
      p_event: {
        headline: event.headline,
        detail: event.detail,
        event_at: event.eventAt,
        metadata: event.metadata,
      },
    }),
  });
  const result = rows[0];
  if (!result?.story?.id || !result.version_id || !result.event_id || result.version_number < 1) {
    throw new Error(`Canonical Story mutation ${mutationKey} did not return an exact Story/event/version pointer.`);
  }
  if (result.story.current_thesis_version_id !== result.version_id) {
    throw new Error(`Canonical Story mutation ${mutationKey} returned a stale Story thesis version pointer.`);
  }
  return result;
}

async function promoteCandidate({
  candidate,
  candidateRowId,
  decision,
  lifecycleStatus,
  researchState,
  existingStories,
  evidenceById,
  hypothesis,
  challenger,
  scenarios,
}: {
  candidate: CandidateWorking;
  candidateRowId: string;
  decision: DeduplicationOutput["decisions"][number];
  lifecycleStatus: CandidateWorking["lifecycleStatus"];
  researchState: ResearchStateResult;
  existingStories: StoryRow[];
  evidenceById: Map<string, EvidencePackItem>;
  hypothesis: HypothesisRow;
  challenger: ChallengerRow;
  scenarios: ScenarioRow[];
}) {
  const reasoningContext = { hypothesis, challenger, scenarios, evidenceById };
  const reasoning = buildStoryReasoningSnapshot(candidate, reasoningContext, lifecycleStatus);
  const matched = decision.matchedStoryId ? existingStories.find((story) => story.id === decision.matchedStoryId) : null;
  const mutationAt = new Date().toISOString();
  const storyPayload = {
    title: candidate.title.slice(0, 180),
    thesis: candidate.thesis,
    status: statusFromLifecycle(lifecycleStatus),
    confidence: clamp(candidate.confidence),
    market_question: candidate.question,
    dominant_narrative: candidate.marketBelief,
    best_explanation: hypothesis.causal_mechanism,
    strongest_support: candidate.strongestSupport,
    strongest_contradiction: candidate.strongestContradiction,
    priced_assessment: candidate.divergenceSummary,
    confirmation_trigger: hypothesis.confirmation_criteria.join("; "),
    invalidation_trigger: hypothesis.invalidation_criteria.join("; "),
    next_catalyst: reasoning.nextTest?.label ?? null,
    article_angle: candidate.researchSynthesis,
    provisional_title: candidate.title,
    article_verdict: "research_engine",
    assets: unique(candidate.affectedAssets),
    updated_at: mutationAt,
  };

  let story: StoryRow;
  let isNew = false;
  if (decision.noveltyClass === "existing_story_update" && matched) {
    const persisted = await persistCanonicalStoryReasoning({
      mutationKey: candidateRowId,
      storyId: matched.id,
      storyPayload,
      reasoning,
      event: {
        headline: candidate.title.slice(0, 180),
        detail: candidate.researchSynthesis,
        eventAt: mutationAt,
        metadata: { novelty_class: "existing_story_update" },
      },
    });
    story = persisted.story;
    isNew = persisted.created;
  } else {
    const usedSlugs = new Set(existingStories.map((item) => item.slug));
    let slug = slugPart(candidate.title);
    if (usedSlugs.has(slug)) slug = `${slug.slice(0, 62)}-${hash(candidate.noveltyFingerprint, 7)}`;
    const persisted = await persistCanonicalStoryReasoning({
      mutationKey: candidateRowId,
      storyId: null,
      storyPayload: {
        slug,
        ...storyPayload,
        created_by: "alchemy_research_engine",
        source_quality: 75,
        novelty: clamp(candidate.qualificationScore),
        persistence: clamp(candidate.confidence),
        trader_relevance: clamp(candidate.qualificationScore),
        article_potential: clamp(candidate.qualificationScore),
      },
      reasoning,
      event: {
        headline: "Original Alchemy research-engine thesis recorded",
        detail: candidate.researchSynthesis,
        eventAt: mutationAt,
        metadata: { novelty_class: decision.noveltyClass },
      },
    });
    story = persisted.story;
    isNew = persisted.created;
  }

  const decisive = requireKnownEvidenceIds(
    candidate.decisiveEvidenceIds,
    new Set(evidenceById.keys()),
    `Story candidate ${candidate.candidateKey} decisive evidence`,
  );
  const ancestry = unique(decisive.map((id) => evidenceById.get(id)?.ancestryGroupId).filter((id): id is string => Boolean(id)));
  const stateRows = await intelligenceRest<Array<{ id: string }>>("intelligence_story_states?on_conflict=story_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      story_id: story.id,
      primary_hypothesis_id: candidate.primaryHypothesisId,
      lifecycle_status: lifecycleStatus,
      publication_eligible: true,
      qualification_score: clamp(candidate.qualificationScore),
      event_signature: candidate.eventSignature,
      thesis_signature: hash(candidate.thesis, 64),
      causal_mechanism: hypothesis.causal_mechanism,
      affected_assets: unique(candidate.affectedAssets),
      decisive_evidence_ids: decisive,
      source_ancestry_group_ids: ancestry,
      confirmation_criteria: hypothesis.confirmation_criteria,
      invalidation_criteria: hypothesis.invalidation_criteria,
      next_catalysts: hypothesis.next_catalysts,
      novelty_fingerprint: candidate.noveltyFingerprint,
      novelty_class: decision.noveltyClass,
      duplicate_of_story_id: null,
      canonical_external_url: null,
      research_synthesis: candidate.researchSynthesis,
      last_evidence_at: new Date().toISOString(),
      last_evaluated_at: new Date().toISOString(),
      story_candidate_id: candidateRowId,
      bias: candidate.bias,
      conviction: candidate.bias === "unscored" ? null : candidate.conviction,
      base_case: candidate.baseCase,
      bull_case: candidate.bullCase,
      bear_case: candidate.bearCase,
      tail_case: candidate.tailCase,
      market_belief: candidate.marketBelief,
      divergence_summary: candidate.divergenceSummary,
      strongest_support: candidate.strongestSupport,
      strongest_contradiction: candidate.strongestContradiction,
      updated_at: new Date().toISOString(),
    }),
  });
  const stateId = stateRows[0]?.id;
  if (stateId) {
    await intelligenceRest("intelligence_story_history", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        story_state_id: stateId,
        story_id: story.id,
        lifecycle_status: lifecycleStatus,
        publication_eligible: true,
        novelty_class: decision.noveltyClass,
        qualification_score: clamp(candidate.qualificationScore),
        change_reason: isNew ? "original_story_created" : "existing_story_recalibrated",
        state_snapshot: {
          candidateKey: candidate.candidateKey,
          bias: candidate.bias,
          conviction: candidate.conviction,
          researchState: researchState.researchState,
          researchCompleteness: researchState.researchCompleteness,
          missingRequirementIds: researchState.missingRequirementIds,
          missingEvidence: researchState.missingEvidence,
          missingCriticalRequirementIds: researchState.missingCriticalRequirementIds,
          missingImportantRequirementIds: researchState.missingImportantRequirementIds,
          missingSupportingRequirementIds: researchState.missingSupportingRequirementIds,
          unknownRequirementIds: researchState.unknownRequirementIds,
          outOfScopeRequirementIds: researchState.outOfScopeRequirementIds,
          decisiveEvidenceCount: researchState.decisiveEvidenceCount,
          independentSourceGroupCount: researchState.independentSourceGroupCount,
          hasTierOneOrTwoSource: researchState.hasTierOneOrTwoSource,
          challengerVerdict: researchState.challengerVerdict,
        },
      }),
    });
  }

  if (decisive.length) {
    await intelligenceRest("intelligence_story_evidence?on_conflict=story_id,evidence_id,evidence_role", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(decisive.map((evidenceId) => ({
        story_id: story.id,
        evidence_id: evidenceId,
        evidence_role: "decisive",
        weight: 80,
        rationale: "Decisive evidence selected by the Alchemy intelligence runtime after Challenger review.",
      }))),
    });
  }

  await intelligenceRest(`intelligence_story_candidates?id=eq.${encodeURIComponent(candidateRowId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ promoted_story_id: story.id, candidate_status: "promoted", updated_at: new Date().toISOString() }),
  });

  return story;
}

function lifecycleThemeState(status: EditionStory["lifecycleStatus"]): ThemeWatch["state"] {
  if (status === "confirmed") return "strong";
  if (status === "developing") return "improving";
  if (status === "weakening") return "weakening";
  if (status === "invalidated" || status === "archived") return "breakdown";
  return "mixed";
}

function editionStory(
  candidate: CandidateWorking,
  story: StoryRow,
  parentStoryId: string,
  lifecycleStatus: CandidateWorking["lifecycleStatus"],
): EditionStory {
  const locked = applyExplanationPass({
    thesis: candidate.thesis,
    confidence: clamp(candidate.confidence),
    confirmation: candidate.confirmationCriteria.join("; "),
    invalidation: candidate.invalidationCriteria.join("; "),
    prohibitedClaims: candidate.prohibitedClaims,
  }, {
    plainEnglish: candidate.plainEnglish,
  });
  return {
    id: story.id,
    parentStoryId,
    lifecycleStatus,
    title: candidate.title,
    centralQuestion: candidate.question,
    thesis: locked.thesis,
    whatChanged: candidate.whatChanged,
    previousState: candidate.previousState,
    currentState: candidate.currentState,
    marketReaction: candidate.marketReaction,
    acceptedExplanation: candidate.acceptedExplanation,
    contradiction: candidate.strongestContradiction,
    overlookedVariable: candidate.overlookedVariable,
    overlookedVariableEvidenceStatus: candidate.overlookedVariableEvidenceStatus,
    marketMayBeRight: candidate.marketMayBeRight,
    mechanismSteps: candidate.mechanismSteps,
    plainEnglish: locked.plainEnglish,
    affectedAssets: candidate.affectedAssets,
    themes: candidate.themes,
    nextTest: story.next_catalyst || "",
    confirmation: locked.confirmation,
    invalidation: locked.invalidation,
    confidence: locked.confidence,
    prohibitedClaims: locked.prohibitedClaims,
    changeKinds: candidate.changeKinds,
    eventAt: new Date().toISOString(),
  };
}

function editionThemes(stories: EditionStory[]): ThemeWatch[] {
  const byTheme = new Map<string, ThemeWatch>();
  for (const story of stories) {
    for (const theme of story.themes) {
      if (!theme.trim() || byTheme.has(theme)) continue;
      byTheme.set(theme, {
        theme,
        state: lifecycleThemeState(story.lifecycleStatus),
        driver: story.whatChanged,
        representativeNames: story.affectedAssets.slice(0, 4),
        whatChangesView: story.invalidation,
      });
    }
  }
  return [...byTheme.values()].slice(0, 5);
}

function editionWatchlist(stories: EditionStory[]): WatchlistItem[] {
  return stories.flatMap((story) => story.affectedAssets.map((symbol): WatchlistItem => ({
    symbol,
    bucket: story.lifecycleStatus === "weakening" ? "countertrend_risk" : story.lifecycleStatus === "confirmed" ? "momentum" : "setup",
    theme: story.themes[0] || "Cross-asset",
    whyNow: story.whatChanged,
    structure: story.marketReaction,
    confirmation: story.confirmation,
    invalidation: story.invalidation,
    catalyst: story.nextTest,
    confidence: story.confidence >= 75 ? "high" : story.confidence >= 55 ? "medium" : "low",
  }))).slice(0, 6);
}

function asPreviousEdition(payload: Record<string, unknown> | undefined): AlchemyEdition | null {
  return payload?.methodologyVersion === "alchemy-mixed-research-voice-v1" ? payload as unknown as AlchemyEdition : null;
}

/**
 * Capture the exact Story-state projection emitted by the Live feed at
 * publication time. Historical replay consumes this persisted projection as-is
 * and must never enrich it from current tables later.
 */
async function captureCanonicalStoryStates() {
  const [desk, records] = await Promise.all([
    getHybridDeskData({ fresh: true }),
    getHybridPublicationRecords({ fresh: true }),
  ]);
  const storyImages = await getStoryHeaderImages(desk.stories.map((story) => story.id), desk.sources);
  return selectHybridPublicationStoryStates({
    stories: desk.stories,
    records,
    storyImages,
  }).storyStates;
}

async function persistCanonicalStoryManifest({
  researchRunId,
  canonicalStoryStates,
  publishedAt,
}: {
  researchRunId: string | null;
  canonicalStoryStates: Awaited<ReturnType<typeof captureCanonicalStoryStates>>;
  publishedAt: string;
}) {
  const storySnapshotRows = await intelligenceRest<Array<{ id: string; story_id: string | null; payload: Record<string, unknown> }>>(
    "hybrid_publication_snapshots",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(canonicalStoryStates.map((story) => ({
        research_run_id: researchRunId,
        slot_run_id: null,
        story_id: story.id,
        story_thesis_version_id: null,
        supersedes_snapshot_id: null,
        snapshot_type: "story",
        public_summary: story.title,
        payload: { canonicalStoryState: story },
        source_record_refs: [],
        redaction_log: [],
        confidence: story.confidence,
        published_at: publishedAt,
      }))),
    },
  );
  const snapshotByStoryId = new Map(storySnapshotRows
    .filter((row) => row.story_id)
    .map((row) => [row.story_id as string, row]));
  return canonicalStoryStates.map((story, index) => {
    const snapshot = snapshotByStoryId.get(story.id);
    const state = snapshot?.payload.canonicalStoryState;
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error(`Immutable Story snapshot was not persisted for edition Story ${story.id}.`);
    }
    return { position: index + 1, snapshotId: snapshot.id, storyId: story.id, state };
  });
}

/**
 * The research publisher calls this before a run becomes completed. That order
 * prevents the database's operational completion trigger from creating a
 * reduced legacy brief before Live stores the complete feed projection.
 */
export async function persistCanonicalEditionForResearchRun({
  researchRunId,
  runKey,
  publicSummary = null,
}: {
  researchRunId: string;
  runKey: string;
  publicSummary?: string | null;
}) {
  const existing = await intelligenceRest<Array<{ id: string }>>(
    `hybrid_publication_snapshots?select=id&snapshot_type=eq.daily_brief&research_run_id=eq.${encodeURIComponent(researchRunId)}&limit=1`,
  );
  if (existing[0]) return existing[0].id;

  const generatedAt = new Date().toISOString();
  const researchRun = (await intelligenceRest<Array<{ run_key: string; schedule_slot: string; scheduled_for: string }>>(
    `research_runs?select=run_key,schedule_slot,scheduled_for&id=eq.${encodeURIComponent(researchRunId)}&limit=1`,
  ))[0] || null;
  const canonicalStoryManifest = await persistCanonicalStoryManifest({
    researchRunId,
    canonicalStoryStates: await captureCanonicalStoryStates(),
    publishedAt: generatedAt,
  });
  const rows = await intelligenceRest<Array<{ id: string }>>("hybrid_publication_snapshots", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      research_run_id: researchRunId,
      slot_run_id: null,
      story_id: null,
      story_thesis_version_id: null,
      supersedes_snapshot_id: null,
      snapshot_type: "daily_brief",
      public_summary: publicSummary || `${researchRun?.schedule_slot || "manual"} research edition completed`,
      payload: {
        contractVersion: 2,
        scheduleSlot: researchRun?.schedule_slot || null,
        scheduledFor: researchRun?.scheduled_for || null,
        runKey: researchRun?.run_key || runKey,
        canonicalStoryManifest,
      },
      source_record_refs: canonicalStoryManifest.map((entry) => ({ type: "story", id: entry.storyId, snapshotId: entry.snapshotId })),
      redaction_log: [],
      confidence: canonicalStoryManifest.length
        ? Math.round(canonicalStoryManifest.reduce((sum, entry) => sum + Number((entry.state as { confidence?: number }).confidence || 0), 0) / canonicalStoryManifest.length)
        : 50,
      published_at: generatedAt,
    }),
  });
  if (!rows[0]?.id) throw new Error("Unable to persist canonical edition snapshot.");
  return rows[0].id;
}

async function persistDailyBrief({
  engineRunId,
  researchRunId,
  runKey,
  stories,
  evidence,
}: {
  engineRunId: string;
  researchRunId: string | null;
  runKey: string | undefined;
  stories: EditionStory[];
  evidence: EvidencePackItem[];
}) {
  if (!stories.length) return null;
  const prior = await intelligenceRest<Array<{ id: string; payload: Record<string, unknown>; published_at: string }>>(
    "hybrid_publication_snapshots?select=id,payload,published_at&snapshot_type=eq.daily_brief&order=published_at.desc&limit=1",
  );
  const generatedAt = new Date().toISOString();
  const researchRun = researchRunId
    ? (await intelligenceRest<Array<{ run_key: string; schedule_slot: string; scheduled_for: string }>>(
        `research_runs?select=run_key,schedule_slot,scheduled_for&id=eq.${encodeURIComponent(researchRunId)}&limit=1`,
      ))[0] || null
    : null;
  const canonicalStoryManifest = await persistCanonicalStoryManifest({
    researchRunId,
    canonicalStoryStates: await captureCanonicalStoryStates(),
    publishedAt: generatedAt,
  });
  const previousEdition = asPreviousEdition(prior[0]?.payload);
  const marketObservations = evidence
    .filter((item) => item.evidenceClass === "market_observation" && item.affectedAssets.length)
    .slice(0, 8);
  const edition = composeAlchemyEdition({
    generatedAt,
    comparisonWindowStart: previousEdition?.generatedAt || prior[0]?.published_at || new Date(Date.now() - 86_400_000).toISOString(),
    previousEdition,
    stories,
    marketTape: {
      regimeSummary: marketObservations.length
        ? "Canonical market observations are active; read them with the Story-level countercases."
        : "Canonical market-tape evidence is not available for this edition.",
      assets: marketObservations.map((item) => ({
        symbol: item.affectedAssets[0],
        move: "Observed",
        state: item.claim,
        whyRelevant: item.summary || "Direct market evidence linked to the current edition.",
      })),
    },
    themeWatch: editionThemes(stories),
    watchlist: editionWatchlist(stories),
  });
  await intelligenceRest("hybrid_publication_snapshots", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      research_run_id: researchRunId,
      slot_run_id: null,
      story_id: null,
      story_thesis_version_id: null,
      supersedes_snapshot_id: prior[0]?.id || null,
      snapshot_type: "daily_brief",
      public_summary: edition.finalBoard.highestConvictionChange,
      payload: {
        ...edition,
        engineRunId,
        scheduleSlot: researchRun?.schedule_slot || null,
        scheduledFor: researchRun?.scheduled_for || null,
        runKey: researchRun?.run_key || runKey || null,
        canonicalStoryManifest,
      },
      source_record_refs: [
        ...stories.map((story) => ({ type: "story", id: story.id })),
        ...evidence.flatMap((item) => item.id ? [{ type: "evidence", id: item.id }] : []),
      ],
      redaction_log: [],
      confidence: Math.round(stories.reduce((sum, story) => sum + story.confidence, 0) / stories.length),
      published_at: generatedAt,
    }),
  });
  return edition;
}

export async function runIntelligenceEngine({
  researchRunId = null,
  triggerKind = "new_evidence",
  runKey,
  dryRun = false,
  stageRequestTimeoutMs,
  stageMaxAttempts,
  scheduledExecutionStartedAtMs,
}: {
  researchRunId?: string | null;
  triggerKind?: IntelligenceTriggerKind;
  runKey?: string;
  dryRun?: boolean;
  /** Optional bounded-stage controls for a serverless scheduled run. */
  stageRequestTimeoutMs?: number;
  stageMaxAttempts?: number;
  /** Cron receipt time; keeps scheduled stage requests inside the route deadline. */
  scheduledExecutionStartedAtMs?: number;
} = {}): Promise<IntelligenceRunResult> {
  const warnings: string[] = [];
  if (!intelligenceDatabaseConfigured()) {
    return { enabled: false, engineRunId: null, status: "blocked", evidenceConsidered: 0, hypothesesGenerated: 0, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings: ["Intelligence database credentials are not configured."] };
  }
  if (!openAIIntelligenceEnabled()) {
    return { enabled: false, engineRunId: null, status: "skipped", evidenceConsidered: 0, hypothesesGenerated: 0, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings: ["OpenAI intelligence is disabled or OPENAI_API_KEY is not configured."] };
  }

  const startRunResult = await startIntelligenceEngineRun({
    researchRunId,
    triggerKind,
    runKey,
    dryRun,
  });
  if (startRunResult.kind === "reused_completed") {
    const priorCompleted = startRunResult.run;
    return {
      enabled: true,
      engineRunId: priorCompleted.id,
      status: "completed",
      evidenceConsidered: Number(priorCompleted.metadata?.evidenceConsidered || 0),
      hypothesesGenerated: Number(priorCompleted.metadata?.hypothesesGenerated || 0),
      hypothesesPromoted: Number(priorCompleted.metadata?.hypothesesPromoted || 0),
      storiesConsidered: Number(priorCompleted.stories_considered || 0),
      storiesPublished: Number(priorCompleted.stories_published || 0),
      storyIds: [],
      warnings: [...(priorCompleted.warnings || []), "Idempotent replay: the completed canonical intelligence run was reused."],
    };
  }
  const engineRunId = startRunResult.engineRunId;

  let hypothesesGenerated = 0;
  let hypothesesPromoted = 0;
  let storiesConsidered = 0;
  let evidenceConsidered = 0;
  const publishedStories: StoryRow[] = [];
  const editionStories: EditionStory[] = [];
  const stageExecution = {
    requestTimeoutMs: stageRequestTimeoutMs,
    maxAttempts: stageMaxAttempts,
    scheduledBudgetController: Number.isFinite(scheduledExecutionStartedAtMs)
      ? createScheduledStageBudgetController({ executionStartedAtMs: scheduledExecutionStartedAtMs! })
      : undefined,
  };

  try {
    const stories = await loadStories();
    const researchRequirements = await loadStoryRequirements(stories);
    const researchDebt = await loadResearchDebt();
    if (researchDebt.length) warnings.push(`${researchDebt.length} open research-debt obligation(s) were supplied to the reasoning stages for prioritisation.`);
    await canonicaliseIntake(stories);
    const evidence = await loadEvidence();
    evidenceConsidered = evidence.length;
    if (!evidence.length) {
      warnings.push("No canonical evidence is available for intelligence reasoning.");
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "blocked", completed_at: new Date().toISOString(), warnings }),
      });
      return { enabled: true, engineRunId, status: "blocked", evidenceConsidered: 0, hypothesesGenerated: 0, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings };
    }

    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const knownEvidenceIds = new Set(evidenceById.keys());
    const storiesPack = existingStoryPack(stories);
    const storyReviewTargets = await loadOrCreateStoryReviewTargets(engineRunId, stories, evidence, researchDebt);
    storiesConsidered = storyReviewTargets.length;
    const completedCheckpoints = await loadCompletedStageCheckpoints(engineRunId);
    const resumableStageExecution = { ...stageExecution, completedCheckpoints };

    const beliefStage = await modelStage<MarketBeliefOutput>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "market_belief",
      modelKind: "fast",
      schema: MARKET_BELIEF_SCHEMA,
      input: { asOf: currentIntelligenceInvocation()?.frozenInputs?.analysisAsOf || new Date().toISOString(), evidence, storyReviewTargets },
      maxOutputTokens: 2_800,
    });
    await persistStoryAssessments({ engineRunId, stageRunId: beliefStage.stageRunId, output: beliefStage.data, targets: storyReviewTargets });
    const beliefs = await persistBeliefs(beliefStage.data, evidenceById);
    if (!beliefs.length) {
      warnings.push("No defensible market beliefs were extracted; no Story reasoning was attempted.");
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), warnings }),
      });
      return { enabled: true, engineRunId, status: "completed", evidenceConsidered: evidence.length, hypothesesGenerated: 0, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings };
    }

    const divergenceStage = await modelStage<DivergenceOutput>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "divergence",
      modelKind: "fast",
      schema: DIVERGENCE_SCHEMA,
      input: { beliefs, evidence },
      maxOutputTokens: 2_800,
    });
    const divergences = await persistDivergences(divergenceStage.data, beliefs, knownEvidenceIds);
    if (!divergences.length) {
      warnings.push("No material evidence-versus-belief divergence survived the divergence stage.");
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), warnings }),
      });
      return { enabled: true, engineRunId, status: "completed", evidenceConsidered: evidence.length, hypothesesGenerated: 0, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings };
    }

    const hypothesisEvidence = buildHypothesisEvidencePack(beliefs, divergences, evidence);
    const hypothesisStories = buildHypothesisStoryPack(beliefs, hypothesisEvidence, storiesPack);
    const allowedHypothesisEvidenceIds = new Set(hypothesisEvidence.map((e) => e.id));

    if (hypothesisEvidence.length === 0) {
      warnings.push("No canonical evidence referenced by Market Beliefs or Divergences was available for Hypothesis generation; reasoning cycle paused without creating hypotheses.");
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), warnings }),
      });
      return { enabled: true, engineRunId, status: "completed", evidenceConsidered: evidence.length, hypothesesGenerated: 0, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings };
    }

    const hypothesisStage = await modelStage<HypothesisOutput>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "hypothesis",
      modelKind: "complex",
      schema: HYPOTHESIS_SCHEMA,
      input: {
        beliefs,
        divergences,
        evidence: hypothesisEvidence,
        existingStories: hypothesisStories,
        researchDebt,
      },
      maxOutputTokens: 5_500,
    });
    const hypotheses = await persistHypotheses(hypothesisStage.data, divergences, beliefs, knownEvidenceIds, allowedHypothesisEvidenceIds);
    hypothesesGenerated = hypotheses.length;
    if (!hypotheses.length) {
      warnings.push("No testable hypotheses survived evidence-ID validation.");
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), warnings }),
      });
      return { enabled: true, engineRunId, status: "completed", evidenceConsidered: evidence.length, hypothesesGenerated: 0, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings };
    }

    const requirementScopes = scopeRequirementsByHypothesis(hypotheses, evidenceById, stories, researchRequirements);
    const knownRequirementIds = new Set<string>(STABLE_REQUIREMENT_IDS);
    const allowedRequirementIdsByHypothesis = new Map(requirementScopes.map((scope) => [
      scope.hypothesisId,
      new Set(scope.requirements.map((requirement) => requirement.requirementId)),
    ]));
    const challengerStage = await modelStage<ChallengerOutput>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "challenger",
      modelKind: "complex",
      schema: CHALLENGER_SCHEMA,
      input: { hypotheses, evidence, existingStories: storiesPack, researchDebt, requirementScopes },
      maxOutputTokens: 5_000,
    });
    const challenger = await persistChallenger(challengerStage.data, hypotheses, challengerStage.stageRunId, knownEvidenceIds, knownRequirementIds, allowedRequirementIdsByHypothesis);
    const challengerByHypothesis = new Map(challenger.map((row) => [row.hypothesisId, row]));
    // Challenger is a critic, not a publication bouncer. Every structurally valid
    // assessed hypothesis continues to scenario and Story synthesis regardless of verdict.
    const reviewed = hypotheses.filter((hypothesis) => challengerByHypothesis.has(hypothesis.id));
    hypothesesPromoted = reviewed.length; // Backward-compatible run counter; now means reviewed.
    if (!reviewed.length) {
      warnings.push("Challenger returned no valid hypothesis assessments; no Story was synthesized.");
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), warnings }),
      });
      return { enabled: true, engineRunId, status: "completed", evidenceConsidered: evidence.length, hypothesesGenerated, hypothesesPromoted: 0, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings };
    }

    const reviewedIds = new Set(reviewed.map((item) => item.id));
    const scenarioStage = await modelStage<ScenarioOutput>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "scenario",
      modelKind: "complex",
      schema: SCENARIO_SCHEMA,
      input: { hypotheses: reviewed, challenger: challenger.filter((row) => reviewedIds.has(row.hypothesisId)), evidence },
      maxOutputTokens: 5_500,
    });
    const scenarioRows = await persistScenarios(engineRunId, scenarioStage.data, reviewedIds, knownEvidenceIds);
    const storyPlanCandidates = storyPlanCandidatesForHypotheses(reviewed);

    const synthesisStage = await modelStage<StorySynthesisWithPlanOutputV1>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "story_synthesis",
      modelKind: "complex",
      schema: STORY_SYNTHESIS_WITH_PLAN_SCHEMA,
      input: {
        hypotheses: reviewed,
        challenger: challenger.filter((row) => reviewedIds.has(row.hypothesisId)),
        scenarios: scenarioRows,
        evidence,
        existingStories: storiesPack,
        storyPlanCandidates,
        researchStatePolicy: { states: ["SUPPORTED", "DEVELOPING", "CONTESTED", "EARLY"], allStatesMayPublish: true, completenessIsDescriptive: true },
      },
      maxOutputTokens: 9_000,
    });

    const reviewedById = new Map(reviewed.map((hypothesis) => [hypothesis.id, hypothesis]));
    const candidates: CandidateWorking[] = synthesisStage.data.candidates.flatMap((candidate) => {
      if (!reviewedIds.has(candidate.primaryHypothesisId)) return [];
      const decisiveEvidenceIds = requireKnownEvidenceIds(
        candidate.decisiveEvidenceIds,
        knownEvidenceIds,
        `Story Synthesis candidate ${candidate.primaryHypothesisId} decisive evidence`,
      );
      const acceptedExplanationEvidenceIds = requireKnownEvidenceIds(
        candidate.acceptedExplanationEvidenceIds,
        knownEvidenceIds,
        `Story Synthesis candidate ${candidate.primaryHypothesisId} accepted explanation`,
      );
      const overlookedVariableEvidenceIds = requireKnownEvidenceIds(
        candidate.overlookedVariableEvidenceIds,
        knownEvidenceIds,
        `Story Synthesis candidate ${candidate.primaryHypothesisId} overlooked variable`,
      );
      const affectedAssets = onlyExplicitAssets(candidate.affectedAssets, reviewedById.get(candidate.primaryHypothesisId)?.affected_assets ?? []);
      const normalized: CandidateWorking = {
        ...candidate,
        decisiveEvidenceIds,
        acceptedExplanationEvidenceIds,
        overlookedVariableEvidenceIds,
        affectedAssets,
        candidateKey: stableKey("candidate", candidate.primaryHypothesisId, candidate.eventSignature, candidate.thesis),
        noveltyFingerprint: hash(JSON.stringify({
          event: candidate.eventSignature.toLowerCase(),
          thesis: candidate.thesis.toLowerCase(),
          mechanism: candidate.causalMechanism.toLowerCase(),
          assets: [...affectedAssets].sort(),
          decisiveEvidenceIds: [...decisiveEvidenceIds].sort(),
          confirmation: [...candidate.confirmationCriteria].sort(),
          invalidation: [...candidate.invalidationCriteria].sort(),
        }), 64),
      };
      if (normalized.bias === "unscored") normalized.conviction = null;
      return [normalized];
    });
    storiesConsidered += candidates.length;
    if (!candidates.length) {
      warnings.push("Story synthesis produced no candidate tied to a reviewed hypothesis.");
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), warnings }),
      });
      return { enabled: true, engineRunId, status: "completed", evidenceConsidered: evidence.length, hypothesesGenerated, hypothesesPromoted, storiesConsidered: 0, storiesPublished: 0, storyIds: [], warnings };
    }

    const dedupeStage = await modelStage<DeduplicationOutput>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "semantic_deduplication",
      modelKind: "fast",
      schema: DEDUPLICATION_SCHEMA,
      input: { candidates: candidates.map((item) => ({ ...item, candidateKey: item.candidateKey })), existingStories: storiesPack },
      maxOutputTokens: 3_500,
    });
    const validStoryIds = new Set(stories.map((story) => story.id));
    const dedupeByCandidate = new Map(dedupeStage.data.decisions.map((decision) => {
      let normalized = decision;
      if ((decision.noveltyClass === "duplicate" || decision.noveltyClass === "existing_story_update") && (!decision.matchedStoryId || !validStoryIds.has(decision.matchedStoryId))) {
        normalized = { ...decision, noveltyClass: "insufficient_novelty" as const, matchedStoryId: null, rationale: `${decision.rationale} Matching Story ID was invalid, so publication is blocked.` };
      }
      return [decision.candidateKey, normalized];
    }));

    const lifecycleStage = await modelStage<LifecycleOutput>({
      engineRunId,
      ...resumableStageExecution,
      stageKey: "lifecycle",
      modelKind: "fast",
      schema: LIFECYCLE_SCHEMA,
      input: {
        candidates: candidates.map((candidate) => ({ candidateKey: candidate.candidateKey, lifecycleStatus: candidate.lifecycleStatus, thesis: candidate.thesis, confidence: candidate.confidence })),
        deduplication: [...dedupeByCandidate.values()],
        existingStories: storiesPack,
        evidence,
      },
      maxOutputTokens: 2_800,
    });
    const lifecycleByCandidate = new Map(lifecycleStage.data.decisions.map((item) => [item.candidateKey, item]));

    const candidateRows: CandidatePersisted[] = [];
    for (const candidate of candidates) {
      const decision = dedupeByCandidate.get(candidate.candidateKey) || {
        candidateKey: candidate.candidateKey,
        noveltyClass: "insufficient_novelty" as const,
        matchedStoryId: null,
        similarityScore: 100,
        rationale: "No semantic-deduplication decision was returned.",
        exceptionProof: { distinctEvent: false, distinctMechanism: false, distinctDecisiveEvidence: false, distinctCatalyst: false },
      };
      const researchContext = candidateResearchState(candidate, evidenceById, challengerByHypothesis);
      const lifecycle = lifecycleByCandidate.get(candidate.candidateKey)?.lifecycleStatus || candidate.lifecycleStatus;
      const ancestry = unique(researchContext.decisive.map((item) => item.ancestryGroupId).filter((id): id is string => Boolean(id)));
      // This persisted compatibility flag represents structural publishability only.
      // Research completeness, criticality, confidence, source depth and Challenger verdict never set it.
      const integrity = evaluateCandidateIntegrity({
        decisiveEvidenceCount: researchContext.decisive.length,
        noveltyClass: decision.noveltyClass,
      });
      const structurallyPublishable = integrity.publishable;
      if (!integrity.publishable) warnings.push(`${candidate.title}: not published for structural reason: ${integrity.structuralReasons.join(", ")}.`);
      for (const warning of researchContext.research.warnings) warnings.push(`${candidate.title}: ${warning}.`);

      const rows = await intelligenceRest<Array<{ id: string }>>("intelligence_story_candidates?on_conflict=engine_run_id,novelty_fingerprint", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          engine_run_id: engineRunId,
          primary_hypothesis_id: candidate.primaryHypothesisId,
          title: candidate.title,
          thesis: candidate.thesis,
          event_signature: candidate.eventSignature,
          causal_mechanism: candidate.causalMechanism,
          affected_assets: candidate.affectedAssets,
          decisive_evidence_ids: candidate.decisiveEvidenceIds,
          source_ancestry_group_ids: ancestry,
          confirmation_criteria: candidate.confirmationCriteria,
          invalidation_criteria: candidate.invalidationCriteria,
          next_catalysts: candidate.nextCatalysts,
          confidence: clamp(candidate.confidence),
          qualification_score: clamp(candidate.qualificationScore),
          publication_eligible: structurallyPublishable,
          lifecycle_status: lifecycle,
          novelty_fingerprint: candidate.noveltyFingerprint,
          novelty_class: decision.noveltyClass,
          duplicate_of_story_id: decision.noveltyClass === "duplicate" ? decision.matchedStoryId : null,
          canonical_external_url: null,
          research_synthesis: candidate.researchSynthesis,
          candidate_status: structurallyPublishable ? "qualified" : "rejected",
          question: candidate.question,
          market_belief: candidate.marketBelief,
          divergence_summary: candidate.divergenceSummary,
          bias: candidate.bias,
          conviction: candidate.bias === "unscored" ? null : candidate.conviction,
          base_case: candidate.baseCase,
          bull_case: candidate.bullCase,
          bear_case: candidate.bearCase,
          tail_case: candidate.tailCase,
          strongest_support: candidate.strongestSupport,
          strongest_contradiction: candidate.strongestContradiction,
          novelty_rationale: `${decision.rationale} Similarity ${Math.round(decision.similarityScore)}%.`,
          updated_at: new Date().toISOString(),
        }),
      });
      if (rows[0]?.id) candidateRows.push({ id: rows[0].id, candidateKey: candidate.candidateKey, primaryHypothesisId: candidate.primaryHypothesisId });

      if (!structurallyPublishable || dryRun || !rows[0]?.id) continue;
      const primaryHypothesis = reviewedById.get(candidate.primaryHypothesisId);
      const primaryChallenger = challengerByHypothesis.get(candidate.primaryHypothesisId);
      if (!primaryHypothesis || !primaryChallenger) {
        throw new Error(`Canonical reasoning inputs are incomplete for Story candidate ${candidate.candidateKey}.`);
      }
      const promotedStory = await promoteCandidate({
        candidate,
        candidateRowId: rows[0].id,
        decision,
        lifecycleStatus: lifecycle,
        researchState: researchContext.research,
        existingStories: stories,
        evidenceById,
        hypothesis: primaryHypothesis,
        challenger: primaryChallenger,
        scenarios: scenarioRows.filter((scenario) => scenario.hypothesis_id === primaryHypothesis.id),
      });
      publishedStories.push(promotedStory);
      editionStories.push(editionStory(candidate, promotedStory, decision.matchedStoryId || promotedStory.id, lifecycle));
      if (!stories.some((story) => story.id === promotedStory.id)) stories.push(promotedStory);
    }

    if (!dryRun && editionStories.length) {
      await persistDailyBrief({ engineRunId, researchRunId, runKey, stories: editionStories, evidence });
    }

    await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "completed",
        stories_considered: storiesConsidered,
        stories_published: publishedStories.length,
        warnings,
        completed_at: new Date().toISOString(),
        metadata: {
          dryRun,
          runtime: "openai-responses-v1",
          evidenceConsidered: evidence.length,
          hypothesesGenerated,
          hypothesesPromoted,
          candidateRows: candidateRows.map((row) => row.id),
        },
        failure_detail: null,
      }),
    });

    return {
      enabled: true,
      engineRunId,
      status: "completed",
      evidenceConsidered: evidence.length,
      hypothesesGenerated,
      hypothesesPromoted,
      storiesConsidered,
      storiesPublished: publishedStories.length,
      storyIds: publishedStories.map((story) => story.id),
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown intelligence runtime failure.";
    warnings.push(message);
    const blocked = error instanceof OpenAIStageError && error.code === "configuration_required";
    const competingClaim = error instanceof IntelligenceStageClaimUnavailableError;
    const resumable = competingClaim
      || error instanceof ScheduledIntelligenceDeadlineError
      || (error instanceof OpenAIStageError && error.retryable);
    if (!competingClaim) {
      try {
        await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            // A failed attempt is deliberately not a terminal engine run. Its
            // stage row remains the audit record while the canonical run can
            // resume from the first incomplete checkpoint on a later request.
            ...(blocked ? { status: "blocked" } : resumable ? { status: "partial" } : { status: "failed" }),
            warnings,
            failure_detail: message.slice(0, 2_000),
            stories_considered: storiesConsidered,
            stories_published: publishedStories.length,
            ...(resumable ? { completed_at: null } : { completed_at: new Date().toISOString() }),
          }),
        });
      } catch {
        // Preserve the original intelligence failure.
      }
    }
    return {
      enabled: true,
      engineRunId,
      status: blocked ? "blocked" : resumable ? "partial" : "failed",
      evidenceConsidered,
      hypothesesGenerated,
      hypothesesPromoted,
      storiesConsidered,
      storiesPublished: publishedStories.length,
      storyIds: publishedStories.map((story) => story.id),
      warnings,
    };
  }
}
