import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type IntelligenceStoryRoom = {
  available: boolean;
  state: {
    lifecycleStatus: string;
    publicationEligible: boolean;
    qualificationScore: number;
    noveltyClass: string | null;
    researchSynthesis: string | null;
    marketBelief: string | null;
    divergence: string | null;
    bias: string | null;
    conviction: number | null;
    baseCase: string | null;
    bullCase: string | null;
    bearCase: string | null;
    tailCase: string | null;
    strongestSupport: string | null;
    strongestContradiction: string | null;
  } | null;
  hypothesis: {
    question: string | null;
    statement: string;
    causalMechanism: string;
    causalChain: Array<Record<string, unknown>>;
    decisionState: string;
    confidence: number;
  } | null;
  challenger: {
    verdict: string;
    weakestLink: string | null;
    strongestCountercase: string;
    pricingConfirmation: string | null;
    crossAssetConfirmation: string | null;
    timingRisk: string | null;
    nextResolvingEvidence: string | null;
  } | null;
  scenarios: Array<{
    asset: string;
    bias: string;
    conviction: number | null;
    baseCase: Record<string, unknown>;
    bullCase: Record<string, unknown>;
    bearCase: Record<string, unknown>;
    tailCase: Record<string, unknown> | null;
    confirmation: string;
    invalidation: string;
  }>;
  room: {
    id: string;
    title: string;
    status: string;
    synthesis: string | null;
    unresolvedQuestions: string[];
  } | null;
  evidence: Array<{
    id: string;
    role: string;
    claim: string;
    summary: string | null;
    direction: string;
    confidence: number;
    eventAt: string | null;
    provenanceUrls: string[];
  }>;
  entities: Array<{ id: string; name: string; type: string; canonicalKey: string }>;
  relationships: Array<{
    id: string;
    fromEntityId: string;
    relationship: string;
    toEntityId: string;
    confidence: number;
    evidenceSummary: string | null;
  }>;
  unavailableReason: string | null;
};

