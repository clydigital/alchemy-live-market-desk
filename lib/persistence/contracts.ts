export type StoryEventType =
  | "headline_update"
  | "evidence_update"
  | "contradiction"
  | "confirmation"
  | "invalidation"
  | "catalyst"
  | "thesis_revision"
  | "archive"
  | "reopen"
  | "correction"
  | "source_update";

export type StoryEvidenceImpact = "supports" | "contradicts" | "amplifies" | "neutral" | "stale";

export type RawSourceRecord = {
  id: string;
  source_id: string | null;
  intake_item_id: string | null;
  research_run_id: string | null;
  supersedes_record_id: string | null;
  ingestion_key: string | null;
  provider: string;
  source_url: string;
  source_type: string;
  content_type: string | null;
  content_hash: string;
  content_text: string | null;
  payload: Record<string, unknown>;
  published_at: string | null;
  observed_at: string | null;
  fetched_at: string;
  created_at: string;
  created_by: string | null;
};

export type NormalisedObservation = {
  id: string;
  raw_record_id: string;
  source_id: string | null;
  story_id: string | null;
  supersedes_observation_id: string | null;
  observation_type: string;
  subject_type: string;
  subject_key: string;
  observed_at: string;
  effective_at: string | null;
  value: Record<string, unknown>;
  unit: string | null;
  confidence: number;
  is_preliminary: boolean;
  methodology_version: string;
  created_at: string;
  created_by: string | null;
};

export type StoryEvent = {
  id: string;
  story_id: string;
  source_id: string | null;
  evidence_id: string | null;
  observation_id: string | null;
  research_run_id: string | null;
  legacy_update_id: string | null;
  event_type: StoryEventType;
  headline: string;
  detail: string | null;
  impact: StoryEvidenceImpact | null;
  confidence_delta: number | null;
  event_at: string;
  recorded_at: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
};

export type StoryThesisVersion = {
  id: string;
  story_id: string;
  event_id: string | null;
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
  article_angle: string | null;
  provisional_title: string | null;
  article_verdict: string | null;
  assets: string[];
  portfolio_map: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  change_reason: string;
  effective_at: string;
  created_at: string;
  created_by: string | null;
};

export type DerivedMetricVersion = {
  id: string;
  metric_key: string;
  subject_type: string;
  subject_key: string;
  story_id: string | null;
  methodology_version: string;
  as_of: string;
  value: number | null;
  value_json: Record<string, unknown>;
  unit: string | null;
  input_observation_ids: string[];
  calculation: Record<string, unknown>;
  source_freshness: Record<string, unknown>;
  is_stale: boolean;
  created_at: string;
  created_by: string | null;
};

export type MacroReleaseVintage = {
  id: string;
  macro_release_id: string;
  source_id: string | null;
  raw_record_id: string | null;
  supersedes_vintage_id: string | null;
  vintage_number: number;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revised_previous: string | null;
  surprise: Record<string, unknown>;
  decisive_component: string | null;
  interpretation: Record<string, unknown>;
  source_url: string;
  published_at: string | null;
  received_at: string;
  is_initial: boolean;
  created_at: string;
  created_by: string | null;
};

export type RecordRevisionAction = "correction" | "supersession" | "invalidation" | "manual_override" | "restoration";

export type RecordRevision = {
  id: string;
  entity_table: string;
  entity_id: string;
  action: RecordRevisionAction;
  previous_record_table: string | null;
  previous_record_id: string | null;
  replacement_record_table: string | null;
  replacement_record_id: string | null;
  reason: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  recorded_at: string;
  recorded_by: string | null;
  metadata: Record<string, unknown>;
};

export type ResearchScheduleSlotKey =
  | "video_midnight"
  | "full_desk"
  | "video_refresh"
  | "evening_delta";

