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

export function latestThesisVersion(versions: StoryThesisVersion[]) {
  return versions.reduce<StoryThesisVersion | null>((latest, candidate) => {
    if (!latest || candidate.version_number > latest.version_number) return candidate;
    if (candidate.version_number === latest.version_number && candidate.effective_at > latest.effective_at) return candidate;
    return latest;
  }, null);
}
