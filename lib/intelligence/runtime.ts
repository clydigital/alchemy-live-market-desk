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
  STORY_SYNTHESIS_SCHEMA,
  type ChallengerOutput,
  type DeduplicationOutput,
  type DivergenceOutput,
  type EvidencePackItem,
  type ExistingStoryPackItem,
  type HypothesisOutput,
  type LifecycleOutput,
  type MarketBeliefOutput,
  type ScenarioOutput,
  type StorySynthesisOutput,
} from "@/lib/intelligence/schemas";
import {
  STABLE_REQUIREMENT_IDS,
  evaluateCandidateIntegrity,
  evaluateRuntimeResearchState,
  researchRequirementRegistry,
  validateScopedRequirementIds,
  type ResearchRequirement,
  type ResearchStateResult,
} from "@/lib/intelligence/research-state";
import { buildAncestryUpsertSpecs } from "@/lib/intelligence/intake-normalization";
import { intelligenceDatabaseConfigured, intelligenceRest } from "@/lib/intelligence/supabase";
import { getHybridDeskData } from "@/lib/data";
import { getHybridPublicationRecords, selectHybridPublicationStoryStates } from "@/lib/hybrid-publication";
import { getStoryHeaderImages } from "@/lib/story-images";

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

type StageRunRow = { id: string };
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

