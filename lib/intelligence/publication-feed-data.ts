import { buildStructuredEconomicMetrics } from "@/lib/economic-metrics";
import { buildCanonicalEditionIndex, type EditionSnapshot } from "@/lib/edition-replay";
import type {
  EarningsCall,
  GuidanceItem,
  MacroRelease,
  MacroReleaseMetric,
  MacroSeriesObservation,
  MarketSeriesObservation,
  MarketStateRecord,
  PublicStatement,
  ResearchIntakeQueueItem,
  ResearchRunStatus,
  ResearchSource,
  Story,
  Update,
} from "@/lib/data";
import type { HistoricalToneVersion } from "@/lib/desk-memory";
import type { PublicationSnapshot } from "@/lib/hybrid-publication";
import type { getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { withMacroReleaseLifecycle } from "@/lib/macro-release-lifecycle";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FEED_REVALIDATE = 60;
const EDITION_INDEX_PAGE_SIZE = 250;
const LEGACY_STORY_RUN_BATCH_SIZE = 100;
const LEGACY_STORY_PAGE_SIZE = 250;
const CASE_MONITOR_MACRO_SERIES = "nfp,cpi_core,cpi_all";
const CASE_MONITOR_MARKET_SERIES = "uso,us2y,uup,qqq,us10y,spy,usdjpy,tlt";

type QueryOptions = {
  fresh?: boolean;
};

type FeedPublicationOptions = QueryOptions & {
  editionId?: string | null;
};

function queryCache(options: QueryOptions) {
  return options.fresh ? { cache: "no-store" as const } : { next: { revalidate: FEED_REVALIDATE } };
}

async function query<T>(table: string, params = "", options: QueryOptions = {}): Promise<T[]> {
  if (!url || !key) return [];
  try {
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      ...queryCache(options),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

async function privateQuery<T>(table: string, params = "", options: QueryOptions = {}): Promise<T[]> {
  if (!url || !serviceKey) return [];
  try {
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      ...queryCache(options),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

/**
 * Reader-specific projection of persisted Live state.
 *
 * The canonical feed used to reuse the broad Live desk loader, which carries
 * operational/debug blobs that are useful inside Live but expensive and
 * unnecessary for Hybrid. Keep this projection deterministic and read-only:
 * it changes transport shape only, never Story ownership or reasoning.
 */
export async function getHybridFeedData(options: QueryOptions = {}) {
  const [
    stories,
    updates,
    sources,
    marketStateRecords,
    researchRuns,
    calls,
    guidance,
    macroReleaseRows,
    macroReleaseMetrics,
    researchIntake,
    monitorResearchIntake,
    statements,
    macroObservations,
    marketObservations,
    researchDebt,
    intelligenceRuns,
    intelligenceStages,
    acquisitionFailures,
  ] = await Promise.all([
    query<Story>("stories", "select=*&status=neq.archived&order=rank.asc.nullslast,updated_at.desc", options),
    query<Update>("story_updates", "select=*&order=created_at.desc&limit=40", options),
    query<ResearchSource>("sources", "select=*&order=observation_date.desc.nullslast,created_at.desc&limit=240", options),
    query<MarketStateRecord>("market_state_ledger", "select=*&order=sector.asc,sub_industry.asc&limit=120", options),
    privateQuery<ResearchRunStatus>("research_run_status", "select=*&order=scheduled_for.desc&limit=20", options),
    query<EarningsCall>("earnings_calls", "select=*&order=call_date.desc.nullslast&limit=24", options),
    query<GuidanceItem>("guidance_items", "select=*&order=published_at.desc.nullslast,updated_at.desc&limit=80", options),
    query<MacroRelease>("macro_releases", "select=*&order=release_date.asc&limit=160", options),
    query<MacroReleaseMetric>("macro_release_metrics", "select=*&order=release_id.asc,metric_key.asc&limit=320", options),
    privateQuery<ResearchIntakeQueueItem>(
      "research_intake_queue",
      "select=id,run_id,item_key,item_type,publisher,title,url,published_at,article_position,transcript_status,transcript_provider,video_review_status,transcript_word_count,transcript_language,transcript_retrieved_at,transcript_error_code,transcript_error_message,transcript_http_status,transcript_retryable,transcript_attempted_at,transcript_attempt_count,transcript_duration_seconds,transcript_segment_count,summary,affected_story_slugs,source_quality,relevance,novelty,materiality,candidate_score,recommended_action,status,stats_signal,news_signal,divergence_kind,divergence_note,review_reason,updated_at&item_type=eq.video&order=published_at.desc&limit=20",
      options,
    ),
    privateQuery<ResearchIntakeQueueItem>(
      "research_intake_queue",
      "select=id,item_type,publisher,title,url,published_at,transcript_status,summary,affected_story_slugs,candidate_score,status,stats_signal,news_signal,divergence_note&order=candidate_score.desc.nullslast,published_at.desc&limit=120",
      options,
    ),
    query<PublicStatement>(
      "public_statements",
      "select=id,speaker,statement_group,channel,statement_date,quote_excerpt,topic,market_interpretation,affected_assets,source_url,verification_status,follow_up&order=statement_date.desc&limit=30",
      options,
    ),
    query<MacroSeriesObservation>(
      "macro_series_observations",
      `select=id,series_key,series_id,series_name,agency,observation_date,value,mom_change,yoy_change,unit,frequency,source_url,is_preliminary,notes&series_key=in.(${CASE_MONITOR_MACRO_SERIES})&order=observation_date.desc&limit=500`,
      options,
    ),
    query<MarketSeriesObservation>(
      "market_series_observations",
      `select=id,series_key,symbol,series_name,provider,observation_date,close,currency,frequency,source_url&series_key=in.(${CASE_MONITOR_MARKET_SERIES})&order=observation_date.desc&limit=800`,
      options,
    ),
    privateQuery<Record<string, unknown>>(
      "research_debt",
      "select=debt_key,severity,status,reason,next_action,next_check_at,last_attempt_at,updated_at&status=eq.open&order=next_check_at.asc.nullslast&limit=120",
      options,
    ),
    privateQuery<Record<string, unknown>>(
      "intelligence_engine_runs",
      "select=id,research_run_id,run_key,trigger_kind,status,stories_considered,stories_published,warnings,failure_detail,started_at,completed_at&order=started_at.desc&limit=20",
      options,
    ),
    privateQuery<Record<string, unknown>>(
      "intelligence_stage_runs",
      "select=id,engine_run_id,stage_key,status,model_name,provider_request_id,failure_code,failure_detail,started_at,completed_at&order=started_at.desc&limit=80",
      options,
    ),
    privateQuery<Record<string, unknown>>(
      "intelligence_acquisition_failures",
      "select=id,provider_key,capability,request_key,failure_code,failure_detail,retryable,first_failed_at,last_failed_at,resolved_at,occurrence_count&resolved_at=is.null&order=last_failed_at.desc&limit=80",
      options,
    ),
  ]);

  const now = new Date();
  const macroReleases = macroReleaseRows.map((release) => withMacroReleaseLifecycle(release, now));
  const structuredMacroReleaseMetrics = buildStructuredEconomicMetrics(macroReleaseRows, macroReleaseMetrics);

  return {
    stories,
    updates,
    sources,
    marketStateRecords,
    researchRuns,
    calls,
    guidance,
    macroReleases,
    macroReleaseMetrics: structuredMacroReleaseMetrics,
    researchIntake,
    monitorResearchIntake,
    statements,
    macroObservations,
    marketObservations,
    researchDebt,
    intelligenceRuns,
    intelligenceStages,
    acquisitionFailures,
  };
}

type EditionIndexRow = {
  id: string;
  research_run_id: string | null;
  slot_run_id: string | null;
  supersedes_snapshot_id: string | null;
  snapshot_type: "daily_brief";
  published_at: string;
  schedule_slot: string | null;
  scheduled_for: string | null;
  run_key: string | null;
  manifest_story_id: string | null;
  canonical_story_ids: string[] | null;
};

type SlimPublicationSnapshot = {
  id: string;
  research_run_id: string | null;
  slot_run_id: string | null;
  story_id: string | null;
  story_thesis_version_id: string | null;
  supersedes_snapshot_id: string | null;
  snapshot_type: PublicationSnapshot["snapshot_type"];
  public_summary: string;
  confidence: number;
  published_at: string;
  expires_at: string | null;
};

async function getDailyBriefIndex(options: FeedPublicationOptions) {
  const archive: EditionIndexRow[] = [];
  for (let offset = 0; ; offset += EDITION_INDEX_PAGE_SIZE) {
    const page = await query<EditionIndexRow>(
      "hybrid_publication_snapshots",
      `select=id,research_run_id,slot_run_id,supersedes_snapshot_id,snapshot_type,published_at,schedule_slot:payload->>scheduleSlot,scheduled_for:payload->>scheduledFor,run_key:payload->>runKey,manifest_story_id:payload->canonicalStoryManifest->0->state->>id,canonical_story_ids:payload->canonicalStoryIds&snapshot_type=eq.daily_brief&order=published_at.desc,id.desc&limit=${EDITION_INDEX_PAGE_SIZE}&offset=${offset}`,
      options,
    );
    archive.push(...page);
    if (page.length < EDITION_INDEX_PAGE_SIZE) return archive;
  }
}

function indexSnapshot(row: EditionIndexRow): EditionSnapshot {
  return {
    id: row.id,
    research_run_id: row.research_run_id,
    supersedes_snapshot_id: row.supersedes_snapshot_id,
    snapshot_type: row.snapshot_type,
    published_at: row.published_at,
    payload: {
      scheduleSlot: row.schedule_slot,
      scheduledFor: row.scheduled_for,
      runKey: row.run_key,
      ...(row.canonical_story_ids?.length ? { canonicalStoryIds: row.canonical_story_ids } : {}),
    },
    // A lightweight positive hint is enough to keep an immutable manifest
    // edition in the picker. Exact replay is still validated from the full
    // requested snapshot before Hybrid receives historical Story state.
    replayable_hint: Boolean(row.manifest_story_id),
  };
}

async function getFullDailyBrief(snapshotId: string | null, options: FeedPublicationOptions) {
  if (!snapshotId) return null;
  const rows = await query<PublicationSnapshot>(
    "hybrid_publication_snapshots",
    `select=*&id=eq.${encodeURIComponent(snapshotId)}&snapshot_type=eq.daily_brief&limit=1`,
    options,
  );
  return rows[0] || null;
}

function legacyVerificationRunIds(rows: EditionIndexRow[]) {
  return [...new Set(rows.flatMap((row) => (
    !row.manifest_story_id && row.canonical_story_ids?.length && row.research_run_id
      ? [row.research_run_id]
      : []
  )))].sort();
}

async function getLegacyStoryVerificationSnapshots(researchRunIds: string[], options: FeedPublicationOptions) {
  const snapshots: PublicationSnapshot[] = [];
  for (let start = 0; start < researchRunIds.length; start += LEGACY_STORY_RUN_BATCH_SIZE) {
    const runIds = researchRunIds.slice(start, start + LEGACY_STORY_RUN_BATCH_SIZE);
    const runFilter = runIds.map(encodeURIComponent).join(",");
    for (let offset = 0; ; offset += LEGACY_STORY_PAGE_SIZE) {
      const page = await query<PublicationSnapshot>(
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

/**
 * Canonical publication read model for Hybrid.
 *
 * The archive index remains complete, but immutable edition payloads are loaded
 * only for the current edition and the explicitly requested historical edition.
 * This preserves exact replay while avoiding multi-megabyte archive scans on
 * every feed refresh.
 */
export async function getHybridPublicationFeedRecords(options: FeedPublicationOptions = {}) {
  const toneCutoff = encodeURIComponent(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  const [
    snapshots,
    dailyBriefIndex,
    thesisVersions,
    events,
    causalEdges,
    assetImpacts,
    toneVersions,
    intelligenceStates,
  ] = await Promise.all([
    query<SlimPublicationSnapshot>(
      "hybrid_publication_snapshots",
      "select=id,research_run_id,slot_run_id,story_id,story_thesis_version_id,supersedes_snapshot_id,snapshot_type,public_summary,confidence,published_at,expires_at&order=published_at.desc&limit=480",
      options,
    ),
    getDailyBriefIndex(options),
    query<Record<string, unknown>>(
      "story_thesis_versions",
      "select=*&order=effective_at.desc,version_number.desc&limit=240",
      options,
    ),
    query<Record<string, unknown>>(
      "story_events",
      "select=*&order=event_at.desc&limit=240",
      options,
    ),
    query<Record<string, unknown>>(
      "current_causal_edges",
      "select=*&order=effective_at.desc&limit=240",
      options,
    ),
    query<Record<string, unknown>>(
      "current_asset_impacts",
      "select=*&order=as_of.desc&limit=240",
      options,
    ),
    query<HistoricalToneVersion>(
      "story_thesis_versions",
      `select=story_id,version_number,title,thesis,best_explanation,strongest_contradiction,confidence,status,effective_at&effective_at=gte.${toneCutoff}&order=effective_at.desc&limit=2500`,
      options,
    ),
    privateQuery<Record<string, unknown>>(
      "intelligence_story_states",
      "select=story_id,lifecycle_status,publication_eligible,qualification_score,event_signature,thesis_signature,causal_mechanism,affected_assets,decisive_evidence_ids,source_ancestry_group_ids,confirmation_criteria,invalidation_criteria,next_catalysts,novelty_class,research_synthesis,market_belief,divergence_summary,bias,conviction,base_case,bull_case,bear_case,tail_case,strongest_support,strongest_contradiction,last_evidence_at,last_evaluated_at&limit=240",
      options,
    ),
  ]);

  const slimEditionSnapshots = dailyBriefIndex.map(indexSnapshot);
  const terminalIndex = buildCanonicalEditionIndex(slimEditionSnapshots);
  const currentSnapshotId = terminalIndex[0]?.snapshotId || null;
  const requestedSnapshotId = options.editionId && dailyBriefIndex.some((row) => row.id === options.editionId)
    ? options.editionId
    : null;
  const fullIds = [...new Set([currentSnapshotId, requestedSnapshotId].filter((id): id is string => Boolean(id)))];
  const fullSnapshots = await Promise.all(fullIds.map((id) => getFullDailyBrief(id, options)));
  const fullById = new Map(fullSnapshots.filter((row): row is PublicationSnapshot => Boolean(row)).map((row) => [row.id, row]));

  const legacyStorySnapshots = await getLegacyStoryVerificationSnapshots(legacyVerificationRunIds(dailyBriefIndex), options);
  const editionSnapshots = [
    ...slimEditionSnapshots.map((snapshot) => fullById.get(snapshot.id) || snapshot),
    ...legacyStorySnapshots,
  ];

  return {
    snapshots,
    dailyBriefArchive: slimEditionSnapshots,
    editionSnapshots,
    thesisVersions,
    events,
    causalEdges,
    assetImpacts,
    toneVersions,
    intelligenceStates,
  } as unknown as Awaited<ReturnType<typeof getHybridPublicationRecords>>;
}
