import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { IntelligencePipelineResult, StageExecution, StoryCandidate } from "./contracts.ts";
import { noveltyFingerprint } from "./deduplication.ts";
import type { AcquisitionFailure, AcquisitionFailureSink } from "./providers.ts";

function assertResult<T>(data: T | null, error: { message: string } | null, operation: string): T {
  if (error) throw new Error(`${operation}: ${error.message}`);
  if (data === null) throw new Error(`${operation}: no record returned.`);
  return data;
}

function limited(value: unknown, fallback = 25, maximum = 100) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function uuid(value: string | null | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function canonicalStorySlug(title: string, candidateId: string) {
  const base = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "alchemy-research";
  return `${base}-${createHash("sha256").update(candidateId).digest("hex").slice(0, 8)}`;
}

function publicStoryStatus(lifecycle: string) {
  return lifecycle === "confirmed" ? "publish" : "develop";
}

type ReevaluationQueueRow = {
  id: string;
  target_id: string;
  requested_by_evidence_id: string | null;
  [key: string]: unknown;
};

export class IntelligenceRepository implements AcquisitionFailureSink {
  readonly client: SupabaseClient;

  constructor(client: SupabaseClient = createSupabaseAdminClient()) {
    this.client = client;
  }

  async record(failure: AcquisitionFailure) {
    const { error } = await this.client.from("intelligence_acquisition_failures").insert({
      provider_key: failure.providerKey,
      capability: failure.capability,
      request_key: failure.requestKey,
      failure_code: failure.code,
      failure_detail: failure.detail,
      retryable: failure.retryable,
      request_metadata: failure.metadata,
    });
    if (error) throw new Error(`record acquisition failure: ${error.message}`);
  }

  async findEngineRunByKey(runKey: string) {
    const { data, error } = await this.client.from("intelligence_engine_runs")
      .select("id,run_key,status,stories_considered,stories_published,warnings,completed_at")
      .eq("run_key", runKey)
      .maybeSingle();
    if (error) throw new Error(`find intelligence engine run: ${error.message}`);
    return data;
  }

  async beginEngineRun(
    triggerKind: string,
    metadata: Record<string, unknown> = {},
    options: { runKey?: string | null; researchRunId?: string | null } = {},
  ) {
    const { data, error } = await this.client.from("intelligence_engine_runs").insert({
      trigger_kind: triggerKind,
      metadata,
      status: "started",
      run_key: options.runKey || null,
      research_run_id: options.researchRunId || null,
    }).select("id").single();
    return assertResult(data, error, "begin intelligence engine run").id as string;
  }

  async finishEngineRun(runId: string, input: {
    status: "completed" | "partial" | "failed" | "blocked";
    storiesConsidered?: number;
    storiesPublished?: number;
    warnings?: string[];
    failureDetail?: string | null;
  }) {
    const { error } = await this.client.from("intelligence_engine_runs").update({
      status: input.status,
      stories_considered: input.storiesConsidered || 0,
      stories_published: input.storiesPublished || 0,
      warnings: input.warnings || [],
      failure_detail: input.failureDetail || null,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
    if (error) throw new Error(`finish intelligence engine run: ${error.message}`);
  }

  async persistStageExecution(runId: string, execution: StageExecution) {
    const { data: prompt, error: promptError } = await this.client.from("intelligence_prompt_versions")
      .select("id").eq("stage_key", execution.stage).eq("version", execution.version).maybeSingle();
    if (promptError) throw new Error(`load ${execution.stage} prompt version: ${promptError.message}`);
    const { error } = await this.client.from("intelligence_stage_runs").insert({
      engine_run_id: runId,
      prompt_version_id: prompt?.id || null,
      stage_key: execution.stage,
      status: "completed",
      output_payload: execution.output as Record<string, unknown>,
      model_name: execution.model,
      provider_request_id: execution.requestId,
      input_tokens: execution.inputTokens,
      output_tokens: execution.outputTokens,
      completed_at: new Date().toISOString(),
    });
    if (error) throw new Error(`persist ${execution.stage} stage run: ${error.message}`);
  }

  async persistPipelineResult(runId: string, result: IntelligencePipelineResult) {
    const ancestryIds = new Map<string, string>();
    const ancestryKeys = new Set([
      result.evidence.sourceAncestryKey,
      ...result.hypotheses.flatMap((hypothesis) => hypothesis.sourceAncestryGroupIds),
    ].filter(Boolean));
    for (const ancestryKey of ancestryKeys) {
      const { data, error } = await this.client.from("intelligence_source_ancestry_groups").upsert({
        ancestry_key: ancestryKey,
        canonical_name: ancestryKey,
      }, { onConflict: "ancestry_key" }).select("id").single();
      ancestryIds.set(ancestryKey, assertResult(data, error, `upsert source ancestry ${ancestryKey}`).id as string);
    }

    const externalSourceId = result.evidence.sourceExternalId || `${result.evidence.sourceAncestryKey}:${result.evidence.sourceName}`;
    const { data: sourceData, error: sourceError } = await this.client.from("intelligence_evidence_sources").upsert({
      ancestry_group_id: ancestryIds.get(result.evidence.sourceAncestryKey) || null,
      provider_key: result.evidence.providerKey,
      external_source_id: externalSourceId,
      source_name: result.evidence.sourceName,
      source_type: result.evidence.sourceType,
      source_url: result.evidence.sourceUrl || null,
      source_tier: result.evidence.sourceTier,
      reliability_score: result.evidence.reliabilityScore,
      last_seen_at: result.evidence.receivedAt,
    }, { onConflict: "provider_key,external_source_id" }).select("id").single();
    const sourceId = assertResult(sourceData, sourceError, "upsert intelligence source").id as string;

    const { data: evidenceData, error: evidenceError } = await this.client.from("intelligence_evidence").upsert({
      source_id: sourceId,
      external_evidence_id: result.evidence.externalEvidenceId || null,
      evidence_class: result.evidence.evidenceClass,
      support_direction: result.evidence.supportDirection,
      claim_text: result.evidence.claimText,
      summary: result.evidence.summary || null,
      event_at: result.evidence.eventAt || null,
      published_at: result.evidence.publishedAt || null,
      available_at: result.evidence.availableAt || null,
      received_at: result.evidence.receivedAt,
      geography: result.evidence.geography || null,
      affected_assets: result.evidence.affectedAssets,
      affected_topics: result.evidence.affectedTopics,
      confidence: result.evidence.confidence,
      content_hash: result.evidence.contentHash,
      provenance_urls: result.evidence.provenanceUrls,
      structured_payload: result.evidence.structuredPayload,
      raw_payload: result.evidence.rawPayload,
      normalizer_version: result.evidence.normalizerVersion,
    }, { onConflict: "source_id,content_hash" }).select("id").single();
    const evidenceId = assertResult(evidenceData, evidenceError, "upsert canonical evidence").id as string;

    const entityIds = new Map<string, string>();
    for (const entity of result.entities.entities) {
      const { data, error } = await this.client.from("intelligence_entities").upsert({
        canonical_key: entity.canonicalKey,
        entity_type: entity.type,
        canonical_name: entity.name,
        aliases: entity.aliases,
        identifiers: entity.identifiers,
      }, { onConflict: "canonical_key" }).select("id").single();
      const entityId = assertResult(data, error, `upsert entity ${entity.canonicalKey}`).id as string;
      entityIds.set(entity.canonicalKey, entityId);
      const { error: linkError } = await this.client.from("intelligence_evidence_entities").upsert({
        evidence_id: evidenceId,
        entity_id: entityId,
        relationship_role: "mentioned",
        salience: entity.salience,
      }, { onConflict: "evidence_id,entity_id,relationship_role" });
      if (linkError) throw new Error(`link evidence entity: ${linkError.message}`);
    }

    for (const relationship of result.entities.relationships) {
      const fromId = entityIds.get(relationship.fromCanonicalKey);
      const toId = entityIds.get(relationship.toCanonicalKey);
      if (!fromId || !toId) continue;
      const { error } = await this.client.from("intelligence_entity_relationships").upsert({
        from_entity_id: fromId,
        relationship_type: relationship.relationship,
        to_entity_id: toId,
        direction: relationship.direction,
        confidence: relationship.confidence,
        evidence_summary: relationship.evidenceSummary,
      }, { onConflict: "from_entity_id,relationship_type,to_entity_id" });
      if (error) throw new Error(`upsert entity relationship: ${error.message}`);
    }

    const { data: beliefData, error: beliefError } = await this.client.from("intelligence_market_beliefs").upsert({
      belief_key: result.belief.beliefKey,
      statement: result.belief.statement,
      priced_state: result.belief.pricedState,
      consensus_strength: result.belief.consensusStrength,
      affected_assets: result.belief.affectedAssets,
      evidence_ids: [evidenceId],
    }, { onConflict: "belief_key" }).select("id").single();
    const beliefId = assertResult(beliefData, beliefError, "upsert market belief").id as string;

    let divergenceId: string | null = null;
    if (result.divergence.material) {
      const { data, error } = await this.client.from("intelligence_divergences").upsert({
        market_belief_id: beliefId,
        divergence_key: result.divergence.divergenceKey,
        observed_change: result.divergence.observedChange,
        expected_change: result.divergence.expectedChange,
        magnitude: result.divergence.magnitude,
        persistence_score: result.divergence.persistenceScore,
        decisive_evidence_ids: [evidenceId],
      }, { onConflict: "divergence_key" }).select("id").single();
      divergenceId = assertResult(data, error, "upsert divergence").id as string;
    }

    const hypothesisIds = new Map<string, string>();
    for (const hypothesis of result.hypotheses) {
      const evidenceForIds = hypothesis.evidenceForIds.length ? [evidenceId] : [];
      const evidenceAgainstIds = hypothesis.evidenceAgainstIds.length ? [evidenceId] : [];
      const { data, error } = await this.client.from("intelligence_hypotheses").upsert({
        divergence_id: divergenceId,
        hypothesis_key: hypothesis.hypothesisKey,
        question: hypothesis.question,
        statement: hypothesis.statement,
        market_belief: hypothesis.marketBelief,
        divergence_summary: hypothesis.divergence,
        causal_mechanism: hypothesis.causalMechanism,
        affected_assets: hypothesis.affectedAssets,
        evidence_for_ids: evidenceForIds,
        evidence_against_ids: evidenceAgainstIds,
        causal_chain: hypothesis.causalChain,
        confirmation_criteria: hypothesis.confirmationCriteria,
        invalidation_criteria: hypothesis.invalidationCriteria,
        next_catalysts: hypothesis.nextCatalysts,
        confidence: hypothesis.confidence,
        status: "detected",
        last_evaluated_at: new Date().toISOString(),
      }, { onConflict: "hypothesis_key" }).select("id").single();
      const hypothesisId = assertResult(data, error, `upsert hypothesis ${hypothesis.hypothesisKey}`).id as string;
      hypothesisIds.set(hypothesis.hypothesisKey, hypothesisId);
      const { error: linkError } = await this.client.from("intelligence_hypothesis_evidence").upsert({
        hypothesis_id: hypothesisId,
        evidence_id: evidenceId,
        evidence_role: "decisive",
        weight: hypothesis.confidence,
        rationale: "Canonical evidence that triggered this hypothesis evaluation.",
      }, { onConflict: "hypothesis_id,evidence_id,evidence_role" });
      if (linkError) throw new Error(`link hypothesis evidence: ${linkError.message}`);
      if (evidenceForIds.length) {
        const { error: supportError } = await this.client.from("intelligence_hypothesis_evidence").upsert({
          hypothesis_id: hypothesisId,
          evidence_id: evidenceId,
          evidence_role: "supporting",
          weight: hypothesis.confidence,
          rationale: "Canonical evidence identified by the hypothesis stage as supporting evidence.",
        }, { onConflict: "hypothesis_id,evidence_id,evidence_role" });
        if (supportError) throw new Error(`link supporting hypothesis evidence: ${supportError.message}`);
      }
      if (evidenceAgainstIds.length) {
        const { error: contradictionError } = await this.client.from("intelligence_hypothesis_evidence").upsert({
          hypothesis_id: hypothesisId,
          evidence_id: evidenceId,
          evidence_role: "contradicting",
          weight: hypothesis.confidence,
          rationale: "Canonical evidence identified by the hypothesis stage as conflicting evidence.",
        }, { onConflict: "hypothesis_id,evidence_id,evidence_role" });
        if (contradictionError) throw new Error(`link conflicting hypothesis evidence: ${contradictionError.message}`);
      }
    }

    for (const [index, assessment] of result.challengerAssessments.entries()) {
      const hypothesis = result.hypotheses[index];
      const hypothesisId = hypothesis ? hypothesisIds.get(hypothesis.hypothesisKey) : null;
      if (!hypothesisId) continue;
      const { error } = await this.client.from("intelligence_challenger_assessments").insert({
        hypothesis_id: hypothesisId,
        verdict: assessment.verdict,
        weakest_link: assessment.weakestLink,
        strongest_countercase: assessment.strongestCountercase,
        conflicting_evidence_ids: assessment.conflictingEvidenceIds.length ? [evidenceId] : [],
        pricing_confirmation: assessment.pricingConfirmation,
        cross_asset_confirmation: assessment.crossAssetConfirmation,
        timing_risk: assessment.timingRisk,
        next_resolving_evidence: assessment.nextResolvingEvidence,
        hidden_assumptions: assessment.hiddenAssumptions,
        alternative_mechanisms: assessment.alternativeMechanisms,
        missing_evidence: assessment.missingEvidence,
        confidence_adjustment: assessment.confidenceAdjustment,
        adjusted_confidence: assessment.adjustedConfidence,
        assessment_payload: assessment,
      });
      if (error) throw new Error(`persist challenger assessment: ${error.message}`);
      const decisionState = assessment.verdict === "promote" ? "publish"
        : assessment.verdict === "reject" ? "rejected"
          : assessment.verdict === "watch" ? "watch" : "dormant";
      const { error: hypothesisError } = await this.client.from("intelligence_hypotheses").update({
        decision_state: decisionState,
        confidence: assessment.adjustedConfidence,
        last_evaluated_at: new Date().toISOString(),
      }).eq("id", hypothesisId);
      if (hypothesisError) throw new Error(`update challenged hypothesis: ${hypothesisError.message}`);
    }

    for (const scenario of result.scenarios) {
      const hypothesisId = hypothesisIds.get(scenario.hypothesisKey);
      if (!hypothesisId) continue;
      const { error } = await this.client.from("intelligence_scenarios").upsert({
        engine_run_id: runId,
        hypothesis_id: hypothesisId,
        asset: scenario.asset,
        bias: scenario.bias,
        conviction: scenario.conviction,
        base_case: scenario.baseCase,
        bull_case: scenario.bullCase,
        bear_case: scenario.bearCase,
        tail_case: scenario.tailCase || null,
        confirmation: scenario.confirmation,
        invalidation: scenario.invalidation,
        explanatory_evidence_ids: scenario.explanatoryEvidenceIds.length ? [evidenceId] : [],
      }, { onConflict: "engine_run_id,hypothesis_id,asset" });
      if (error) throw new Error(`persist scenario ${scenario.asset}: ${error.message}`);
    }

    const { data: promptRows, error: promptError } = await this.client.from("intelligence_prompt_versions")
      .select("id,stage_key,version").eq("is_active", true);
    if (promptError) throw new Error(`load prompt versions: ${promptError.message}`);
    const promptIds = new Map((promptRows || []).map((row) => [`${row.stage_key}:${row.version}`, row.id as string]));
    for (const execution of result.stageExecutions) {
      const { error } = await this.client.from("intelligence_stage_runs").insert({
        engine_run_id: runId,
        prompt_version_id: promptIds.get(`${execution.stage}:${execution.version}`) || null,
        stage_key: execution.stage,
        status: "completed",
        output_payload: execution.output as Record<string, unknown>,
        model_name: execution.model,
        provider_request_id: execution.requestId,
        input_tokens: execution.inputTokens,
        output_tokens: execution.outputTokens,
        completed_at: new Date().toISOString(),
      });
      if (error) throw new Error(`persist ${execution.stage} stage run: ${error.message}`);
    }

    const candidateIds: string[] = [];
    const promotableCandidateIds: string[] = [];
    for (const candidate of result.storyCandidates) {
      const hypothesis = result.hypotheses.find((item) => item.hypothesisKey === candidate.hypothesisKey)
        || result.hypotheses.find((item) => item.causalMechanism === candidate.causalMechanism)
        || result.hypotheses[0];
      const ancestryGroupIds = candidate.sourceAncestryGroupIds.map((key) => ancestryIds.get(key)).filter((id): id is string => Boolean(id));
      const noveltyClass = candidate.noveltyClass || "new_story";
      const { data, error } = await this.client.from("intelligence_story_candidates").upsert({
        engine_run_id: runId,
        primary_hypothesis_id: hypothesis ? hypothesisIds.get(hypothesis.hypothesisKey) || null : null,
        title: candidate.title,
        question: candidate.question || null,
        thesis: candidate.thesis,
        market_belief: candidate.marketBelief || null,
        divergence_summary: candidate.divergence || null,
        bias: candidate.bias || null,
        conviction: candidate.conviction ?? null,
        base_case: candidate.baseCase || null,
        bull_case: candidate.bullCase || null,
        bear_case: candidate.bearCase || null,
        tail_case: candidate.tailCase || null,
        strongest_support: candidate.strongestSupport || null,
        strongest_contradiction: candidate.strongestContradiction || null,
        event_signature: candidate.eventSignature,
        causal_mechanism: candidate.causalMechanism,
        affected_assets: candidate.affectedAssets,
        decisive_evidence_ids: [evidenceId],
        source_ancestry_group_ids: ancestryGroupIds,
        confirmation_criteria: candidate.confirmationCriteria,
        invalidation_criteria: candidate.invalidationCriteria,
        next_catalysts: candidate.nextCatalysts,
        confidence: candidate.confidence,
        qualification_score: candidate.qualificationScore,
        publication_eligible: candidate.publicationEligible,
        lifecycle_status: candidate.lifecycleStatus,
        novelty_fingerprint: noveltyFingerprint(candidate),
        novelty_class: noveltyClass,
        duplicate_of_story_id: uuid(candidate.duplicateOfId),
        novelty_rationale: candidate.noveltyRationale || null,
        canonical_external_url: candidate.canonicalExternalUrl || null,
        research_synthesis: candidate.researchSynthesis || null,
        candidate_status: ["duplicate", "insufficient_novelty"].includes(noveltyClass)
          ? "rejected"
          : candidate.publicationEligible ? "qualified" : "pending",
      }, { onConflict: "engine_run_id,novelty_fingerprint" }).select("id").single();
      const persistedCandidateId = assertResult(data, error, "persist story candidate").id as string;
      candidateIds.push(persistedCandidateId);
      if (candidate.publicationEligible && !["duplicate", "insufficient_novelty"].includes(noveltyClass)) {
        promotableCandidateIds.push(persistedCandidateId);
      }
    }

    return { evidenceId, sourceId, beliefId, divergenceId, hypothesisIds: [...hypothesisIds.values()], candidateIds, promotableCandidateIds };
  }

  async searchEvidence(args: Record<string, unknown>) {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    let request = this.client.from("intelligence_evidence").select("id,source_id,evidence_class,support_direction,claim_text,summary,event_at,published_at,available_at,affected_assets,affected_topics,confidence,provenance_urls,created_at")
      .order("event_at", { ascending: false, nullsFirst: false }).limit(limited(args.limit));
    if (query) request = request.ilike("claim_text", `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    const { data, error } = await request;
    return assertResult(data, error, "search evidence");
  }

  async getEvidenceRoom(args: Record<string, unknown>) {
    const ownerKind = String(args.ownerKind || "story");
    const ownerId = String(args.ownerId || "");
    if (!ownerId) throw new Error("ownerId is required.");
    const { data: room, error } = await this.client.from("intelligence_evidence_rooms").select("*")
      .eq("owner_kind", ownerKind).eq("owner_id", ownerId).maybeSingle();
    if (error) throw new Error(`get evidence room: ${error.message}`);
    if (!room) return null;
    const { data: items, error: itemsError } = await this.client.from("intelligence_evidence_room_items")
      .select("evidence_id,evidence_role,independence_group_id,relevance_score,notes,added_at")
      .eq("room_id", room.id).order("relevance_score", { ascending: false });
    if (itemsError) throw new Error(`get evidence room items: ${itemsError.message}`);
    const evidenceIds = (items || []).map((item) => item.evidence_id);
    const evidence = evidenceIds.length
      ? await this.client.from("intelligence_evidence").select("id,evidence_class,support_direction,claim_text,summary,event_at,confidence,provenance_urls").in("id", evidenceIds)
      : { data: [], error: null };
    if (evidence.error) throw new Error(`get evidence room evidence: ${evidence.error.message}`);
    return { ...room, items, evidence: evidence.data || [] };
  }

  async getEntityGraph(args: Record<string, unknown>) {
    let request = this.client.from("intelligence_entities").select("*");
    if (args.id) request = request.eq("id", String(args.id));
    else if (args.canonicalKey) request = request.eq("canonical_key", String(args.canonicalKey));
    else throw new Error("id or canonicalKey is required.");
    const { data: entity, error } = await request.maybeSingle();
    if (error) throw new Error(`get entity: ${error.message}`);
    if (!entity) return null;
    const { data: outgoing, error: outgoingError } = await this.client.from("intelligence_entity_relationships").select("*").eq("from_entity_id", entity.id);
    const { data: incoming, error: incomingError } = await this.client.from("intelligence_entity_relationships").select("*").eq("to_entity_id", entity.id);
    if (outgoingError || incomingError) throw new Error(`get entity relationships: ${outgoingError?.message || incomingError?.message}`);
    return { entity, outgoing: outgoing || [], incoming: incoming || [] };
  }

  async searchEntities(args: Record<string, unknown>) {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    let request = this.client.from("intelligence_entities").select("id,canonical_key,entity_type,canonical_name,aliases,identifiers,metadata")
      .order("canonical_name", { ascending: true }).limit(limited(args.limit));
    if (query) request = request.ilike("canonical_name", `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    if (args.entityType) request = request.eq("entity_type", String(args.entityType));
    const { data, error } = await request;
    return assertResult(data, error, "search entities");
  }

  async getMarketBeliefs(args: Record<string, unknown>) {
    let request = this.client.from("intelligence_market_beliefs").select("*")
      .order("observed_at", { ascending: false }).limit(limited(args.limit));
    if (args.status) request = request.eq("status", String(args.status));
    const { data, error } = await request;
    return assertResult(data, error, "get market beliefs");
  }

  async getDivergences(args: Record<string, unknown>) {
    let request = this.client.from("intelligence_divergences").select("*,intelligence_market_beliefs(belief_key,statement,priced_state)")
      .order("detected_at", { ascending: false }).limit(limited(args.limit));
    if (args.status) request = request.eq("status", String(args.status));
    const { data, error } = await request;
    return assertResult(data, error, "get divergences");
  }

  async getHypotheses(args: Record<string, unknown>) {
    let request = this.client.from("intelligence_hypotheses").select("*,intelligence_challenger_assessments(*)")
      .order("updated_at", { ascending: false }).limit(limited(args.limit));
    if (args.status) request = request.eq("status", String(args.status));
    const { data, error } = await request;
    return assertResult(data, error, "get hypotheses");
  }

  async getStory(args: Record<string, unknown>) {
    let request = this.client.from("stories").select("*");
    if (args.storyId) request = request.eq("id", String(args.storyId));
    else if (args.slug) request = request.eq("slug", String(args.slug));
    else throw new Error("storyId or slug is required.");
    const { data: story, error } = await request.maybeSingle();
    if (error) throw new Error(`get Story: ${error.message}`);
    if (!story) return null;
    const [{ data: state, error: stateError }, { data: evidence, error: evidenceError }, { data: relations, error: relationError }] = await Promise.all([
      this.client.from("intelligence_story_states").select("*").eq("story_id", story.id).maybeSingle(),
      this.client.from("intelligence_story_evidence").select("evidence_id,evidence_role,weight,rationale,linked_at").eq("story_id", story.id),
      this.client.from("intelligence_story_relations").select("*").or(`story_id.eq.${story.id},related_story_id.eq.${story.id}`),
    ]);
    if (stateError || evidenceError || relationError) throw new Error(`get Story intelligence: ${stateError?.message || evidenceError?.message || relationError?.message}`);
    return { story, intelligenceState: state, evidenceLinks: evidence || [], relations: relations || [] };
  }

  async getLiveStories() {
    const { data, error } = await this.client.from("intelligence_story_states").select("*,stories!intelligence_story_states_story_id_fkey(id,slug,title,thesis,status,confidence,rank,market_question,confirmation_trigger,invalidation_trigger,next_catalyst,assets)")
      .eq("publication_eligible", true)
      .in("lifecycle_status", ["detected", "developing", "confirmed", "weakening"])
      .order("last_evidence_at", { ascending: false, nullsFirst: false })
      .order("qualification_score", { ascending: false }).limit(15);
    return assertResult(data, error, "get live stories");
  }

  async getFeaturedStories() {
    const { data, error } = await this.client.from("intelligence_story_states").select("*,stories!intelligence_story_states_story_id_fkey(id,slug,title,thesis,status,confidence,rank,market_question,confirmation_trigger,invalidation_trigger,next_catalyst,assets)")
      .eq("publication_eligible", true)
      .in("lifecycle_status", ["detected", "developing", "confirmed", "weakening"])
      .order("last_evidence_at", { ascending: false, nullsFirst: false })
      .order("qualification_score", { ascending: false }).limit(6);
    return assertResult(data, error, "get featured stories");
  }

  async getStoryHistory(args: Record<string, unknown>) {
    const storyId = String(args.storyId || "");
    if (!storyId) throw new Error("storyId is required.");
    const { data, error } = await this.client.from("intelligence_story_history").select("*")
      .eq("story_id", storyId).order("recorded_at", { ascending: false }).limit(limited(args.limit, 50, 250));
    return assertResult(data, error, "get Story history");
  }

  async getProviderFailures(args: Record<string, unknown>) {
    let request = this.client.from("intelligence_acquisition_failures").select("*")
      .is("resolved_at", null).order("last_failed_at", { ascending: false }).limit(limited(args.limit));
    if (args.providerKey) request = request.eq("provider_key", String(args.providerKey));
    const { data, error } = await request;
    return assertResult(data, error, "get provider failures");
  }

  async getStoryCandidates(args: Record<string, unknown>) {
    let request = this.client.from("intelligence_story_candidates").select("*")
      .order("qualification_score", { ascending: false }).limit(limited(args.limit));
    if (args.status) request = request.eq("candidate_status", String(args.status));
    const { data, error } = await request;
    return assertResult(data, error, "get Story candidates");
  }

  async promoteStoryCandidate(args: Record<string, unknown>) {
    const candidateId = String(args.candidateId || "");
    if (!candidateId) throw new Error("candidateId is required.");
    const { data: candidate, error: candidateError } = await this.client.from("intelligence_story_candidates").select("*").eq("id", candidateId).maybeSingle();
    if (candidateError || !candidate) throw new Error(`load Story candidate: ${candidateError?.message || "Candidate not found."}`);
    if (!candidate.publication_eligible || candidate.candidate_status === "rejected") {
      throw new Error("Only a publication-eligible, non-rejected candidate can be promoted.");
    }
    if (["duplicate", "insufficient_novelty"].includes(candidate.novelty_class)) {
      throw new Error(`A ${candidate.novelty_class} candidate cannot create or update a canonical Story.`);
    }

    let storyId = String(args.storyId || candidate.duplicate_of_story_id || "");
    let created = false;
    let story: { id: string; slug: string; title: string } | null = null;
    if (storyId) {
      const { data, error } = await this.client.from("stories").select("id,slug,title").eq("id", storyId).maybeSingle();
      if (error || !data) throw new Error(`load canonical Story: ${error?.message || "Story not found."}`);
      story = data;
    } else {
      if (!['new_story', 'related_distinct'].includes(candidate.novelty_class)) {
        throw new Error(`${candidate.novelty_class} requires the canonical existing Story id.`);
      }
      const slug = canonicalStorySlug(candidate.title, candidateId);
      const status = publicStoryStatus(candidate.lifecycle_status);
      const { data, error } = await this.client.from("stories").insert({
        slug,
        title: candidate.title,
        thesis: candidate.thesis,
        status,
        confidence: Math.round(candidate.confidence),
        rank: null,
        market_question: candidate.question,
        dominant_narrative: candidate.market_belief,
        best_explanation: candidate.causal_mechanism,
        strongest_support: candidate.strongest_support,
        strongest_contradiction: candidate.strongest_contradiction,
        priced_assessment: candidate.market_belief,
        confirmation_trigger: candidate.confirmation_criteria?.join(" ") || null,
        invalidation_trigger: candidate.invalidation_criteria?.join(" ") || null,
        next_catalyst: candidate.next_catalysts?.join(" ") || null,
        article_angle: candidate.research_synthesis,
        provisional_title: candidate.title,
        article_verdict: status === "publish" ? "publish" : "develop_now",
        assets: candidate.affected_assets || [],
        source_quality: Math.round(candidate.qualification_score),
        novelty: Math.round(candidate.qualification_score),
        persistence: Math.round(candidate.confidence),
        trader_relevance: Math.round(candidate.qualification_score),
        article_potential: Math.round(candidate.qualification_score),
        created_by: "alchemy_research_engine",
      }).select("id,slug,title").single();
      story = assertResult(data, error, "create original Alchemy Story") as { id: string; slug: string; title: string };
      storyId = story.id;
      created = true;
    }

    const { data: versionRows, error: versionError } = await this.client.from("story_thesis_versions")
      .select("version_number").eq("story_id", storyId).order("version_number", { ascending: false }).limit(1);
    if (versionError) throw new Error(`load Story thesis version: ${versionError.message}`);
    const versionNumber = Number(versionRows?.[0]?.version_number || 0) + 1;
    const eventAt = new Date().toISOString();
    const { data: event, error: eventError } = await this.client.from("story_events").insert({
      story_id: storyId,
      event_type: "thesis_revision",
      headline: created ? "Original Alchemy research Story created" : "Alchemy intelligence updated the canonical thesis",
      detail: candidate.research_synthesis || candidate.thesis,
      impact: "neutral",
      confidence_delta: null,
      event_at: eventAt,
      metadata: { candidateId, noveltyClass: candidate.novelty_class, intelligenceEvidenceIds: candidate.decisive_evidence_ids || [] },
    }).select("id").single();
    const eventId = assertResult(event, eventError, "append canonical Story event").id as string;

    const status = publicStoryStatus(candidate.lifecycle_status);
    const { data: thesisVersion, error: thesisError } = await this.client.from("story_thesis_versions").insert({
      story_id: storyId,
      event_id: eventId,
      version_number: versionNumber,
      title: candidate.title,
      thesis: candidate.thesis,
      status,
      confidence: Math.round(candidate.confidence),
      market_question: candidate.question,
      dominant_narrative: candidate.market_belief,
      best_explanation: candidate.causal_mechanism,
      strongest_support: candidate.strongest_support,
      strongest_contradiction: candidate.strongest_contradiction,
      priced_assessment: candidate.market_belief,
      confirmation_trigger: candidate.confirmation_criteria?.join(" ") || null,
      invalidation_trigger: candidate.invalidation_criteria?.join(" ") || null,
      next_catalyst: candidate.next_catalysts?.join(" ") || null,
      article_angle: candidate.research_synthesis,
      provisional_title: candidate.title,
      article_verdict: status === "publish" ? "publish" : "develop_now",
      assets: candidate.affected_assets || [],
      snapshot: {
        source: "alchemy_research_engine",
        candidateId,
        bias: candidate.bias,
        conviction: candidate.conviction,
        baseCase: candidate.base_case,
        bullCase: candidate.bull_case,
        bearCase: candidate.bear_case,
        tailCase: candidate.tail_case,
      },
      change_reason: created ? "Original hypothesis survived Challenger and novelty review." : candidate.novelty_rationale || "New evidence updated the existing Story.",
      effective_at: eventAt,
    }).select("id").single();
    const thesisVersionId = assertResult(thesisVersion, thesisError, "persist canonical Story thesis version").id as string;

    const { error: storyUpdateError } = await this.client.from("stories").update({
      title: candidate.title,
      thesis: candidate.thesis,
      status,
      confidence: Math.round(candidate.confidence),
      market_question: candidate.question,
      dominant_narrative: candidate.market_belief,
      best_explanation: candidate.causal_mechanism,
      strongest_support: candidate.strongest_support,
      strongest_contradiction: candidate.strongest_contradiction,
      priced_assessment: candidate.market_belief,
      confirmation_trigger: candidate.confirmation_criteria?.join(" ") || null,
      invalidation_trigger: candidate.invalidation_criteria?.join(" ") || null,
      next_catalyst: candidate.next_catalysts?.join(" ") || null,
      assets: candidate.affected_assets || [],
      current_thesis_version_id: thesisVersionId,
      updated_at: eventAt,
    }).eq("id", storyId);
    if (storyUpdateError) throw new Error(`update canonical Story projection: ${storyUpdateError.message}`);

    const { data: state, error: stateError } = await this.client.from("intelligence_story_states").upsert({
      story_id: storyId,
      story_candidate_id: candidateId,
      primary_hypothesis_id: candidate.primary_hypothesis_id,
      lifecycle_status: candidate.lifecycle_status,
      publication_eligible: candidate.publication_eligible,
      qualification_score: candidate.qualification_score,
      event_signature: candidate.event_signature,
      thesis_signature: candidate.thesis,
      causal_mechanism: candidate.causal_mechanism,
      affected_assets: candidate.affected_assets,
      decisive_evidence_ids: candidate.decisive_evidence_ids,
      source_ancestry_group_ids: candidate.source_ancestry_group_ids,
      confirmation_criteria: candidate.confirmation_criteria,
      invalidation_criteria: candidate.invalidation_criteria,
      next_catalysts: candidate.next_catalysts,
      novelty_fingerprint: candidate.novelty_fingerprint,
      novelty_class: candidate.novelty_class,
      canonical_external_url: candidate.canonical_external_url,
      research_synthesis: candidate.research_synthesis,
      bias: candidate.bias,
      conviction: candidate.conviction,
      base_case: candidate.base_case,
      bull_case: candidate.bull_case,
      bear_case: candidate.bear_case,
      tail_case: candidate.tail_case,
      market_belief: candidate.market_belief,
      divergence_summary: candidate.divergence_summary,
      strongest_support: candidate.strongest_support,
      strongest_contradiction: candidate.strongest_contradiction,
      last_evidence_at: new Date().toISOString(),
      last_evaluated_at: new Date().toISOString(),
    }, { onConflict: "story_id" }).select("id").single();
    const storyStateId = assertResult(state, stateError, "promote Story intelligence state").id as string;

    const { data: room, error: roomError } = await this.client.from("intelligence_evidence_rooms").upsert({
      owner_kind: "story",
      owner_id: storyId,
      title: `Evidence Room: ${story.title}`,
      room_status: candidate.decisive_evidence_ids?.length ? "ready" : "attention",
      synthesis: candidate.research_synthesis || candidate.thesis,
      unresolved_questions: [...(candidate.confirmation_criteria || []), ...(candidate.invalidation_criteria || [])],
      metadata: { candidateId, storySlug: story.slug },
    }, { onConflict: "owner_kind,owner_id" }).select("id").single();
    const roomId = assertResult(room, roomError, "create Story Evidence Room").id as string;

    for (const evidenceId of candidate.decisive_evidence_ids || []) {
      const { error: storyEvidenceError } = await this.client.from("intelligence_story_evidence").upsert({
        story_id: storyId,
        evidence_id: evidenceId,
        evidence_role: "decisive",
        weight: candidate.confidence,
        rationale: "Decisive canonical evidence attached during approved candidate promotion.",
      }, { onConflict: "story_id,evidence_id,evidence_role" });
      if (storyEvidenceError) throw new Error(`link promoted Story evidence: ${storyEvidenceError.message}`);
      const { error: roomItemError } = await this.client.from("intelligence_evidence_room_items").upsert({
        room_id: roomId,
        evidence_id: evidenceId,
        evidence_role: "decisive",
        relevance_score: candidate.confidence,
      }, { onConflict: "room_id,evidence_id" });
      if (roomItemError) throw new Error(`link promoted Evidence Room item: ${roomItemError.message}`);
    }

    const { error: noveltyError } = await this.client.from("intelligence_novelty_memory").upsert({
      story_id: storyId,
      fingerprint: candidate.novelty_fingerprint,
      event_signature: candidate.event_signature,
      thesis_signature: candidate.thesis,
      mechanism_signature: candidate.causal_mechanism,
      asset_signature: candidate.affected_assets,
      decisive_evidence_signature: candidate.decisive_evidence_ids,
      source_independence_signature: candidate.source_ancestry_group_ids,
      confirmation_signature: candidate.confirmation_criteria,
      invalidation_signature: candidate.invalidation_criteria,
      last_seen_at: new Date().toISOString(),
      metadata: { candidateId },
    }, { onConflict: "fingerprint,story_id" });
    if (noveltyError) throw new Error(`persist promoted Story novelty memory: ${noveltyError.message}`);

    const { error: historyError } = await this.client.from("intelligence_story_history").insert({
      story_state_id: storyStateId,
      story_id: storyId,
      lifecycle_status: candidate.lifecycle_status,
      publication_eligible: candidate.publication_eligible,
      novelty_class: candidate.novelty_class,
      qualification_score: candidate.qualification_score,
      change_reason: created ? "original_story_created" : "existing_story_updated",
      state_snapshot: {
        candidateId,
        thesisVersionId,
        evidenceIds: candidate.decisive_evidence_ids || [],
        bias: candidate.bias,
        conviction: candidate.conviction,
      },
    });
    if (historyError) throw new Error(`persist Story history: ${historyError.message}`);

    const { error: promotionError } = await this.client.from("intelligence_story_candidates").update({
      promoted_story_id: storyId,
      candidate_status: "promoted",
    }).eq("id", candidateId);
    if (promotionError) throw new Error(`mark Story candidate promoted: ${promotionError.message}`);
    return { candidateId, storyId, storySlug: story.slug, created, thesisVersionId, storyStateId, evidenceRoomId: roomId, evidenceLinked: candidate.decisive_evidence_ids?.length || 0 };
  }

  async claimStoryReevaluation(queueId?: string): Promise<ReevaluationQueueRow | null> {
    const { data, error } = await this.client.rpc("claim_intelligence_story_reevaluation", {
      p_queue_id: queueId || null,
    }).maybeSingle();
    if (error) throw new Error(`claim Story re-evaluation: ${error.message}`);
    return data ? data as ReevaluationQueueRow : null;
  }

  async targetedReevaluationContext(queue: Record<string, unknown>) {
    const storyId = String(queue.target_id || "");
    const evidenceId = String(queue.requested_by_evidence_id || "");
    const { data: state, error: stateError } = await this.client.from("intelligence_story_states").select("*,stories!intelligence_story_states_story_id_fkey(id,slug,title,thesis,confidence,rank)").eq("story_id", storyId).maybeSingle();
    if (stateError || !state) throw new Error(`load targeted Story state: ${stateError?.message || "Story state not found."}`);
    const { data: evidence, error: evidenceError } = evidenceId
      ? await this.client.from("intelligence_evidence").select("id,evidence_class,support_direction,claim_text,summary,event_at,published_at,available_at,affected_assets,affected_topics,confidence,provenance_urls,source_id").eq("id", evidenceId).maybeSingle()
      : { data: null, error: null };
    if (evidenceError || !evidence) throw new Error(`load targeted evidence: ${evidenceError?.message || "Evidence not found."}`);
    const story = Array.isArray(state.stories) ? state.stories[0] : state.stories;
    const candidate: StoryCandidate = {
      id: story?.id || storyId,
      slug: story?.slug,
      title: story?.title || "Untitled Story",
      thesis: story?.thesis || state.thesis_signature || "",
      eventSignature: state.event_signature || "",
      causalMechanism: state.causal_mechanism || "",
      affectedAssets: state.affected_assets || [],
      decisiveEvidenceIds: state.decisive_evidence_ids || [],
      sourceAncestryGroupIds: state.source_ancestry_group_ids || [],
      confirmationCriteria: state.confirmation_criteria || [],
      invalidationCriteria: state.invalidation_criteria || [],
      nextCatalysts: state.next_catalysts || [],
      confidence: story?.confidence || 0,
      lifecycleStatus: state.lifecycle_status,
      publicationEligible: state.publication_eligible,
      qualificationScore: state.qualification_score,
      rank: story?.rank ?? null,
    };
    return { candidate, evidence };
  }

  async finishStoryReevaluation(queueId: string, storyId: string, input: {
    status: StoryCandidate["lifecycleStatus"];
    evidenceId: string;
    succeeded: boolean;
    error?: string | null;
  }) {
    if (input.succeeded) {
      const { error: stateError } = await this.client.from("intelligence_story_states").update({
        lifecycle_status: input.status,
        publication_eligible: !["invalidated", "archived"].includes(input.status),
        last_evidence_at: new Date().toISOString(),
        last_evaluated_at: new Date().toISOString(),
      }).eq("story_id", storyId);
      if (stateError) throw new Error(`update targeted Story lifecycle: ${stateError.message}`);
    }
    const { error: queueError } = await this.client.from("intelligence_reevaluation_queue").update({
      status: input.succeeded ? "completed" : "failed",
      completed_at: new Date().toISOString(),
      last_error: input.error || null,
    }).eq("id", queueId);
    if (queueError) throw new Error(`finish Story re-evaluation queue item: ${queueError.message}`);
  }

  async existingStoryCandidates(): Promise<StoryCandidate[]> {
    const { data, error } = await this.client.from("intelligence_story_states").select("*,stories!intelligence_story_states_story_id_fkey(id,slug,title,thesis,confidence,rank)")
      .not("lifecycle_status", "in", "(invalidated,archived)");
    if (error) throw new Error(`load novelty memory: ${error.message}`);
    return (data || []).map((row) => {
      const story = Array.isArray(row.stories) ? row.stories[0] : row.stories;
      return {
        id: story?.id || row.story_id,
        slug: story?.slug,
        title: story?.title || "Untitled Story",
        thesis: story?.thesis || row.thesis_signature || "",
        eventSignature: row.event_signature || "",
        causalMechanism: row.causal_mechanism || "",
        affectedAssets: row.affected_assets || [],
        decisiveEvidenceIds: row.decisive_evidence_ids || [],
        sourceAncestryGroupIds: row.source_ancestry_group_ids || [],
        confirmationCriteria: row.confirmation_criteria || [],
        invalidationCriteria: row.invalidation_criteria || [],
        nextCatalysts: row.next_catalysts || [],
        confidence: story?.confidence || 0,
        lifecycleStatus: row.lifecycle_status,
        publicationEligible: row.publication_eligible,
        qualificationScore: row.qualification_score,
        rank: story?.rank ?? null,
      } as StoryCandidate;
    });
  }
}