export async function getIntelligenceStoryRoom(storyId: string): Promise<IntelligenceStoryRoom> {
  const unavailable = (reason: string): IntelligenceStoryRoom => ({
    available: false,
    state: null,
    hypothesis: null,
    challenger: null,
    scenarios: [],
    room: null,
    evidence: [],
    entities: [],
    relationships: [],
    unavailableReason: reason,
  });

  try {
    const client = createSupabaseAdminClient();
    const [{ data: state, error: stateError }, { data: room, error: roomError }] = await Promise.all([
      client.from("intelligence_story_states").select("primary_hypothesis_id,lifecycle_status,publication_eligible,qualification_score,novelty_class,research_synthesis,market_belief,divergence_summary,bias,conviction,base_case,bull_case,bear_case,tail_case,strongest_support,strongest_contradiction").eq("story_id", storyId).maybeSingle(),
      client.from("intelligence_evidence_rooms").select("id,title,room_status,synthesis,unresolved_questions").eq("owner_kind", "story").eq("owner_id", storyId).maybeSingle(),
    ]);
    if (stateError || roomError) return unavailable(stateError?.message || roomError?.message || "Intelligence persistence is unavailable.");
    if (!state && !room) return unavailable("No canonical intelligence state or Evidence Room has been persisted for this Story yet.");

    const [{ data: hypothesis, error: hypothesisError }, { data: challenger, error: challengerError }, { data: scenarioRows, error: scenarioError }] = state?.primary_hypothesis_id
      ? await Promise.all([
        client.from("intelligence_hypotheses").select("question,statement,causal_mechanism,causal_chain,decision_state,confidence").eq("id", state.primary_hypothesis_id).maybeSingle(),
        client.from("intelligence_challenger_assessments").select("verdict,weakest_link,strongest_countercase,pricing_confirmation,cross_asset_confirmation,timing_risk,next_resolving_evidence").eq("hypothesis_id", state.primary_hypothesis_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        client.from("intelligence_scenarios").select("asset,bias,conviction,base_case,bull_case,bear_case,tail_case,confirmation,invalidation,created_at").eq("hypothesis_id", state.primary_hypothesis_id).order("created_at", { ascending: false }).limit(24),
      ])
      : [{ data: null, error: null }, { data: null, error: null }, { data: [], error: null }];
    if (hypothesisError || challengerError || scenarioError) return unavailable(hypothesisError?.message || challengerError?.message || scenarioError?.message || "Hypothesis persistence is unavailable.");
    const newestScenarioByAsset = new Map<string, NonNullable<typeof scenarioRows>[number]>();
    for (const scenario of scenarioRows || []) if (!newestScenarioByAsset.has(scenario.asset)) newestScenarioByAsset.set(scenario.asset, scenario);

    const { data: items, error: itemsError } = room
      ? await client.from("intelligence_evidence_room_items").select("evidence_id,evidence_role").eq("room_id", room.id).order("relevance_score", { ascending: false })
      : { data: [], error: null };
    if (itemsError) return unavailable(itemsError.message);
    const evidenceIds = (items || []).map((item) => item.evidence_id);
    const { data: evidenceRows, error: evidenceError } = evidenceIds.length
      ? await client.from("intelligence_evidence").select("id,claim_text,summary,support_direction,confidence,event_at,provenance_urls").in("id", evidenceIds)
      : { data: [], error: null };
    if (evidenceError) return unavailable(evidenceError.message);
    const evidenceById = new Map((evidenceRows || []).map((item) => [item.id, item]));

    const { data: evidenceEntities, error: entityLinkError } = evidenceIds.length
      ? await client.from("intelligence_evidence_entities").select("entity_id").in("evidence_id", evidenceIds)
      : { data: [], error: null };
    if (entityLinkError) return unavailable(entityLinkError.message);
    const entityIds = [...new Set((evidenceEntities || []).map((item) => item.entity_id))];
    const { data: entities, error: entitiesError } = entityIds.length
      ? await client.from("intelligence_entities").select("id,canonical_key,canonical_name,entity_type").in("id", entityIds)
      : { data: [], error: null };
    if (entitiesError) return unavailable(entitiesError.message);
    const { data: relationships, error: relationshipError } = entityIds.length
      ? await client.from("intelligence_entity_relationships").select("id,from_entity_id,relationship_type,to_entity_id,confidence,evidence_summary").or(`from_entity_id.in.(${entityIds.join(",")}),to_entity_id.in.(${entityIds.join(",")})`)
      : { data: [], error: null };
    if (relationshipError) return unavailable(relationshipError.message);

    return {
      available: true,
      state: state ? {
        lifecycleStatus: state.lifecycle_status,
        publicationEligible: state.publication_eligible,
        qualificationScore: state.qualification_score,
        noveltyClass: state.novelty_class,
        researchSynthesis: state.research_synthesis,
        marketBelief: state.market_belief,
        divergence: state.divergence_summary,
        bias: state.bias,
        conviction: state.conviction,
        baseCase: state.base_case,
        bullCase: state.bull_case,
        bearCase: state.bear_case,
        tailCase: state.tail_case,
        strongestSupport: state.strongest_support,
        strongestContradiction: state.strongest_contradiction,
      } : null,
      hypothesis: hypothesis ? {
        question: hypothesis.question,
        statement: hypothesis.statement,
        causalMechanism: hypothesis.causal_mechanism,
        causalChain: hypothesis.causal_chain || [],
        decisionState: hypothesis.decision_state,
        confidence: hypothesis.confidence,
      } : null,
      challenger: challenger ? {
        verdict: challenger.verdict,
        weakestLink: challenger.weakest_link,
        strongestCountercase: challenger.strongest_countercase,
        pricingConfirmation: challenger.pricing_confirmation,
        crossAssetConfirmation: challenger.cross_asset_confirmation,
        timingRisk: challenger.timing_risk,
        nextResolvingEvidence: challenger.next_resolving_evidence,
      } : null,
      scenarios: [...newestScenarioByAsset.values()].map((scenario) => ({
        asset: scenario.asset,
        bias: scenario.bias,
        conviction: scenario.conviction,
        baseCase: scenario.base_case,
        bullCase: scenario.bull_case,
        bearCase: scenario.bear_case,
        tailCase: scenario.tail_case,
        confirmation: scenario.confirmation,
        invalidation: scenario.invalidation,
      })),
      room: room ? {
        id: room.id,
        title: room.title,
        status: room.room_status,
        synthesis: room.synthesis,
        unresolvedQuestions: room.unresolved_questions || [],
      } : null,
      evidence: (items || []).flatMap((item) => {
        const evidence = evidenceById.get(item.evidence_id);
        return evidence ? [{
          id: evidence.id,
          role: item.evidence_role,
          claim: evidence.claim_text,
          summary: evidence.summary,
          direction: evidence.support_direction,
          confidence: evidence.confidence,
          eventAt: evidence.event_at,
          provenanceUrls: evidence.provenance_urls || [],
        }] : [];
      }),
      entities: (entities || []).map((entity) => ({ id: entity.id, name: entity.canonical_name, type: entity.entity_type, canonicalKey: entity.canonical_key })),
      relationships: (relationships || []).map((relationship) => ({ id: relationship.id, fromEntityId: relationship.from_entity_id, relationship: relationship.relationship_type, toEntityId: relationship.to_entity_id, confidence: relationship.confidence, evidenceSummary: relationship.evidence_summary })),
      unavailableReason: null,
    };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}
