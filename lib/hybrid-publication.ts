import type { Story, Update, ResearchRunStatus } from "@/lib/data";
import { buildDeskMemory, type HistoricalToneVersion } from "@/lib/desk-memory";
import { getStableStoryFallbackImage } from "@/lib/story-fallback-images";
import type { StoryHeaderImage } from "@/lib/story-images";
import type { StoryMonitorPack } from "@/lib/story-monitors";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function optionalQuery<T>(table: string, params = ""): Promise<T[]> {
  if (!url || !key) return [];
  try {
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

type PublicationSnapshot = {
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
  event_at: string;
  recorded_at: string;
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

export async function getHybridPublicationRecords() {
  const toneCutoff = encodeURIComponent(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  const [snapshots, thesisVersions, events, causalEdges, assetImpacts, toneVersions] = await Promise.all([
    optionalQuery<PublicationSnapshot>("hybrid_publication_snapshots", "select=*&order=published_at.desc&limit=120"),
    optionalQuery<ThesisVersion>("story_thesis_versions", "select=*&order=effective_at.desc,version_number.desc&limit=240"),
    optionalQuery<StoryEvent>("story_events", "select=*&order=event_at.desc&limit=240"),
    optionalQuery<CausalEdge>("current_causal_edges", "select=*&order=effective_at.desc&limit=240"),
    optionalQuery<AssetImpact>("current_asset_impacts", "select=*&order=as_of.desc&limit=240"),
    optionalQuery<HistoricalToneVersion>(
      "story_thesis_versions",
      `select=story_id,version_number,title,thesis,best_explanation,strongest_contradiction,confidence,status,effective_at&effective_at=gte.${toneCutoff}&order=effective_at.desc&limit=2500`,
    ),
  ]);
  return { snapshots, thesisVersions, events, causalEdges, assetImpacts, toneVersions };
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

function storyState(story: Story, version: ThesisVersion | undefined, image: StoryHeaderImage | undefined) {
  const fallback = getStableStoryFallbackImage(story.id);
  return {
    id: story.id,
    slug: story.slug,
    title: version?.title || story.title,
    marketQuestion: version?.market_question ?? story.market_question,
    thesis: version?.thesis || story.thesis,
    confidence: version?.confidence ?? story.confidence,
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
    thesisVersion: version ? {
      id: version.id,
      version: version.version_number,
      effectiveAt: version.effective_at,
      changeReason: version.change_reason,
    } : null,
  };
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

export function buildHybridPublicationContract({
  stories,
  updates,
  researchRuns,
  marketState,
  records,
  storyImages,
  storyMonitors,
  generatedAt,
}: {
  stories: Story[];
  updates: Update[];
  researchRuns: ResearchRunStatus[];
  marketState: Array<Record<string, unknown>>;
  records: Awaited<ReturnType<typeof getHybridPublicationRecords>>;
  storyImages?: Map<string, StoryHeaderImage>;
  storyMonitors?: StoryMonitorPack[];
  generatedAt: string;
}) {
  const versionByStory = newestThesisByStory(records.thesisVersions);
  const storyStates = stories.map((story) => storyState(story, versionByStory.get(story.id), storyImages?.get(story.id)));
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
  const dailyBrief = records.snapshots.find((snapshot) => snapshot.snapshot_type === "daily_brief") || null;
  const lead = [...storyStates].sort((a, b) => {
    const storyA = stories.find((story) => story.id === a.id);
    const storyB = stories.find((story) => story.id === b.id);
    const rankA = storyA?.rank ?? 999;
    const rankB = storyB?.rank ?? 999;
    return rankA - rankB || b.confidence - a.confidence;
  })[0] || null;

  const edition = {
    id: dailyBrief?.id || `compat-${latestRun?.id || generatedAt}`,
    snapshotId: dailyBrief?.id || null,
    researchRunId: dailyBrief?.research_run_id || latestRun?.id || null,
    generatedAt: dailyBrief?.published_at || generatedAt,
    approvedAt: dailyBrief?.published_at || latestRun?.completed_at || null,
    immutable: Boolean(dailyBrief),
    mode: dailyBrief ? "approved_snapshot" : "compatibility",
    summary: dailyBrief?.public_summary || null,
    payload: dailyBrief?.payload || {},
    leadStoryId: lead?.id || null,
    leadStorySlug: lead?.slug || null,
    materialChangeCount: materialDeltas.length,
  };

  return {
    contractVersion: 2,
    edition,
    materialDeltas,
    deskMemory: buildDeskMemory(records.toneVersions, generatedAt),
    canonical: {
      storyStates,
      thesisVersions: records.thesisVersions,
      storyEvents: records.events,
      causalEdges: records.causalEdges,
      assetImpacts: records.assetImpacts,
      marketState,
      storyMonitors: storyMonitors || [],
    },
    publication: {
      snapshotCount: records.snapshots.length,
      latestSnapshots: records.snapshots.slice(0, 30),
      persistenceAvailable: records.snapshots.length > 0 || records.thesisVersions.length > 0 || records.events.length > 0 || records.causalEdges.length > 0 || records.assetImpacts.length > 0,
      compatibilityMode: !(records.snapshots.length > 0 || records.thesisVersions.length > 0 || records.events.length > 0),
    },
  };
}
