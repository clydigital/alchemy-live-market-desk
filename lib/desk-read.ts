export type DeskReadStory = {
  id: string;
  slug?: string | null;
  title?: string | null;
  marketQuestion?: string | null;
  thesis?: string | null;
  confidence?: number | null;
  rank?: number | null;
  featuredRank?: number | null;
  status?: string | null;
  bestExplanation?: string | null;
  strongestSupport?: string | null;
  strongestContradiction?: string | null;
  confirmationCondition?: string | null;
  invalidationCondition?: string | null;
  nextCatalyst?: string | null;
  recencyAt?: string | null;
  intelligence?: {
    lifecycleStatus?: string | null;
    qualificationScore?: number | null;
    causalMechanism?: string | null;
    affectedAssets?: string[] | null;
    confirmationCriteria?: string[] | null;
    invalidationCriteria?: string[] | null;
    nextCatalysts?: string[] | null;
    researchSynthesis?: string | null;
    marketBelief?: string | null;
    divergence?: string | null;
    conviction?: number | null;
    strongestSupport?: string | null;
    strongestContradiction?: string | null;
    lastEvidenceAt?: string | null;
    lastEvaluatedAt?: string | null;
  } | null;
};

export type DeskReadDelta = {
  id?: string | null;
  storyId?: string | null;
  storySlug?: string | null;
  type?: string | null;
  headline?: string | null;
  detail?: string | null;
  eventAt?: string | null;
  impact?: string | null;
  confidenceDelta?: number | null;
  materiality?: string | null;
  canonical?: boolean | null;
};

export type DeskReadCausalEdge = {
  id?: string | null;
  story_id?: string | null;
  from_node?: string | null;
  relationship?: string | null;
  to_node?: string | null;
  direction?: string | null;
  evidence_state?: string | null;
  confidence?: number | null;
  time_horizon?: string | null;
  expected_lag?: string | null;
  mechanism?: string | null;
  confirmation_condition?: string | null;
  invalidation_condition?: string | null;
  effective_at?: string | null;
};

export type DeskReadAssetImpact = {
  id?: string | null;
  story_id?: string | null;
  causal_edge_id?: string | null;
  asset_key?: string | null;
  asset_class?: string | null;
  direction?: string | null;
  time_horizon?: string | null;
  mechanism?: string | null;
  confidence?: number | null;
  evidence_state?: string | null;
  confirmation_condition?: string | null;
  invalidation_condition?: string | null;
  as_of?: string | null;
  expires_at?: string | null;
};

type DeskMemory = {
  toneShift?: {
    detected?: boolean;
    severity?: string;
    shifts?: Array<{
      key?: string;
      label?: string;
      currentTone?: string;
      baselineTone?: string;
      direction?: string;
      summary?: string;
      delta?: number;
    }>;
  } | null;
} | null;

const HOUR = 60 * 60 * 1000;

function stamp(value: string | null | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function unique(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  });
}

function storyRecency(story: DeskReadStory) {
  return stamp(story.intelligence?.lastEvidenceAt)
    ?? stamp(story.recencyAt)
    ?? stamp(story.intelligence?.lastEvaluatedAt)
    ?? 0;
}