type CandidateWorking = StorySynthesisOutput["candidates"][number] & {
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

const CHALLENGER_REQUIREMENT_RULES = `For each assessment, select missingRequirementIds only from the requirements in that hypothesisId's requirementScopes entry.
These are canonical public.research_story_requirements.requirement_key values. Never translate them into another vocabulary and never use a requirement from another hypothesis scope.
Do not invent or infer requirement IDs from prose. Use missingEvidence only for a human-readable explanation. Missing research informs state and priority; it never decides publication.
Return an empty missingRequirementIds array when the scoped requirements are satisfied or the hypothesis has no scoped requirements.`;

const STORY_SYNTHESIS_METHOD_RULES = `Apply the Alchemy Mixed Research Voice Method inside this existing Story Synthesis stage.
For every candidate, reuse question as the one central question. State what changed versus the previous canonical state, the observed market reaction, the accepted explanation, one measurable overlooked variable, and the strongest case for why the market may still be right.
Explain causal arrows one at a time and label each mechanism step observed, strongly_supported, inferred or speculative. Plain-English wording may improve comprehension but must not change thesis, confidence, evidence status, confirmation or invalidation.
Populate changeKinds only when canonical evidence shows a material change in evidence, catalyst, price confirmation or invalidation, probability, cross-asset transmission, official or management communication, or watchlist state. Leave it empty for an unchanged recurring Story.
Do not manufacture four changes. Do not split several updates to one parent Story into separate changes. Use themes selectively and record any claims the evidence does not permit in prohibitedClaims. All descriptive research states may publish when the update is material and has usable traceable evidence.`;

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

async function loadPrompt(stageKey: string) {
  const rows = await intelligenceRest<PromptVersion[]>(
    `intelligence_prompt_versions?select=id,stage_key,version,prompt_text,model_hint&stage_key=eq.${encodeURIComponent(stageKey)}&is_active=eq.true&order=version.desc&limit=1`,
  );
  return rows[0] ?? null;
}

async function beginStage(engineRunId: string, stageKey: string, promptVersionId: string | null, inputRefs: unknown) {
  const rows = await intelligenceRest<StageRunRow[]>("intelligence_stage_runs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      engine_run_id: engineRunId,
      prompt_version_id: promptVersionId,
      stage_key: stageKey,
      status: "started",
      input_refs: inputRefs,
      started_at: new Date().toISOString(),
    }),
  });
  if (!rows[0]?.id) throw new Error(`Unable to create intelligence stage run for ${stageKey}.`);
  return rows[0].id;
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
}) {
  const prompt = await loadPrompt(stageKey);
  const stageRunId = await beginStage(engineRunId, stageKey, prompt?.id ?? null, {
    evidenceCount: Array.isArray((input as { evidence?: unknown[] })?.evidence) ? (input as { evidence: unknown[] }).evidence.length : undefined,
    storyCount: Array.isArray((input as { existingStories?: unknown[] })?.existingStories) ? (input as { existingStories: unknown[] }).existingStories.length : undefined,
  });
  let effectiveTimeoutMs = requestTimeoutMs;
  try {
    effectiveTimeoutMs = scheduledBudgetController
      ? scheduledBudgetController.timeoutFor(stageKey)
      : requestTimeoutMs;
    const result = await runStructuredStage<T>({
      stageKey,
      instructions: `${CORE_RULES}\n\nStage mandate: ${prompt?.prompt_text || stageKey}.${stageKey === "challenger" ? `\n\n${CHALLENGER_REQUIREMENT_RULES}` : ""}${stageKey === "story_synthesis" ? `\n\n${STORY_SYNTHESIS_METHOD_RULES}` : ""}`,
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
    return { data: result.data, stageRunId };
  } catch (error) {
    const code = error instanceof ScheduledIntelligenceDeadlineError
      ? error.code
      : error instanceof OpenAIStageError ? error.code : "stage_error";
    const originalMessage = error instanceof Error ? error.message : "Unknown intelligence stage failure.";
    const message = code === "timeout" && Number.isFinite(effectiveTimeoutMs)
      ? scheduledStageTimeoutFailure(stageKey, effectiveTimeoutMs!)
      : originalMessage;
    await finishStage(stageRunId, {
      status: error instanceof OpenAIStageError && error.code === "configuration_required" ? "blocked" : "failed",
      failureCode: code,
      failureDetail: message.slice(0, 2_000),
    });
    if (message !== originalMessage && error instanceof OpenAIStageError) {
      throw new OpenAIStageError(message, { code: error.code, status: error.status, retryable: error.retryable });
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
    const affectedAssets = unique((item.affected_story_slugs ?? []).flatMap((slug) => storyAssets.get(slug) ?? []));
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

async function loadResearchDebt() {
  return intelligenceRest<Array<{
    debt_key: string;
    severity: string;
    reason: string;
    next_action: string | null;
    next_check_at: string | null;
  }>>(
    "research_debt?select=debt_key,severity,reason,next_action,next_check_at&status=eq.open&order=next_check_at.asc.nullslast&limit=30",
  ).catch(() => []);
}

async function persistBeliefs(output: MarketBeliefOutput, knownEvidence: Set<string>) {
  const specs = output.beliefs.flatMap((belief) => {
    const evidenceIds = onlyKnownIds(belief.evidenceIds, knownEvidence);
    if (!belief.statement.trim()) return [];
    const beliefKey = stableKey("belief", belief.statement.trim().toLowerCase(), [...belief.affectedAssets].sort());
    return [{
      belief_key: beliefKey,
      statement: belief.statement.trim(),
      priced_state: belief.pricedState?.trim() || null,
      consensus_strength: clamp(belief.consensusStrength),
      affected_assets: unique(belief.affectedAssets),
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

async function persistHypotheses(output: HypothesisOutput, divergences: DivergenceRow[], beliefs: BeliefRow[], knownEvidence: Set<string>) {
  const divergenceIds = new Set(divergences.map((row) => row.id));
  const beliefById = new Map(beliefs.map((row) => [row.id, row]));
  const divergenceById = new Map(divergences.map((row) => [row.id, row]));
  const specs = output.hypotheses.flatMap((hypothesis) => {
    if (!divergenceIds.has(hypothesis.divergenceId) || !hypothesis.statement.trim()) return [];
    const divergence = divergenceById.get(hypothesis.divergenceId)!;
    const belief = beliefById.get(divergence.market_belief_id);
    const evidenceFor = onlyKnownIds(hypothesis.evidenceForIds, knownEvidence);
    const evidenceAgainst = onlyKnownIds(hypothesis.evidenceAgainstIds, knownEvidence);
    const causalChain = hypothesis.causalChain.map((edge) => ({
      ...edge,
      evidenceIds: onlyKnownIds(edge.evidenceIds, knownEvidence),
    }));
    return [{
      divergence_id: hypothesis.divergenceId,
      hypothesis_key: stableKey("hypothesis", hypothesis.statement.toLowerCase(), hypothesis.causalMechanism.toLowerCase(), [...hypothesis.affectedAssets].sort()),
      statement: hypothesis.statement.trim(),
      causal_mechanism: hypothesis.causalMechanism.trim(),
      affected_assets: unique(hypothesis.affectedAssets),
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
      conflictingEvidenceIds: onlyKnownIds(assessment.conflictingEvidenceIds, knownEvidence),
      adjustedConfidence: clamp(assessment.adjustedConfidence),
      confidenceAdjustment: Math.max(-100, Math.min(100, assessment.confidenceAdjustment)),
      stageRunId,
    }];
  });
  if (!rows.length) return [];
  await intelligenceRest("intelligence_challenger_assessments", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
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
  const specs = output.scenarios.flatMap((scenario) => {
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
      explanatory_evidence_ids: onlyKnownIds(scenario.explanatoryEvidenceIds, knownEvidence),
      updated_at: new Date().toISOString(),
    }];
  });
  if (!specs.length) return [];
  await intelligenceRest("intelligence_scenarios?on_conflict=engine_run_id,hypothesis_id,asset", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(specs),
  });
  return specs;
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

async function createInitialVersion(story: StoryRow, synthesis: CandidateWorking) {
  const events = await intelligenceRest<Array<{ id: string }>>("story_events", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      story_id: story.id,
      event_type: "thesis_revision",
      headline: "Original Alchemy research-engine thesis recorded",
      detail: synthesis.researchSynthesis,
      event_at: new Date().toISOString(),
      metadata: { automatic: true, origin: "alchemy_research_engine" },
    }),
  });
  const eventId = events[0]?.id ?? null;
  const versions = await intelligenceRest<Array<{ id: string }>>("story_thesis_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      story_id: story.id,
      event_id: eventId,
      version_number: 1,
      title: story.title,
      thesis: story.thesis,
      status: story.status,
      confidence: story.confidence,
      market_question: synthesis.question,
      dominant_narrative: synthesis.marketBelief,
      best_explanation: synthesis.causalMechanism,
      strongest_support: synthesis.strongestSupport,
      strongest_contradiction: synthesis.strongestContradiction,
      priced_assessment: synthesis.divergenceSummary,
      confirmation_trigger: synthesis.confirmationCriteria.join("; "),
      invalidation_trigger: synthesis.invalidationCriteria.join("; "),
      next_catalyst: synthesis.nextCatalysts.join("; "),
      article_angle: synthesis.researchSynthesis,
      provisional_title: synthesis.title,
      article_verdict: "research_engine",
      assets: synthesis.affectedAssets,
      snapshot: { origin: "alchemy_research_engine" },
      change_reason: "story_created",
      effective_at: new Date().toISOString(),
    }),
  });
  const versionId = versions[0]?.id;
  if (versionId) {
    await intelligenceRest(`stories?id=eq.${encodeURIComponent(story.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ current_thesis_version_id: versionId }),
    });
  }
}

async function createRevisionVersion(story: StoryRow, synthesis: CandidateWorking) {
  const prior = await intelligenceRest<Array<{ version_number: number; confidence: number }>>(
    `story_thesis_versions?select=version_number,confidence&story_id=eq.${encodeURIComponent(story.id)}&order=version_number.desc&limit=1`,
  );
  const versionNumber = (prior[0]?.version_number || 0) + 1;
  const confidenceDelta = clamp(story.confidence) - Number(prior[0]?.confidence ?? story.confidence);
  const events = await intelligenceRest<Array<{ id: string }>>("story_events", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      story_id: story.id,
      event_type: "thesis_revision",
      headline: synthesis.title.slice(0, 180),
      detail: synthesis.researchSynthesis,
      confidence_delta: confidenceDelta,
      event_at: new Date().toISOString(),
      metadata: { automatic: true, origin: "alchemy_research_engine", novelty_class: "existing_story_update" },
    }),
  });
  const versions = await intelligenceRest<Array<{ id: string }>>("story_thesis_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      story_id: story.id,
      event_id: events[0]?.id || null,
      version_number: versionNumber,
      title: story.title,
      thesis: story.thesis,
      status: story.status,
      confidence: story.confidence,
      market_question: synthesis.question,
      dominant_narrative: synthesis.marketBelief,
      best_explanation: synthesis.causalMechanism,
      strongest_support: synthesis.strongestSupport,
      strongest_contradiction: synthesis.strongestContradiction,
      priced_assessment: synthesis.divergenceSummary,
      confirmation_trigger: synthesis.confirmationCriteria.join("; "),
      invalidation_trigger: synthesis.invalidationCriteria.join("; "),
      next_catalyst: synthesis.nextCatalysts.join("; "),
      article_angle: synthesis.researchSynthesis,
      provisional_title: synthesis.title,
      article_verdict: "research_engine",
      assets: synthesis.affectedAssets,
      snapshot: { origin: "alchemy_research_engine", priorVersion: versionNumber - 1 },
      change_reason: "material_evidence_recalibration",
      effective_at: new Date().toISOString(),
    }),
  });
  if (versions[0]?.id) {
    await intelligenceRest(`stories?id=eq.${encodeURIComponent(story.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ current_thesis_version_id: versions[0].id }),
    });
  }
}

async function promoteCandidate({
  candidate,
  candidateRowId,
  decision,
  lifecycleStatus,
  researchState,
  existingStories,
  evidenceById,
}: {
  candidate: CandidateWorking;
  candidateRowId: string;
  decision: DeduplicationOutput["decisions"][number];
  lifecycleStatus: CandidateWorking["lifecycleStatus"];
  researchState: ResearchStateResult;
  existingStories: StoryRow[];
  evidenceById: Map<string, EvidencePackItem>;
}) {
  const matched = decision.matchedStoryId ? existingStories.find((story) => story.id === decision.matchedStoryId) : null;
  const storyPayload = {
    title: candidate.title.slice(0, 180),
    thesis: candidate.thesis,
    status: statusFromLifecycle(lifecycleStatus),
    confidence: clamp(candidate.confidence),
    market_question: candidate.question,
    dominant_narrative: candidate.marketBelief,
    best_explanation: candidate.causalMechanism,
    strongest_support: candidate.strongestSupport,
    strongest_contradiction: candidate.strongestContradiction,
    priced_assessment: candidate.divergenceSummary,
    confirmation_trigger: candidate.confirmationCriteria.join("; "),
    invalidation_trigger: candidate.invalidationCriteria.join("; "),
    next_catalyst: candidate.nextCatalysts.join("; "),
    article_angle: candidate.researchSynthesis,
    provisional_title: candidate.title,
    article_verdict: "research_engine",
    assets: unique(candidate.affectedAssets),
    updated_at: new Date().toISOString(),
  };

  let story: StoryRow;
  let isNew = false;
  if (decision.noveltyClass === "existing_story_update" && matched) {
    const rows = await intelligenceRest<StoryRow[]>(`stories?id=eq.${encodeURIComponent(matched.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(storyPayload),
    });
    story = rows[0];
    if (!story) throw new Error(`Story ${matched.id} could not be updated.`);
    await intelligenceRest("story_updates", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        story_id: story.id,
        update_type: "recalibration",
        headline: candidate.title.slice(0, 90),
        detail: candidate.researchSynthesis,
        observed_at: new Date().toISOString(),
      }),
    });
    await createRevisionVersion(story, candidate);
  } else {
    const usedSlugs = new Set(existingStories.map((item) => item.slug));
    let slug = slugPart(candidate.title);
    if (usedSlugs.has(slug)) slug = `${slug.slice(0, 62)}-${hash(candidate.noveltyFingerprint, 7)}`;
    const rows = await intelligenceRest<StoryRow[]>("stories", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        slug,
        ...storyPayload,
        created_by: "alchemy_research_engine",
        source_quality: 75,
        novelty: clamp(candidate.qualificationScore),
        persistence: clamp(candidate.confidence),
        trader_relevance: clamp(candidate.qualificationScore),
        article_potential: clamp(candidate.qualificationScore),
      }),
    });
    story = rows[0];
    if (!story) throw new Error("New Alchemy Story could not be created.");
    isNew = true;
    await createInitialVersion(story, candidate);
  }

  const decisive = onlyKnownIds(candidate.decisiveEvidenceIds, new Set(evidenceById.keys()));
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
      causal_mechanism: candidate.causalMechanism,
      affected_assets: unique(candidate.affectedAssets),
      decisive_evidence_ids: decisive,
      source_ancestry_group_ids: ancestry,
      confirmation_criteria: candidate.confirmationCriteria,
      invalidation_criteria: candidate.invalidationCriteria,
      next_catalysts: candidate.nextCatalysts,
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
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
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
    nextTest: candidate.nextCatalysts.join("; "),
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

    const beliefStage = await modelStage<MarketBeliefOutput>({
      engineRunId,
      ...stageExecution,
      stageKey: "market_belief",
      modelKind: "fast",
      schema: MARKET_BELIEF_SCHEMA,
      input: { asOf: new Date().toISOString(), evidence, existingStories: storiesPack, researchDebt },
      maxOutputTokens: 2_800,
    });
    const beliefs = await persistBeliefs(beliefStage.data, knownEvidenceIds);
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
      ...stageExecution,
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

    const hypothesisStage = await modelStage<HypothesisOutput>({
      engineRunId,
      ...stageExecution,
      stageKey: "hypothesis",
      modelKind: "complex",
      schema: HYPOTHESIS_SCHEMA,
      input: { beliefs, divergences, evidence, existingStories: storiesPack, researchDebt },
      maxOutputTokens: 5_500,
    });
    const hypotheses = await persistHypotheses(hypothesisStage.data, divergences, beliefs, knownEvidenceIds);
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
      ...stageExecution,
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
      ...stageExecution,
      stageKey: "scenario",
      modelKind: "complex",
      schema: SCENARIO_SCHEMA,
      input: { hypotheses: reviewed, challenger: challenger.filter((row) => reviewedIds.has(row.hypothesisId)), evidence },
      maxOutputTokens: 5_500,
    });
    const scenarioRows = await persistScenarios(engineRunId, scenarioStage.data, reviewedIds, knownEvidenceIds);

    const synthesisStage = await modelStage<StorySynthesisOutput>({
      engineRunId,
      ...stageExecution,
      stageKey: "story_synthesis",
      modelKind: "complex",
      schema: STORY_SYNTHESIS_SCHEMA,
      input: {
        hypotheses: reviewed,
        challenger: challenger.filter((row) => reviewedIds.has(row.hypothesisId)),
        scenarios: scenarioRows,
        evidence,
        existingStories: storiesPack,
        researchStatePolicy: { states: ["SUPPORTED", "DEVELOPING", "CONTESTED", "EARLY"], allStatesMayPublish: true, completenessIsDescriptive: true },
      },
      maxOutputTokens: 9_000,
    });

    const candidates: CandidateWorking[] = synthesisStage.data.candidates.flatMap((candidate) => {
      if (!reviewedIds.has(candidate.primaryHypothesisId)) return [];
      const decisiveEvidenceIds = onlyKnownIds(candidate.decisiveEvidenceIds, knownEvidenceIds);
      const normalized: CandidateWorking = {
        ...candidate,
        decisiveEvidenceIds,
        affectedAssets: unique(candidate.affectedAssets),
        candidateKey: stableKey("candidate", candidate.primaryHypothesisId, candidate.eventSignature, candidate.thesis),
        noveltyFingerprint: hash(JSON.stringify({
          event: candidate.eventSignature.toLowerCase(),
          thesis: candidate.thesis.toLowerCase(),
          mechanism: candidate.causalMechanism.toLowerCase(),
          assets: [...candidate.affectedAssets].sort(),
          decisiveEvidenceIds: [...decisiveEvidenceIds].sort(),
          confirmation: [...candidate.confirmationCriteria].sort(),
          invalidation: [...candidate.invalidationCriteria].sort(),
        }), 64),
      };
      if (normalized.bias === "unscored") normalized.conviction = null;
      return [normalized];
    });
    storiesConsidered = candidates.length;
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
      ...stageExecution,
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
      ...stageExecution,
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
      const promotedStory = await promoteCandidate({
        candidate,
        candidateRowId: rows[0].id,
        decision,
        lifecycleStatus: lifecycle,
        researchState: researchContext.research,
        existingStories: stories,
        evidenceById,
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
    try {
      await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(engineRunId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "failed",
          warnings,
          failure_detail: message.slice(0, 2_000),
          stories_considered: storiesConsidered,
          stories_published: publishedStories.length,
          completed_at: new Date().toISOString(),
        }),
      });
    } catch {
      // Preserve the original intelligence failure.
    }
    return {
      enabled: true,
      engineRunId,
      status: "failed",
      evidenceConsidered: 0,
      hypothesesGenerated,
      hypothesesPromoted,
      storiesConsidered,
      storiesPublished: publishedStories.length,
      storyIds: publishedStories.map((story) => story.id),
      warnings,
    };
  }
}
