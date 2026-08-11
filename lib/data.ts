import { unstable_cache } from "next/cache";

import { withMacroReleaseLifecycle } from "@/lib/macro-release-lifecycle";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DESK_REVALIDATE = 60;

async function query<T>(table: string, params = ""): Promise<T[]> {
  if (!url || !key) return [];
  try {
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      next: { revalidate: DESK_REVALIDATE },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

async function privateQuery<T>(table: string, params = ""): Promise<T[]> {
  if (!url || !serviceKey) return [];
  try {
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      next: { revalidate: DESK_REVALIDATE },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export type Story = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  rank: number | null;
  market_question: string | null;
  dominant_narrative: string | null;
  best_explanation: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  priced_assessment: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  article_angle: string | null;
  provisional_title: string | null;
  article_verdict: string | null;
  assets: string[];
  source_quality: number;
  novelty: number;
  persistence: number;
  trader_relevance: number;
  article_potential: number;
};

export type EarningsCall = {
  id: string;
  ticker: string;
  company_name: string;
  fiscal_period: string;
  call_date: string | null;
  transcript_status: string;
  relevance_reason: string | null;
  summary: string | null;
  guidance: string | null;
  capex: string | null;
  demand: string | null;
  prior_quarter_change: string | null;
};

export type Update = {
  id: string;
  story_id: string;
  update_type: string;
  headline: string;
  detail: string | null;
  observed_at: string | null;
  created_at: string;
};

export type ChartRequest = {
  id: string;
  story_id: string | null;
  instrument: string;
  timeframe: string;
  overlay: string | null;
  question: string;
  confirmation_area: string | null;
  invalidation_area: string | null;
  status: string;
};


export type GuidanceItem = {
  id: string;
  entity: string;
  ticker: string | null;
  category: string;
  period: string | null;
  guidance_type: string;
  metric: string;
  current_view: string;
  prior_view: string | null;
  wording_change: string | null;
  market_interpretation: string | null;
  source_url: string;
  source_classification: string;
  published_at: string | null;
  assets: string[];
};

export type MacroRelease = {
  id: string;
  series_key: string;
  release_name: string;
  agency: string;
  category: string;
  release_date: string;
  release_time_label: string;
  reference_period: string | null;
  frequency: string;
  status: string;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revised_previous: string | null;
  unit: string | null;
  surprise_direction: string | null;
  market_interpretation: string | null;
  watch_question: string;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  source_url: string;
  source_classification: string;
  affected_assets: string[];
  published_at: string | null;
  released_at: string | null;
  actual_retrieved_at: string | null;
  consensus_source: string | null;
  consensus_captured_at: string | null;
  last_ingestion_attempt_at: string | null;
  ingestion_gap_reason: string | null;
  lifecycle_evaluated_at: string | null;
};

export type MacroReleaseMetric = {
  id: string;
  release_id: string;
  metric_key: string;
  label: string;
  transformation: "level" | "mom" | "yoy" | "qoq" | "annualised" | "change";
  unit: string | null;
  previous: number | null;
  revised_previous: number | null;
  consensus: number | null;
  consensus_source: string | null;
  consensus_captured_at: string | null;
  forecast_low: number | null;
  forecast_high: number | null;
  alchemy_expectation: number | null;
  alchemy_expectation_low: number | null;
  alchemy_expectation_high: number | null;
  alchemy_expectation_confidence: number | null;
  actual: number | null;
  surprise_vs_consensus: number | null;
  surprise_vs_alchemy: number | null;
  source_url: string;
  retrieved_at: string;
};


export type MacroSeriesObservation = {
  id:string; series_key:string; series_id:string; series_name:string; agency:string; observation_date:string; value:number;
  mom_change:number|null; yoy_change:number|null; unit:string; frequency:string; source_url:string; is_preliminary:boolean; notes:string|null;
};

export type MarketSeriesObservation = {
  id:string; series_key:string; symbol:string; series_name:string; provider:string; observation_date:string; close:number;
  currency:string|null; frequency:string; source_url:string;
};

export type PublicStatement = {
  id: string;
  speaker: string;
  statement_group?: string | null;
  channel: string;
  statement_date: string;
  quote_excerpt: string;
  topic: string;
  market_interpretation: string | null;
  affected_assets: string[];
  source_url: string;
  verification_status: string;
  follow_up: string | null;
};


export type ResearchSource = {
  id: string;
  story_id: string | null;
  publisher: string;
  source_type: string;
  title: string;
  url: string;
  publication_date: string | null;
  observation_date: string | null;
  reporting_period: string | null;
  reliability_score: number;
  notes: string | null;
};

export type StoryEvidence = {
  id: string;
  story_id: string;
  source_id: string | null;
  evidence_type: string;
  claim: string;
  detail: string | null;
  strength: number;
  created_at: string;
  ai_price_stance: string | null;
  ai_price_reason: string | null;
  chart_series: string[];
  judged_asset: string | null;
  is_active: boolean;
};



export type StoryEvidenceCoverage = {
  slug: string;
  title: string;
  source_count: number;
  tier1_source_count: number;
  evidence_count: number;
  linked_evidence_count: number;
  contradiction_count: number;
  unresolved_count: number;
  chart_count: number;
  update_count: number;
  gate_score: number;
  room_status: string;
};

export type ResearchRegistryItem = {
  id: string;
  slug: string;
  name: string;
  source_kind: string;
  source_tier: number;
  status: string;
  url: string | null;
  corpus_size: number;
  corpus_note: string | null;
  method_strengths: string[];
  operational_use: string;
  safeguards: string;
  owner_app: string;
  last_reviewed_at: string | null;
};

export type ResearchRolloutPhase = {
  id: string;
  phase_order: number;
  phase_key: string;
  name: string;
  owner_app: string;
  status: string;
  scope: string;
  deliverables: string[];
  exit_criteria: string[];
  dependencies: string[];
  notes: string | null;
  updated_at: string;
};

export type NewsThread = {
  id: string;
  domain: string;
  category: string;
  headline: string;
  summary: string;
  current_view: string | null;
  source_url: string;
  source_type: string;
  published_at: string | null;
  importance: number;
  affected_assets: string[];
};

export type MarketStateRecord = {
  id: string;
  module_key: string;
  sector: string;
  sub_industry: string;
  status: string;
  direction: string;
  magnitude: number | null;
  probability: number | null;
  risk: string;
  boon: string;
  beneficiaries: string[];
  losers: string[];
  evidence_summary: string;
  source_name: string;
  source_url: string;
  source_type: string;
  observed_at: string | null;
  freshness_status: string | null;
  next_test: string;
  story_id: string | null;
  transcript_id: string | null;
  owner_status: string;
  updated_at: string;
};

export type ResearchRunStatus = {
  id: string;
  run_key: string;
  schedule_slot: "video_midnight" | "morning" | "video_late_morning" | "evening" | "manual";
  scheduled_for: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "blocked" | "failed";
  accuracy_gate: "open" | "review" | "blocked";
  required_sources_complete: boolean;
  evidence_gate_passed: boolean;
  source_checks: Array<{ source: string; status: string; itemCount?: number; note?: string }>;
  videos_found: number;
  transcripts_ready: number;
  news_scanned: number;
  candidates_kept: number;
  articles_scanned: number;
  articles_flagged: number;
  evidence_added: number;
  updates_published: number;
  warnings: string[];
  summary: string | null;
  updated_at: string;
};

export type ResearchIntakeQueueItem = {
  id: string;
  run_id: string;
  item_key: string;
  item_type: "video" | "news" | "alchemy_article";
  publisher: string;
  title: string;
  url: string;
  published_at: string;
  article_position: number | null;
  transcript_status: "ready" | "missing" | "unavailable" | "not_applicable" | null;
  transcript_provider: "transcriptapi" | "youtubetotranscript.com" | "official" | "other" | null;
  video_review_status: "reviewed" | "listened" | "transcript_only" | "unavailable" | null;
  transcript_word_count: number;
  transcript_language: string | null;
  transcript_retrieved_at: string | null;
  transcript_error_code: string | null;
  transcript_error_message: string | null;
  transcript_http_status: number | null;
  transcript_retryable: boolean | null;
  transcript_attempted_at: string | null;
  transcript_attempt_count: number;
  transcript_duration_seconds: number | null;
  transcript_metadata: Record<string, unknown>;
  transcript_segment_count: number;
  summary: string;
  affected_story_slugs: string[];
  source_quality: number;
  relevance: number;
  novelty: number;
  materiality: number;
  candidate_score: number;
  recommended_action: "ignore" | "monitor" | "collect_evidence" | "review_article" | "recalibrate_story";
  status: "candidate" | "accepted" | "blocked" | "published" | "rejected";
  stats_signal: string | null;
  news_signal: string | null;
  divergence_kind: "none" | "stats_lead" | "news_lead" | "contradiction";
  divergence_note: string | null;
  evidence_links: Array<{ title: string; url: string; publishedAt: string; publisher?: string }>;
  review_reason: string | null;
  updated_at: string;
};

export async function getHybridDeskData() {
  const [stories, updates, sources, marketStateRecords, researchRuns, calls, guidance, macroReleaseRows, macroReleaseMetrics, researchIntake, researchDebt, intelligenceRuns, intelligenceStages, acquisitionFailures] = await Promise.all([
    query<Story>("stories", "select=*&status=neq.archived&order=rank.asc.nullslast,updated_at.desc"),
    query<Update>("story_updates", "select=*&order=created_at.desc&limit=40"),
    query<ResearchSource>("sources", "select=*&order=observation_date.desc.nullslast,created_at.desc&limit=240"),
    query<MarketStateRecord>("market_state_ledger", "select=*&order=sector.asc,sub_industry.asc&limit=120"),
    privateQuery<ResearchRunStatus>("research_run_status", "select=*&order=scheduled_for.desc&limit=20"),
    query<EarningsCall>("earnings_calls", "select=*&order=call_date.desc.nullslast&limit=24"),
    query<GuidanceItem>("guidance_items", "select=*&order=published_at.desc.nullslast,updated_at.desc&limit=80"),
    query<MacroRelease>("macro_releases", "select=*&order=release_date.asc&limit=160"),
    query<MacroReleaseMetric>("macro_release_metrics", "select=*&order=release_id.asc,metric_key.asc&limit=320"),
    privateQuery<ResearchIntakeQueueItem>("research_intake_queue", "select=*&order=published_at.desc&limit=160"),
    privateQuery<Record<string, unknown>>("research_debt", "select=debt_key,severity,status,reason,next_action,next_check_at,last_attempt_at,updated_at&order=next_check_at.asc.nullslast&limit=120"),
    privateQuery<Record<string, unknown>>("intelligence_engine_runs", "select=id,research_run_id,run_key,trigger_kind,status,stories_considered,stories_published,warnings,failure_detail,started_at,completed_at,metadata&order=started_at.desc&limit=20"),
    privateQuery<Record<string, unknown>>("intelligence_stage_runs", "select=id,engine_run_id,stage_key,status,model_name,provider_request_id,failure_code,failure_detail,started_at,completed_at&order=started_at.desc&limit=80"),
    privateQuery<Record<string, unknown>>("intelligence_acquisition_failures", "select=id,provider_key,capability,request_key,failure_code,failure_detail,retryable,first_failed_at,last_failed_at,resolved_at,occurrence_count&order=last_failed_at.desc&limit=80"),
  ]);
  const now = new Date();
  const macroReleases = macroReleaseRows.map((release) => withMacroReleaseLifecycle(release, now));
  return {
    stories,
    updates,
    sources,
    marketStateRecords,
    researchRuns,
    calls,
    guidance,
    macroReleases,
    macroReleaseMetrics,
    researchIntake,
    researchDebt,
    intelligenceRuns,
    intelligenceStages,
    acquisitionFailures,
  };
}

async function loadDeskData() {
  const [stories, calls, updates, charts, guidance, macroReleaseRows, macroReleaseMetrics, statements, newsThreads, sources, evidence, evidenceCoverage, researchRegistry, researchRollout, macroObservations, marketObservations, marketStateRecords, researchRuns, researchIntake] = await Promise.all([
    query<Story>("stories", "select=*&status=neq.archived&order=rank.asc.nullslast,updated_at.desc"),
    query<EarningsCall>("earnings_calls", "select=*&order=call_date.desc.nullslast&limit=12"),
    query<Update>("story_updates", "select=*&order=created_at.desc&limit=40"),
    query<ChartRequest>("chart_requests", "select=*&order=created_at.desc&limit=40"),
    query<GuidanceItem>("guidance_items", "select=*&order=published_at.desc.nullslast,updated_at.desc&limit=40"),
    query<MacroRelease>("macro_releases", "select=*&order=release_date.asc&limit=40"),
    query<MacroReleaseMetric>("macro_release_metrics", "select=*&order=release_id.asc,metric_key.asc&limit=240"),
    query<PublicStatement>("public_statements", "select=*&order=statement_date.desc&limit=30"),
    query<NewsThread>("news_threads", "select=*&order=importance.desc,published_at.desc.nullslast&limit=60"),
    query<ResearchSource>("sources", "select=*&order=observation_date.desc.nullslast,created_at.desc&limit=240"),
    query<StoryEvidence>("evidence", "select=*&is_active=eq.true&order=strength.desc,created_at.desc&limit=240"),
    query<StoryEvidenceCoverage>("story_evidence_coverage", "select=*&order=gate_score.desc,slug.asc"),
    query<ResearchRegistryItem>("research_source_registry", "select=*&order=source_tier.asc,status.asc,name.asc"),
    query<ResearchRolloutPhase>("research_rollout", "select=*&order=phase_order.asc"),
    query<MacroSeriesObservation>("macro_series_observations", "select=*&order=observation_date.asc&limit=500"),
    query<MarketSeriesObservation>("market_series_observations", "select=*&order=observation_date.asc&limit=800"),
    query<MarketStateRecord>("market_state_ledger", "select=*&order=sector.asc,sub_industry.asc&limit=120"),
    privateQuery<ResearchRunStatus>("research_run_status", "select=*&order=scheduled_for.desc&limit=20"),
    privateQuery<ResearchIntakeQueueItem>("research_intake_queue", "select=*&order=candidate_score.desc,published_at.desc&limit=120"),
  ]);
  const now = new Date();
  const macroReleases = macroReleaseRows.map((release) => withMacroReleaseLifecycle(release, now));
  return { stories, calls, updates, charts, guidance, macroReleases, macroReleaseMetrics, statements, newsThreads, sources, evidence, evidenceCoverage, researchRegistry, researchRollout, macroObservations, marketObservations, marketStateRecords, researchRuns, researchIntake };
}

export const getDeskData = unstable_cache(loadDeskData, ["alchemy-desk-data-v2"], { revalidate: DESK_REVALIDATE });