function storyScore(
  story: DeskReadStory,
  now: number,
  context: { edgeCount?: number; impactAssetCount?: number } = {},
) {
  const confidence = clamp(Number(story.confidence ?? story.intelligence?.conviction ?? 0));
  const qualification = clamp(Number(story.intelligence?.qualificationScore ?? confidence));
  const featuredBoost = story.featuredRank != null ? Math.max(0, 24 - (Number(story.featuredRank) - 1) * 5) : 0;
  const rankBoost = story.rank != null ? Math.max(0, 12 - (Number(story.rank) - 1) * 2) : 0;
  const ageHours = storyRecency(story) ? Math.max(0, (now - storyRecency(story)) / HOUR) : 120;
  const recencyBoost = ageHours <= 12 ? 18 : ageHours <= 36 ? 11 : ageHours <= 72 ? 5 : 0;
  const lifecycle = String(story.intelligence?.lifecycleStatus || story.status || "").toLowerCase();
  const lifecycleBoost = lifecycle.includes("confirm") ? 8 : lifecycle.includes("develop") ? 5 : lifecycle.includes("weaken") ? -8 : lifecycle.includes("invalid") || lifecycle.includes("archive") ? -30 : 0;
  const statedAssetBreadth = new Set((story.intelligence?.affectedAssets || []).map((asset) => String(asset || "").trim()).filter(Boolean)).size;
  const breadth = Math.max(statedAssetBreadth, Number(context.impactAssetCount || 0));
  const breadthBoost = breadth >= 4 ? 32 : breadth >= 2 ? 20 : breadth === 1 ? -10 : -4;
  const causalBoost = Math.min(18, Math.max(0, Number(context.edgeCount || 0)) * 6);
  const impactBoost = Math.min(12, Math.max(0, Number(context.impactAssetCount || 0)) * 3);
  return confidence * 0.42 + qualification * 0.32 + featuredBoost + rankBoost + recencyBoost + lifecycleBoost + breadthBoost + causalBoost + impactBoost;
}

function explanationFor(story: DeskReadStory | null) {
  if (!story) return null;
  return story.intelligence?.causalMechanism
    || story.bestExplanation
    || story.intelligence?.marketBelief
    || null;
}

function summaryFor(story: DeskReadStory | null) {
  if (!story) return null;
  return story.intelligence?.marketBelief
    || story.intelligence?.researchSynthesis
    || story.bestExplanation
    || story.thesis
    || null;
}

function driver(story: DeskReadStory) {
  return {
    storyId: story.id,
    storySlug: story.slug || null,
    title: story.marketQuestion || story.title || "Canonical Story",
    thesis: story.thesis || null,
    mechanism: explanationFor(story),
    confidence: clamp(Number(story.confidence ?? story.intelligence?.conviction ?? 0)),
    lifecycle: story.intelligence?.lifecycleStatus || story.status || null,
    affectedAssets: story.intelligence?.affectedAssets || [],
    recencyAt: story.intelligence?.lastEvidenceAt || story.recencyAt || story.intelligence?.lastEvaluatedAt || null,
  };
}

function edgeStateWeight(value: string | null | undefined) {
  const state = String(value || "").toLowerCase();
  if (/confirm|support|verified|observed/.test(state)) return 2;
  if (/contrad|disput|reject|invalid/.test(state)) return -1;
  return 0;
}

function explanationConfidence(story: DeskReadStory | null, edges: DeskReadCausalEdge[]) {
  if (!story || !explanationFor(story)) return { label: "low" as const, score: 20 };
  const base = clamp(Number(story.confidence ?? story.intelligence?.conviction ?? 50));
  const relevant = edges.filter((edge) => edge.story_id === story.id);
  const graphConfidence = relevant.length
    ? relevant.reduce((sum, edge) => sum + clamp(Number(edge.confidence ?? 50)), 0) / relevant.length
    : 0;
  const stateAdjustment = relevant.reduce((sum, edge) => sum + edgeStateWeight(edge.evidence_state) * 4, 0);
  const contradictionPenalty = story.intelligence?.strongestContradiction || story.strongestContradiction ? 5 : 0;
  const score = clamp(base * 0.62 + graphConfidence * 0.28 + Math.min(10, relevant.length * 2) + stateAdjustment - contradictionPenalty);
  return {
    label: score >= 75 ? "high" as const : score >= 52 ? "medium" as const : "low" as const,
    score: Math.round(score),
  };
}

function regimeFromMemory(memory: DeskMemory) {
  const shifts = Array.isArray(memory?.toneShift?.shifts) ? memory!.toneShift!.shifts! : [];
  const lead = shifts[0];
  if (!memory?.toneShift?.detected || !lead) {
    return {
      label: "NO BROAD TONE SHIFT",
      explanation: "The stored Desk memory does not currently show a material broad-regime change.",
      severity: "none",
    };
  }
  return {
    label: `${String(lead.label || lead.key || "REGIME").toUpperCase()} · ${String(lead.currentTone || "SHIFTING").toUpperCase()}`,
    explanation: lead.summary || null,
    severity: memory.toneShift?.severity || "meaningful",
  };
}