export type ResearchScheduleSlot = {
  slot_key: ResearchScheduleSlotKey;
  local_time: string;
  timezone: string;
  purpose: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ResearchRunStatus = "scheduled" | "running" | "completed" | "partial" | "failed" | "blocked" | "skipped";
export type ResearchHealthState = "healthy" | "degraded" | "blocked" | "unknown";
export type ResearchStageStatus = "pending" | "running" | "complete" | "partial" | "failed" | "blocked" | "not_required";

export type ResearchSlotRun = {
  id: string;
  research_run_id: string | null;
  slot_key: ResearchScheduleSlotKey;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  last_heartbeat_at: string | null;
  status: ResearchRunStatus;
  health_state: ResearchHealthState;
  ingestion_status: ResearchStageStatus;
  transcript_status: ResearchStageStatus;
  verification_status: ResearchStageStatus;
  live_publication_status: ResearchStageStatus;
  hybrid_handoff_status: ResearchStageStatus;
  videos_detected: number;
  transcripts_saved: number;
  claims_extracted: number;
  claims_verified: number;
  causal_edges_updated: number;
  asset_impacts_calculated: number;
  stories_changed: number;
  live_desk_publications: number;
  hybrid_snapshots_sent: number;
  stage_summary: Record<string, unknown>;
  warnings: string[];
  created_at: string;
  updated_at: string;
};

export type ResearchPipelineStage =
  | "detect"
  | "transcribe"
  | "save"
  | "extract_claims"
  | "verify_claims"
  | "build_causal_edges"
  | "calculate_asset_impacts"
  | "challenge_market_interpretation"
  | "publish_live_desk"
  | "send_hybrid_snapshot"
  | "health_check";

export type ResearchSlotEvent = {
  id: string;
  slot_run_id: string;
  stage: ResearchPipelineStage;
  status: "started" | "completed" | "partial" | "failed" | "blocked" | "warning" | "skipped";
  detail: string | null;
  metrics: Record<string, unknown>;
  warnings: string[];
  occurred_at: string;
  created_by: string | null;
};

export type CreatorClaimType = "fact" | "forecast" | "causal" | "market_pricing" | "policy" | "rumour" | "opinion";

export type CreatorClaim = {
  id: string;
  raw_record_id: string;
  intake_item_id: string | null;
  research_run_id: string | null;
  slot_run_id: string | null;
  story_id: string | null;
  claim_key: string;
  claim_text: string;
  normalised_claim: string;
  claim_type: CreatorClaimType;
  subject_type: string | null;
  subject_key: string | null;
  creator_name: string | null;
  stated_time_horizon: string | null;
  extraction_confidence: number;
  extracted_at: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
};

export type ClaimVerificationVerdict = "verified" | "partially_verified" | "contradicted" | "unverifiable" | "stale" | "pending";

export type ClaimVerification = {
  id: string;
  claim_id: string;
  verification_version: number;
  verdict: ClaimVerificationVerdict;
  confidence: number;
  primary_source_record_id: string | null;
  source_id: string | null;
  observation_ids: string[];
  evidence_ids: string[];
  checked_against: Record<string, unknown>[];
  reasoning: string;
  methodology_version: string;
  verified_at: string;
  expires_at: string | null;
  created_by: string | null;
};

export type CausalEvidenceState = "observed" | "strongly_supported" | "inferred" | "speculative";
export type CausalDirection = "positive" | "negative" | "mixed" | "conditional";

export type CausalEdge = {
  id: string;
  story_id: string | null;
  claim_id: string | null;
  supersedes_edge_id: string | null;
  from_node: string;
  relationship: string;
  to_node: string;
  direction: CausalDirection;
  evidence_state: CausalEvidenceState;
  confidence: number;
  time_horizon: string | null;
  expected_lag: string | null;
  mechanism: string;
  verification_ids: string[];
  observation_ids: string[];
  evidence_ids: string[];
  confirmation_condition: string | null;
  invalidation_condition: string | null;
  effective_at: string;
  created_at: string;
  created_by: string | null;
};

export type AssetImpactDirection = "bullish" | "bearish" | "mixed" | "neutral" | "conditional";

export type AssetImpact = {
  id: string;
  story_id: string | null;
  causal_edge_id: string | null;
  supersedes_asset_impact_id: string | null;
  asset_key: string;
  asset_class: string | null;
  direction: AssetImpactDirection;
  time_horizon: string;
  mechanism: string;
  confidence: number;
  evidence_state: CausalEvidenceState;
  observation_ids: string[];
  evidence_ids: string[];
  confirmation_condition: string | null;
  invalidation_condition: string | null;
  as_of: string;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type FiscalSupplySnapshot = {
  id: string;
  raw_record_id: string | null;
  source_id: string | null;
  research_run_id: string | null;
  supersedes_snapshot_id: string | null;
  quarter_key: string;
  as_of: string;
  quarterly_borrowing_estimate_usd: number | null;
  previous_borrowing_estimate_usd: number | null;
  borrowing_revision_usd: number | null;
  fiscal_deficit_usd: number | null;
  treasury_general_account_usd: number | null;
  net_interest_outlays_usd: number | null;
  debt_held_by_public_usd: number | null;
  average_interest_cost_pct: number | null;
  refinancing_profile: Record<string, unknown>;
  net_bill_issuance_usd: number | null;
  net_coupon_issuance_usd: number | null;
  buybacks_usd: number | null;
  tips_issuance_usd: number | null;
  frn_issuance_usd: number | null;
  coupon_auction_sizes: Record<string, unknown>;
  interpretation: Record<string, unknown>;
  confidence: number;
  methodology_version: string;
  created_at: string;
  created_by: string | null;
};

export type TreasurySecurityType = "bill" | "note" | "bond" | "tips" | "frn" | "cash_management_bill";
export type TreasuryDemandAssessment = "strong" | "average" | "weak" | "mixed" | "unknown";

export type TreasuryAuctionResult = {
  id: string;
  raw_record_id: string | null;
  source_id: string | null;
  research_run_id: string | null;
  security_type: TreasurySecurityType;
  tenor: string;
  cusip: string | null;
  is_reopening: boolean;
  announced_at: string | null;
  auction_at: string;
  settlement_date: string | null;
  offering_amount_usd: number;
  when_issued_yield: number | null;
  stop_yield: number | null;
  tail_bps: number | null;
  bid_to_cover: number | null;
  indirect_bidder_pct: number | null;
  direct_bidder_pct: number | null;
  primary_dealer_pct: number | null;
  post_auction_5m_bps: number | null;
  post_auction_30m_bps: number | null;
  post_auction_close_bps: number | null;
  demand_assessment: TreasuryDemandAssessment;
  interpretation: string | null;
  created_at: string;
  created_by: string | null;
};

export type HybridSnapshotType = "story" | "fiscal_supply" | "market_state" | "article_review" | "daily_brief";

export type HybridPublicationSnapshot = {
  id: string;
  research_run_id: string | null;
  slot_run_id: string | null;
  story_id: string | null;
  story_thesis_version_id: string | null;
  supersedes_snapshot_id: string | null;
  snapshot_type: HybridSnapshotType;
  public_summary: string;
  payload: Record<string, unknown>;
  source_record_refs: Record<string, unknown>[];
  redaction_log: Record<string, unknown>[];
  confidence: number;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
};

export function latestThesisVersion(versions: StoryThesisVersion[]) {
  return versions.reduce<StoryThesisVersion | null>((latest, candidate) => {
    if (!latest || candidate.version_number > latest.version_number) return candidate;
    if (candidate.version_number === latest.version_number && candidate.effective_at > latest.effective_at) return candidate;
    return latest;
  }, null);
}
