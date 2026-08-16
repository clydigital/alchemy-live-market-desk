import type { Story, Update, ResearchRunStatus } from "@/lib/data";
import { buildDeskMemory, type HistoricalToneVersion } from "@/lib/desk-memory";
import {
  MAX_FEATURED_STORIES,
  MAX_PUBLISHED_STORIES,
  type StoryCandidate,
  type StoryLifecycleStatus,
} from "@/lib/intelligence/contracts";
import { canonicalStoryEventSignature, selectFeaturedStories, selectQualifiedStories } from "@/lib/intelligence/deduplication";
import { getStableStoryFallbackImage } from "@/lib/story-fallback-images";
import type { StoryHeaderImage } from "@/lib/story-images";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildCanonicalEditionResponseContract,
  type EditionSnapshot,
} from "@/lib/edition-replay";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type PublicationQueryOptions = {
  fresh?: boolean;
  editionId?: string | null;
};

const EDITION_ARCHIVE_PAGE_SIZE = 250;
const LEGACY_STORY_RUN_BATCH_SIZE = 100;
const LEGACY_STORY_PAGE_SIZE = 250;

async function optionalQuery<T>(table: string, params = "", options: PublicationQueryOptions = {}): Promise<T[]> {
  if (!url || !key) return [];
  try {
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      ...(options.fresh ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

/** Daily briefs are the canonical edition archive, never the mixed 480-row operational window. */
async function getDailyBriefArchive(options: PublicationQueryOptions = {}) {
  const archive: PublicationSnapshot[] = [];
  for (let offset = 0; ; offset += EDITION_ARCHIVE_PAGE_SIZE) {
    const page = await optionalQuery<PublicationSnapshot>(
      "hybrid_publication_snapshots",
      `select=*&snapshot_type=eq.daily_brief&order=published_at.desc,id.desc&limit=${EDITION_ARCHIVE_PAGE_SIZE}&offset=${offset}`,
      options,
    );
    archive.push(...page);
    if (page.length < EDITION_ARCHIVE_PAGE_SIZE) return archive;
  }
}

async function optionalIntelligenceStates(): Promise<IntelligenceStoryState[]> {
  try {
    const client = createSupabaseAdminClient();
    const { data, error } = await client
      .from("intelligence_story_states")
      .select("*")
      .limit(240)
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) return [];
    return (data || []) as IntelligenceStoryState[];
  } catch {
    return [];
  }
}

export type PublicationSnapshot = EditionSnapshot & {
  id: string;
  research_run_id: string | null;
  slot_run_id: string | null;
  story_id: string | null;
  story_thesis_version_id: string | null;
  supersedes_snapshot_id: string | null;
  snapshot_type: "story" | "fiscal_supply" | "market_state" | "article_review" | "daily_brief";
  public_summary: string;
  payload: Record<string, unknown>;
  source_record_refs: Record<string, unknown>[];
  confidence: number;
  published_at: string;
  expires_at: string | null;
};

function legacyStoryVerificationRunIds(dailyBriefArchive: PublicationSnapshot[]) {
  return [...new Set(dailyBriefArchive.flatMap((snapshot) => {
    const canonicalStoryIds = snapshot.payload.canonicalStoryIds;
    const hasManifest = Array.isArray(snapshot.payload.canonicalStoryManifest)
      || Array.isArray(snapshot.payload.storyManifest);
    return !hasManifest
      && Array.isArray(canonicalStoryIds)
      && canonicalStoryIds.length > 0
      && canonicalStoryIds.every((storyId) => typeof storyId === "string")
      && snapshot.research_run_id
      ? [snapshot.research_run_id]
      : [];
  }))].sort();
}

/**
 * Legacy briefs prove replayability only through same-run immutable Story rows.
 * Query all candidate runs in deterministic batches so picker construction does
 * not depend on selecting an edition first.
 */
async function getLegacyStoryVerificationSnapshots(
  researchRunIds: string[],
  options: PublicationQueryOptions = {},
) {
  const snapshots: PublicationSnapshot[] = [];
  for (let start = 0; start < researchRunIds.length; start += LEGACY_STORY_RUN_BATCH_SIZE) {
    const runIds = researchRunIds.slice(start, start + LEGACY_STORY_RUN_BATCH_SIZE);
    const runFilter = runIds.map(encodeURIComponent).join(",");
    for (let offset = 0; ; offset += LEGACY_STORY_PAGE_SIZE) {
      const page = await optionalQuery<PublicationSnapshot>(
        "hybrid_publication_snapshots",
        `select=*&snapshot_type=eq.story&research_run_id=in.(${runFilter})&order=research_run_id.asc,published_at.asc,id.asc&limit=${LEGACY_STORY_PAGE_SIZE}&offset=${offset}`,
        options,
      );
      snapshots.push(...page);
      if (page.length < LEGACY_STORY_PAGE_SIZE) break;
    }
  }
  return snapshots;
}

type ThesisVersion = {
  id: string;
  story_id: string;
  event_id?: string | null;
  version_number: number;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  market_question: string | null;
  dominant_narrative: string | null;
  best_explanation: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  priced_assessment: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  assets: string[];
  change_reason: string;
  effective_at: string;
};

type StoryEvent = {
  id: string;
  story_id: string;
  event_type: string;
  headline: string;
  detail: string | null;
  impact: string | null;
  confidence_delta: number | null;
  evidence_id?: string | null;
  source_id?: string | null;
  event_at: string;
  recorded_at: string;
};

type IntelligenceStoryState = {
  story_id: string;
  lifecycle_status: StoryLifecycleStatus;
  publication_eligible: boolean;
  qualification_score: number;
  event_signature: string;
  thesis_signature: string;
  causal_mechanism: string;
  affected_assets: string[];
  decisive_evidence_ids: string[];
  source_ancestry_group_ids: string[];
  confirmation_criteria: string[];
  invalidation_criteria: string[];
  next_catalysts: string[];
  novelty_class: string | null;
  research_synthesis: string | null;
  market_belief: string | null;
  divergence_summary: string | null;
  bias: StoryCandidate["bias"] | null;
  conviction: number | null;
  base_case: string | null;
  bull_case: string | null;
  bear_case: string | null;
  tail_case: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  last_evidence_at: string | null;
  last_evaluated_at: string | null;
};

type CausalEdge = {
  id: string;
  story_id: string | null;
  from_node: string;
  relationship: string;
  to_node: string;
  direction: string;
  evidence_state: string;
  confidence: number;
  time_horizon: string | null;
  expected_lag: string | null;
  mechanism: string;
  confirmation_condition: string | null;
  invalidation_condition: string | null;
  effective_at: string;
};

type AssetImpact = {
  id: string;
  story_id: string | null;
  causal_edge_id: string | null;
  asset_key: string;
  asset_class: string | null;
  direction: string;
  time_horizon: string;
  mechanism: string;
  confidence: number;
  evidence_state: string;
  confirmation_condition: string | null;
  invalidation_condition: string | null;
  as_of: string;
  expires_at: string | null;
};

export async function getHybridPublicationRecords(options: PublicationQueryOptions = {}) {
  const toneCutoff = encodeURIComponent(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  const [snapshots, dailyBriefArchive, thesisVersions, events, causalEdges, assetImpacts, toneVersions, intelligenceStates] = await Promise.all([
    optionalQuery<PublicationSnapshot>("hybrid_publication_snapshots", "select=*&order=published_at.desc&limit=480", options),
    getDailyBriefArchive(options),
    optionalQuery<ThesisVersion>("story_thesis_versions", "select=*&order=effective_at.desc,version_number.desc&limit=240", options),
    optionalQuery<StoryEvent>("story_events", "select=*&order=event_at.desc&limit=240", options),
    optionalQuery<CausalEdge>("current_causal_edges", "select=*&order=effective_at.desc&limit=240", options),
    optionalQuery<AssetImpact>("current_asset_impacts", "select=*&order=as_of.desc&limit=240", options),
    optionalQuery<HistoricalToneVersion>(
      "story_thesis_versions",
      `select=story_id,version_number,title,thesis,best_explanation,strongest_contradiction,confidence,status,effective_at&effective_at=gte.${toneCutoff}&order=effective_at.desc&limit=2500`,
      options,
    ),
    optionalIntelligenceStates(),
  ]);
  const requested = options.editionId
    ? dailyBriefArchive.find((snapshot) => snapshot.id === options.editionId) || null
    : null;
  const legacyRunIds = legacyStoryVerificationRunIds(dailyBriefArchive);
  // The requested row is normally already a candidate. Keep this explicit so
  // direct legacy requests receive the same proof path after archive changes.
  const requestedLegacyRunId = requested && legacyStoryVerificationRunIds([requested])[0];
  const verificationRunIds = [...new Set([
    ...legacyRunIds,
    ...(requestedLegacyRunId ? [requestedLegacyRunId] : []),
  ])].sort();
  const legacyStorySnapshots = await getLegacyStoryVerificationSnapshots(verificationRunIds, options);
  const editionSnapshots = [...dailyBriefArchive, ...legacyStorySnapshots]
    .filter((snapshot, index, list) => list.findIndex((candidate) => candidate.id === snapshot.id) === index);
  return { snapshots, dailyBriefArchive, editionSnapshots, thesisVersions, events, causalEdges, assetImpacts, toneVersions, intelligenceStates };
}

function newestThesisByStory(versions: ThesisVersion[]) {
  const result = new Map<string, ThesisVersion>();
  for (const version of versions) {
    const current = result.get(version.story_id);
    if (!current || version.version_number > current.version_number || (version.version_number === current.version_number && version.effective_at > current.effective_at)) {
      result.set(version.story_id, version);
    }
  }
  return result;
}

function storyState(story: Story, version: ThesisVersion | undefined, image: StoryHeaderImage | undefined, intelligence: IntelligenceStoryState | undefined) {
  const fallback = getStableStoryFallbackImage(story.id);
  return {
    id: story.id,
    slug: story.slug,
    title: version?.title || story.title,
    marketQuestion: version?.market_question ?? story.market_question,
    thesis: version?.thesis || story.thesis,
    confidence: version?.confidence ?? story.confidence,
    rank: story.rank,
    status: version?.status || story.status,
    assets: version?.assets?.length ? version.assets : story.assets,
    dominantNarrative: version?.dominant_narrative ?? story.dominant_narrative,
    bestExplanation: version?.best_explanation ?? story.best_explanation,
    strongestSupport: version?.strongest_support ?? story.strongest_support,
    strongestContradiction: version?.strongest_contradiction ?? story.strongest_contradiction,
    pricedAssessment: version?.priced_assessment ?? story.priced_assessment,
    confirmationCondition: version?.confirmation_trigger ?? story.confirmation_trigger,
    invalidationCondition: version?.invalidation_trigger ?? story.invalidation_trigger,
    nextCatalyst: version?.next_catalyst ?? story.next_catalyst,
    imageUrl: image?.imageUrl || fallback.dataUri,
    fallbackImageUrl: fallback.dataUri,
    imageKind: image?.kind || "fallback",
    imageSourceUrl: image?.articleUrl || null,
    imageSourceTitle: image?.articleTitle || fallback.label,
    imagePublisher: image?.publisher || "Alchemy Markets",
    intelligence: intelligence ? {
      lifecycleStatus: intelligence.lifecycle_status,
      publicationEligible: intelligence.publication_eligible,
      qualificationScore: intelligence.qualification_score,
      eventSignature: intelligence.event_signature,
      causalMechanism: intelligence.causal_mechanism,
      affectedAssets: intelligence.affected_assets,
      decisiveEvidenceIds: intelligence.decisive_evidence_ids,
      sourceAncestryGroupIds: intelligence.source_ancestry_group_ids,
      confirmationCriteria: intelligence.confirmation_criteria,
      invalidationCriteria: intelligence.invalidation_criteria,
      nextCatalysts: intelligence.next_catalysts,
      noveltyClass: intelligence.novelty_class,
      researchSynthesis: intelligence.research_synthesis,
      marketBelief: intelligence.market_belief,
      divergence: intelligence.divergence_summary,
      bias: intelligence.bias,
      conviction: intelligence.conviction,
      baseCase: intelligence.base_case,
      bullCase: intelligence.bull_case,
      bearCase: intelligence.bear_case,
      tailCase: intelligence.tail_case,
      strongestSupport: intelligence.strongest_support,
      strongestContradiction: intelligence.strongest_contradiction,
      lastEvidenceAt: intelligence.last_evidence_at,
      lastEvaluatedAt: intelligence.last_evaluated_at,
    } : null,
    thesisVersion: version ? {
      id: version.id,
      version: version.version_number,
      effectiveAt: version.effective_at,
      changeReason: version.change_reason,
    } : null,
  };
}

function lifecycleStatus(value: string): StoryLifecycleStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes("archive")) return "archived";
  if (normalized.includes("invalid")) return "invalidated";
  if (normalized.includes("weaken")) return "weakening";
  if (normalized.includes("confirm") || normalized.includes("publish")) return "confirmed";
  if (normalized.includes("develop") || normalized.includes("monitor")) return "developing";
  return "detected";
}

function publicationCandidate(
  state: ReturnType<typeof storyState>,
  events: StoryEvent[],
): StoryCandidate {
  const storyEvents = events.filter((event) => event.story_id === state.id);
  const intelligence = state.intelligence;
  const status = intelligence?.lifecycleStatus || lifecycleStatus(state.status);
  const eventSignature = intelligence?.eventSignature
    || canonicalStoryEventSignature({ title: state.title, thesis: state.thesis, causalMechanism: state.bestExplanation || state.thesis });
  const eventEvidenceIds = storyEvents
    .filter((event) => event.evidence_id)
    .map((event) => event.evidence_id as string);
  const recencyAt = [
    intelligence?.lastEvidenceAt,
    storyEvents[0]?.event_at,
    state.thesisVersion?.effectiveAt,
  ].filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null;
  return {
    id: state.id,
    slug: state.slug,
    title: state.title,
    thesis: state.thesis,
    eventSignature,
    causalMechanism: intelligence?.causalMechanism || state.bestExplanation || state.thesis,
    affectedAssets: intelligence?.affectedAssets?.length ? intelligence.affectedAssets : state.assets,
    decisiveEvidenceIds: intelligence?.decisiveEvidenceIds?.length ? intelligence.decisiveEvidenceIds : eventEvidenceIds,
    sourceAncestryGroupIds: intelligence?.sourceAncestryGroupIds || [],
    confirmationCriteria: intelligence?.confirmationCriteria?.length ? intelligence.confirmationCriteria : [state.confirmationCondition || ""].filter(Boolean),
    invalidationCriteria: intelligence?.invalidationCriteria?.length ? intelligence.invalidationCriteria : [state.invalidationCondition || ""].filter(Boolean),
    nextCatalysts: intelligence?.nextCatalysts?.length ? intelligence.nextCatalysts : [state.nextCatalyst || ""].filter(Boolean),
    confidence: state.confidence,
    lifecycleStatus: status,
    publicationEligible: intelligence?.publicationEligible ?? !["invalidated", "archived"].includes(status),
    qualificationScore: intelligence?.qualificationScore ?? state.confidence,
    researchSynthesis: intelligence?.researchSynthesis || null,
    marketBelief: intelligence?.marketBelief || null,
    divergence: intelligence?.divergence || undefined,
    bias: intelligence?.bias || undefined,
    conviction: intelligence?.conviction ?? null,
    baseCase: intelligence?.baseCase || undefined,
    bullCase: intelligence?.bullCase || undefined,
    bearCase: intelligence?.bearCase || undefined,
    tailCase: intelligence?.tailCase || null,
    strongestSupport: intelligence?.strongestSupport || state.strongestSupport || undefined,
    strongestContradiction: intelligence?.strongestContradiction || state.strongestContradiction || undefined,
    rank: state.rank,
    recencyAt,
  };
}

type LegacyStoryEvent = {
  story_id: string;
  headline: string;
  detail?: string | null;
  evidence_id?: string | null;
  event_at?: string | null;
};

function legacyPublicationCandidates(stories: Story[], events: LegacyStoryEvent[]) {
  return stories.map((story): StoryCandidate => {
    const storyEvents = events.filter((event) => event.story_id === story.id).slice(0, 4);
    const status = lifecycleStatus(story.article_verdict || story.status);
    return {
      id: story.id,
      slug: story.slug,
      title: story.title,
      thesis: story.thesis,
      eventSignature: canonicalStoryEventSignature({ title: story.title, thesis: story.thesis, causalMechanism: story.best_explanation || story.thesis }),
      causalMechanism: story.best_explanation || story.thesis,
      affectedAssets: story.assets || [],
      decisiveEvidenceIds: storyEvents.map((event) => event.evidence_id).filter((id): id is string => Boolean(id)),
      sourceAncestryGroupIds: [],
      confirmationCriteria: [story.confirmation_trigger || ""].filter(Boolean),
      invalidationCriteria: [story.invalidation_trigger || ""].filter(Boolean),
      nextCatalysts: [story.next_catalyst || ""].filter(Boolean),
      confidence: story.confidence,
      lifecycleStatus: status,
      publicationEligible: !["invalidated", "archived"].includes(status),
      qualificationScore: Math.max(0, Math.min(100, (story.confidence + story.source_quality + story.novelty + story.trader_relevance) / 4)),
      rank: story.rank,
      recencyAt: storyEvents.map((event) => event.event_at).filter((value): value is string => Boolean(value))[0] || null,
    };
  });
}

export function selectLegacyStoriesForPublication(
  stories: Story[],
  events: LegacyStoryEvent[] = [],
  maximum = MAX_PUBLISHED_STORIES,
) {
  const byId = new Map(stories.map((story) => [story.id, story]));
  return selectQualifiedStories(legacyPublicationCandidates(stories, events), maximum).selected
    .map((candidate) => byId.get(candidate.id || ""))
    .filter((story): story is Story => Boolean(story));
}

export function selectLegacyStoriesForLive(stories: Story[], events: LegacyStoryEvent[] = []) {
  const byId = new Map(stories.map((story) => [story.id, story]));
  const published = selectQualifiedStories(legacyPublicationCandidates(stories, events), MAX_PUBLISHED_STORIES).selected;
  return selectFeaturedStories(published, MAX_FEATURED_STORIES)
    .map((candidate) => byId.get(candidate.id || ""))
    .filter((story): story is Story => Boolean(story));
}

function legacyDelta(update: Update, story: Story | undefined) {
  return {
    id: update.id,
    storyId: update.story_id,
    storySlug: story?.slug || null,
    type: update.update_type || "headline_update",
    headline: update.headline,
    detail: update.detail,
    eventAt: update.observed_at || update.created_at,
    impact: null,
    confidenceDelta: null,
    materiality: "legacy_unscored",
    canonical: false,
  };
}

export function selectHybridPublicationStoryStates({
  stories,
  records,
  storyImages,
}: {
  stories: Story[];
  records: Awaited<ReturnType<typeof getHybridPublicationRecords>>;
  storyImages?: Map<string, StoryHeaderImage>;
}) {
  const versionByStory = newestThesisByStory(records.thesisVersions);
  const intelligenceByStory = new Map(records.intelligenceStates.map((state) => [state.story_id, state]));
  const allStoryStates = stories.map((story) => storyState(story, versionByStory.get(story.id), storyImages?.get(story.id), intelligenceByStory.get(story.id)));
  const selection = selectQualifiedStories(allStoryStates.map((state) => publicationCandidate(state, records.events)), MAX_PUBLISHED_STORIES);
  const featured = selectFeaturedStories(selection.selected, MAX_FEATURED_STORIES);
  const stateById = new Map(allStoryStates.map((state) => [state.id, state]));
  const featuredRankById = new Map(featured.map((candidate, index) => [candidate.id || "", index + 1]));
  const storyStates = selection.selected
    .map((candidate) => {
      const state = stateById.get(candidate.id || "");
      return state ? { ...state, featuredRank: featuredRankById.get(state.id) || null, recencyAt: candidate.recencyAt || null } : null;
    })
    .filter((state): state is NonNullable<typeof state> => Boolean(state));
  const featuredStoryStates = storyStates.filter((state) => state.featuredRank !== null);
  return { allStoryStates, selection, storyStates, featuredStoryStates };
}

export function buildHybridPublicationContract({
  stories,
  updates,
  researchRuns,
  marketState,
  records,
  storyImages,
  generatedAt,
  editionId = null,
}: {
  stories: Story[];
  updates: Update[];
  researchRuns: ResearchRunStatus[];
  marketState: Array<Record<string, unknown>>;
  records: Awaited<ReturnType<typeof getHybridPublicationRecords>>;
  storyImages?: Map<string, StoryHeaderImage>;
  generatedAt: string;
  editionId?: string | null;
}) {
  const { allStoryStates, selection, storyStates, featuredStoryStates } = selectHybridPublicationStoryStates({ stories, records, storyImages });
  const storyById = new Map(stories.map((story) => [story.id, story]));

  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  const canonicalDeltas = records.events
    .filter((event) => Date.parse(event.event_at) >= cutoff)
    .slice(0, 30)
    .map((event) => ({
      id: event.id,
      storyId: event.story_id,
      storySlug: storyById.get(event.story_id)?.slug || null,
      type: event.event_type,
      headline: event.headline,
      detail: event.detail,
      eventAt: event.event_at,
      impact: event.impact,
      confidenceDelta: event.confidence_delta,
      materiality: ["confirmation", "invalidation", "contradiction", "thesis_revision", "correction"].includes(event.event_type) ? "high" : "standard",
      canonical: true,
    }));

  const materialDeltas = canonicalDeltas.length
    ? canonicalDeltas
    : updates.filter((update) => Date.parse(update.observed_at || update.created_at) >= cutoff).slice(0, 30).map((update) => legacyDelta(update, storyById.get(update.story_id)));

  const latestRun = researchRuns.find((run) => run.status === "completed") || researchRuns[0] || null;
  const editionReplay = buildCanonicalEditionResponseContract({
    snapshots: records.editionSnapshots,
    researchRuns,
    editionId,
    currentStoryStates: storyStates,
    currentFeaturedStoryStates: featuredStoryStates,
  });
  const { selectedSnapshot, replay: historicalReplay, isHistoricalReplay, selection: editionSelection } = editionReplay;
  const editionIndex = editionReplay.publication.editionIndex;
  const selectedPublicationSnapshot = selectedSnapshot as PublicationSnapshot | null;
  const currentEdition = editionReplay.publication.currentEdition;
  const requestedEdition = editionSelection.status === "historical" ? editionSelection.selected : null;
  const dailyBrief = currentEdition
    ? records.editionSnapshots.find((snapshot) => snapshot.id === currentEdition.snapshotId) || null
    : null;
  const lead = featuredStoryStates[0] || null;
  const selectedEdition = editionReplay.publication.selectedEdition;

  const edition = {
    id: requestedEdition?.snapshotId || currentEdition?.snapshotId || `compat-${latestRun?.id || generatedAt}`,
    snapshotId: requestedEdition?.snapshotId || currentEdition?.snapshotId || null,
    researchRunId: requestedEdition?.researchRunId || currentEdition?.researchRunId || latestRun?.id || null,
    generatedAt: selectedSnapshot?.published_at || dailyBrief?.published_at || generatedAt,
    approvedAt: selectedSnapshot?.published_at || dailyBrief?.published_at || latestRun?.completed_at || null,
    immutable: Boolean(requestedEdition || currentEdition),
    mode: isHistoricalReplay ? "immutable_replay" : currentEdition ? "current_canonical" : "compatibility",
    summary: selectedPublicationSnapshot?.public_summary || dailyBrief?.public_summary || null,
    payload: dailyBrief?.payload || {},
    ...(selectedPublicationSnapshot ? { payload: selectedPublicationSnapshot.payload } : {}),
    leadStoryId: isHistoricalReplay ? historicalReplay?.featuredStoryStates[0]?.id || null : lead?.id || null,
    leadStorySlug: isHistoricalReplay ? historicalReplay?.featuredStoryStates[0]?.slug || null : lead?.slug || null,
    materialChangeCount: isHistoricalReplay ? 0 : materialDeltas.length,
    selected: {
      requestedSnapshotId: editionId,
      snapshotId: editionReplay.canonical.snapshotId,
      status: editionSelection.status,
      exactStoryReplay: Boolean(historicalReplay && !historicalReplay.limitation),
      limitation: editionReplay.diagnostic.limitation,
    },
    current: currentEdition,
  };

  return {
    contractVersion: 2,
    edition,
    materialDeltas: isHistoricalReplay ? [] : materialDeltas,
    deskMemory: buildDeskMemory(records.toneVersions, generatedAt),
    canonical: {
      snapshotId: editionReplay.canonical.snapshotId,
      storyStates: editionReplay.canonical.storyStates,
      featuredStoryStates: editionReplay.canonical.featuredStoryStates,
      storyArchive: isHistoricalReplay ? editionReplay.canonical.storyStates : allStoryStates,
      thesisVersions: isHistoricalReplay ? [] : records.thesisVersions,
      storyEvents: isHistoricalReplay ? [] : records.events,
      causalEdges: isHistoricalReplay ? [] : records.causalEdges,
      assetImpacts: isHistoricalReplay ? [] : records.assetImpacts,
      marketState: isHistoricalReplay ? [] : marketState,
    },
    publication: {
      currentEdition: editionReplay.publication.currentEdition,
      selectedEdition: editionReplay.publication.selectedEdition,
      snapshotCount: records.snapshots.length,
      storyQualification: {
        considered: allStoryStates.length,
        selected: storyStates.length,
        maximum: MAX_PUBLISHED_STORIES,
        featured: featuredStoryStates.length,
        featuredMaximum: MAX_FEATURED_STORIES,
        featuredPolicy: "recency_then_qualification",
        padded: false,
        excluded: selection.excluded.map(({ story, comparison }) => ({
          storyId: story.id,
          storySlug: story.slug,
          classification: comparison.classification,
          duplicateOfId: comparison.duplicateOfId,
          similarityScore: comparison.similarityScore,
          rationale: comparison.rationale,
          exceptionProof: comparison.exceptionProof,
        })),
      },
      latestSnapshots: records.snapshots.slice(0, 240),
      editionIndex,
      editionDiagnostics: editionReplay.diagnostic,
      persistenceAvailable: records.dailyBriefArchive.length > 0 || records.thesisVersions.length > 0 || records.events.length > 0 || records.causalEdges.length > 0 || records.assetImpacts.length > 0,
      compatibilityMode: !(records.dailyBriefArchive.length > 0 || records.thesisVersions.length > 0 || records.events.length > 0),
    },
  };
}