function materialChanges(deltas: DeskReadDelta[], historical: boolean) {
  if (historical) return [];
  return deltas
    .filter((item) => item.canonical !== false)
    .sort((a, b) => (stamp(b.eventAt) || 0) - (stamp(a.eventAt) || 0))
    .slice(0, 6)
    .map((item) => ({
      id: item.id || null,
      storyId: item.storyId || null,
      storySlug: item.storySlug || null,
      type: item.type || "story_update",
      headline: item.headline || "Canonical Story update",
      detail: item.detail || null,
      eventAt: item.eventAt || null,
      impact: item.impact || null,
      confidenceDelta: item.confidenceDelta ?? null,
      materiality: item.materiality || "standard",
    }));
}

export function buildDeskRead({
  stories,
  materialDeltas = [],
  causalEdges = [],
  assetImpacts = [],
  deskMemory = null,
  generatedAt,
  historical = false,
}: {
  stories: DeskReadStory[];
  materialDeltas?: DeskReadDelta[];
  causalEdges?: DeskReadCausalEdge[];
  assetImpacts?: DeskReadAssetImpact[];
  deskMemory?: DeskMemory;
  generatedAt: string;
  historical?: boolean;
}) {
  const now = stamp(generatedAt) || Date.now();
  const edgeCountByStory = new Map<string, number>();
  for (const edge of causalEdges) {
    if (!edge.story_id) continue;
    edgeCountByStory.set(edge.story_id, (edgeCountByStory.get(edge.story_id) || 0) + 1);
  }
  const impactAssetsByStory = new Map<string, Set<string>>();
  for (const impact of assetImpacts) {
    if (!impact.story_id || !impact.asset_key) continue;
    const assets = impactAssetsByStory.get(impact.story_id) || new Set<string>();
    assets.add(String(impact.asset_key));
    impactAssetsByStory.set(impact.story_id, assets);
  }
  const ranked = [...(stories || [])]
    .filter((story) => story?.id && !/invalid|archive/i.test(String(story.intelligence?.lifecycleStatus || story.status || "")))
    .sort((a, b) => storyScore(b, now, {
      edgeCount: edgeCountByStory.get(b.id) || 0,
      impactAssetCount: impactAssetsByStory.get(b.id)?.size || 0,
    }) - storyScore(a, now, {
      edgeCount: edgeCountByStory.get(a.id) || 0,
      impactAssetCount: impactAssetsByStory.get(a.id)?.size || 0,
    }));
  const dominant = ranked[0] || null;
  const secondaries = ranked.slice(1, 4);
  const relevantStoryIds = new Set([dominant?.id, ...secondaries.map((story) => story.id)].filter(Boolean));
  const dominantEdges = dominant
    ? causalEdges.filter((edge) => edge.story_id === dominant.id)
      .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0))
    : [];
  const confidence = explanationConfidence(dominant, causalEdges);
  const mechanism = explanationFor(dominant);
  const changes = materialChanges(materialDeltas, historical);
  const basis = dominantEdges.length
    ? "canonical_causal_graph"
    : mechanism
      ? "canonical_story_thesis"
      : "insufficient_canonical_evidence";
  const hasCanonicalSupport = Boolean(
    dominantEdges.length
      || dominant?.intelligence?.strongestSupport
      || dominant?.strongestSupport
      || (dominant && assetImpacts.some((impact) => impact.story_id === dominant.id)),
  );
  const unsupportedThesis = basis === "canonical_story_thesis" && !hasCanonicalSupport;
  const unresolved = !dominant || !mechanism || confidence.label === "low" || unsupportedThesis;
  const status = !dominant || !mechanism ? "unresolved" : unresolved ? "partial" : "explained";

  const supportingEvidence = unique([
    dominant?.intelligence?.strongestSupport,
    dominant?.strongestSupport,
    ...dominantEdges.filter((edge) => edgeStateWeight(edge.evidence_state) > 0).map((edge) => edge.mechanism),
  ]).slice(0, 5);
  const contradictoryEvidence = unique([
    dominant?.intelligence?.strongestContradiction,
    dominant?.strongestContradiction,
    dominant?.intelligence?.divergence,
    ...dominantEdges.filter((edge) => edgeStateWeight(edge.evidence_state) < 0).map((edge) => edge.mechanism),
  ]).slice(0, 5);
  const confirmationConditions = unique([
    ...(dominant?.intelligence?.confirmationCriteria || []),
    dominant?.confirmationCondition,
    ...dominantEdges.map((edge) => edge.confirmation_condition),
  ]).slice(0, 6);
  const invalidationConditions = unique([
    ...(dominant?.intelligence?.invalidationCriteria || []),
    dominant?.invalidationCondition,
    ...dominantEdges.map((edge) => edge.invalidation_condition),
  ]).slice(0, 6);
  const nextCatalysts = unique([
    ...(dominant?.intelligence?.nextCatalysts || []),
    dominant?.nextCatalyst,
  ]).slice(0, 5);

  const impacts = assetImpacts
    .filter((impact) => impact.story_id && relevantStoryIds.has(impact.story_id))
    .filter((impact) => !impact.expires_at || (stamp(impact.expires_at) || 0) >= now)
    .sort((a, b) => {
      const dominantBoostA = a.story_id === dominant?.id ? 100 : 0;
      const dominantBoostB = b.story_id === dominant?.id ? 100 : 0;
      return dominantBoostB + Number(b.confidence ?? 0) - (dominantBoostA + Number(a.confidence ?? 0));
    });
  const seenAssets = new Set<string>();
  const assetImplications = impacts.flatMap((impact) => {
    const asset = String(impact.asset_key || "").trim();
    if (!asset || seenAssets.has(asset)) return [];
    seenAssets.add(asset);
    return [{
      asset,
      assetClass: impact.asset_class || null,
      direction: impact.direction || "mixed",
      timeHorizon: impact.time_horizon || null,
      mechanism: impact.mechanism || null,
      confidence: clamp(Number(impact.confidence ?? 0)),
      evidenceState: impact.evidence_state || null,
      confirmationCondition: impact.confirmation_condition || null,
      invalidationCondition: impact.invalidation_condition || null,
      storyId: impact.story_id || null,
      asOf: impact.as_of || null,
    }];
  }).slice(0, 10);

  const causalChain = dominantEdges.slice(0, 7).map((edge) => ({
    id: edge.id || null,
    from: edge.from_node || null,
    relationship: edge.relationship || null,
    to: edge.to_node || null,
    direction: edge.direction || null,
    evidenceState: edge.evidence_state || null,
    confidence: clamp(Number(edge.confidence ?? 0)),
    timeHorizon: edge.time_horizon || null,
    expectedLag: edge.expected_lag || null,
    mechanism: edge.mechanism || null,
  }));

  return {
    version: 1,
    generatedAt,
    historical,
    status,
    explanationBasis: basis,
    explanationConfidence: confidence,
    noConvincingExplanation: unresolved,
    headline: dominant?.marketQuestion || dominant?.title || (historical ? "Historical Desk Read unavailable" : "Desk explanation unresolved"),
    summary: summaryFor(dominant) || "The canonical Live Desk has not published a sufficiently supported market explanation yet.",
    mechanism,
    dominantDriver: dominant ? driver(dominant) : null,
    secondaryDrivers: secondaries.map(driver),
    regime: regimeFromMemory(deskMemory),
    observedChanges: changes,
    materialChangeSincePrevious: changes[0] || null,
    causalChain,
    supportingEvidence,
    contradictoryEvidence,
    crossAssetChecks: assetImplications.slice(0, 6),
    assetImplications,
    confirmationConditions,
    invalidationConditions,
    nextCatalysts,
    memoryShifts: Array.isArray(deskMemory?.toneShift?.shifts) ? deskMemory!.toneShift!.shifts!.slice(0, 5) : [],
  };
}
