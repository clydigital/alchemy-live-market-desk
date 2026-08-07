-- Alchemy Live Desk V8 verified-research, fiscal supply and Hybrid handoff contract
-- Additive only. Depends on 20260807010000_live_desk_v8_persistence.sql.
-- It is intentionally not applied by this pull request.

begin;

create table if not exists public.research_schedule_slots (
  slot_key text primary key check (slot_key in (
    'video_midnight',
    'full_desk',
    'video_refresh',
    'evening_delta'
  )),
  local_time time not null,
  timezone text not null default 'Asia/Kuala_Lumpur',
  purpose text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.research_schedule_slots (slot_key, local_time, timezone, purpose)
values
  ('video_midnight', '00:40', 'Asia/Kuala_Lumpur', 'Overnight video detection, transcript capture and initial claim extraction'),
  ('full_desk', '08:30', 'Asia/Kuala_Lumpur', 'Full source verification, Story recalibration and Live Desk publication'),
  ('video_refresh', '11:30', 'Asia/Kuala_Lumpur', 'Late-morning video and market-reaction refresh'),
  ('evening_delta', '22:00', 'Asia/Kuala_Lumpur', 'Evening delta, catalyst review and stale-state check')
on conflict (slot_key) do nothing;

create table if not exists public.research_slot_runs (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid unique references public.research_runs(id) on delete set null,
  slot_key text not null references public.research_schedule_slots(slot_key) on delete restrict,
  scheduled_for timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  last_heartbeat_at timestamptz,
  status text not null default 'scheduled' check (status in (
    'scheduled', 'running', 'completed', 'partial', 'failed', 'blocked', 'skipped'
  )),
  health_state text not null default 'unknown' check (health_state in (
    'healthy', 'degraded', 'blocked', 'unknown'
  )),
  ingestion_status text not null default 'pending' check (ingestion_status in (
    'pending', 'running', 'complete', 'partial', 'failed', 'blocked', 'not_required'
  )),
  transcript_status text not null default 'pending' check (transcript_status in (
    'pending', 'running', 'complete', 'partial', 'failed', 'blocked', 'not_required'
  )),
  verification_status text not null default 'pending' check (verification_status in (
    'pending', 'running', 'complete', 'partial', 'failed', 'blocked', 'not_required'
  )),
  live_publication_status text not null default 'pending' check (live_publication_status in (
    'pending', 'running', 'complete', 'partial', 'failed', 'blocked', 'not_required'
  )),
  hybrid_handoff_status text not null default 'pending' check (hybrid_handoff_status in (
    'pending', 'running', 'complete', 'partial', 'failed', 'blocked', 'not_required'
  )),
  videos_detected integer not null default 0 check (videos_detected >= 0),
  transcripts_saved integer not null default 0 check (transcripts_saved >= 0),
  claims_extracted integer not null default 0 check (claims_extracted >= 0),
  claims_verified integer not null default 0 check (claims_verified >= 0),
  causal_edges_updated integer not null default 0 check (causal_edges_updated >= 0),
  asset_impacts_calculated integer not null default 0 check (asset_impacts_calculated >= 0),
  stories_changed integer not null default 0 check (stories_changed >= 0),
  live_desk_publications integer not null default 0 check (live_desk_publications >= 0),
  hybrid_snapshots_sent integer not null default 0 check (hybrid_snapshots_sent >= 0),
  stage_summary jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_slot_events (
  id uuid primary key default gen_random_uuid(),
  slot_run_id uuid not null references public.research_slot_runs(id) on delete restrict,
  stage text not null check (stage in (
    'detect',
    'transcribe',
    'save',
    'extract_claims',
    'verify_claims',
    'build_causal_edges',
    'calculate_asset_impacts',
    'challenge_market_interpretation',
    'publish_live_desk',
    'send_hybrid_snapshot',
    'health_check'
  )),
  status text not null check (status in (
    'started', 'completed', 'partial', 'failed', 'blocked', 'warning', 'skipped'
  )),
  detail text,
  metrics jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  occurred_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.creator_claims (
  id uuid primary key default gen_random_uuid(),
  raw_record_id uuid not null references public.raw_source_records(id) on delete restrict,
  intake_item_id uuid references public.research_intake_items(id) on delete set null,
  research_run_id uuid references public.research_runs(id) on delete set null,
  slot_run_id uuid references public.research_slot_runs(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
  claim_key text not null,
  claim_text text not null,
  normalised_claim text not null,
  claim_type text not null check (claim_type in (
    'fact', 'forecast', 'causal', 'market_pricing', 'policy', 'rumour', 'opinion'
  )),
  subject_type text,
  subject_key text,
  creator_name text,
  stated_time_horizon text,
  extraction_confidence integer not null default 50 check (extraction_confidence between 0 and 100),
  extracted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  constraint creator_claims_record_key unique (raw_record_id, claim_key)
);

create table if not exists public.claim_verifications (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.creator_claims(id) on delete restrict,
  verification_version integer not null check (verification_version > 0),
  verdict text not null check (verdict in (
    'verified', 'partially_verified', 'contradicted', 'unverifiable', 'stale', 'pending'
  )),
  confidence integer not null default 50 check (confidence between 0 and 100),
  primary_source_record_id uuid references public.raw_source_records(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  observation_ids uuid[] not null default '{}'::uuid[],
  evidence_ids uuid[] not null default '{}'::uuid[],
  checked_against jsonb not null default '[]'::jsonb,
  reasoning text not null,
  methodology_version text not null default 'v1',
  verified_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid default auth.uid(),
  constraint claim_verifications_claim_version_key unique (claim_id, verification_version)
);

create table if not exists public.causal_edges (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete set null,
  claim_id uuid references public.creator_claims(id) on delete set null,
  supersedes_edge_id uuid references public.causal_edges(id) on delete restrict,
  from_node text not null,
  relationship text not null,
  to_node text not null,
  direction text not null check (direction in ('positive', 'negative', 'mixed', 'conditional')),
  evidence_state text not null check (evidence_state in (
    'observed', 'strongly_supported', 'inferred', 'speculative'
  )),
  confidence integer not null default 50 check (confidence between 0 and 100),
  time_horizon text,
  expected_lag text,
  mechanism text not null,
  verification_ids uuid[] not null default '{}'::uuid[],
  observation_ids uuid[] not null default '{}'::uuid[],
  evidence_ids uuid[] not null default '{}'::uuid[],
  confirmation_condition text,
  invalidation_condition text,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.asset_impacts (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete set null,
  causal_edge_id uuid references public.causal_edges(id) on delete set null,
  supersedes_asset_impact_id uuid references public.asset_impacts(id) on delete restrict,
  asset_key text not null,
  asset_class text,
  direction text not null check (direction in (
    'bullish', 'bearish', 'mixed', 'neutral', 'conditional'
  )),
  time_horizon text not null,
  mechanism text not null,
  confidence integer not null default 50 check (confidence between 0 and 100),
  evidence_state text not null check (evidence_state in (
    'observed', 'strongly_supported', 'inferred', 'speculative'
  )),
  observation_ids uuid[] not null default '{}'::uuid[],
  evidence_ids uuid[] not null default '{}'::uuid[],
  confirmation_condition text,
  invalidation_condition text,
  as_of timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.fiscal_supply_snapshots (
  id uuid primary key default gen_random_uuid(),
  raw_record_id uuid references public.raw_source_records(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  research_run_id uuid references public.research_runs(id) on delete set null,
  supersedes_snapshot_id uuid references public.fiscal_supply_snapshots(id) on delete restrict,
  quarter_key text not null,
  as_of timestamptz not null,
  quarterly_borrowing_estimate_usd numeric,
  previous_borrowing_estimate_usd numeric,
  borrowing_revision_usd numeric,
  fiscal_deficit_usd numeric,
  treasury_general_account_usd numeric,
  net_interest_outlays_usd numeric,
  debt_held_by_public_usd numeric,
  average_interest_cost_pct numeric,
  refinancing_profile jsonb not null default '{}'::jsonb,
  net_bill_issuance_usd numeric,
  net_coupon_issuance_usd numeric,
  buybacks_usd numeric,
  tips_issuance_usd numeric,
  frn_issuance_usd numeric,
  coupon_auction_sizes jsonb not null default '{}'::jsonb,
  interpretation jsonb not null default '{}'::jsonb,
  confidence integer not null default 50 check (confidence between 0 and 100),
  methodology_version text not null default 'v1',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.treasury_auction_results (
  id uuid primary key default gen_random_uuid(),
  raw_record_id uuid references public.raw_source_records(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  research_run_id uuid references public.research_runs(id) on delete set null,
  security_type text not null check (security_type in (
    'bill', 'note', 'bond', 'tips', 'frn', 'cash_management_bill'
  )),
  tenor text not null,
  cusip text,
  is_reopening boolean not null default false,
  announced_at timestamptz,
  auction_at timestamptz not null,
  settlement_date date,
  offering_amount_usd numeric not null,
  when_issued_yield numeric,
  stop_yield numeric,
  tail_bps numeric,
  bid_to_cover numeric,
  indirect_bidder_pct numeric,
  direct_bidder_pct numeric,
  primary_dealer_pct numeric,
  post_auction_5m_bps numeric,
  post_auction_30m_bps numeric,
  post_auction_close_bps numeric,
  demand_assessment text not null default 'unknown' check (demand_assessment in (
    'strong', 'average', 'weak', 'mixed', 'unknown'
  )),
  interpretation text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.hybrid_publication_snapshots (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.research_runs(id) on delete set null,
  slot_run_id uuid references public.research_slot_runs(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
  story_thesis_version_id uuid references public.story_thesis_versions(id) on delete set null,
  supersedes_snapshot_id uuid references public.hybrid_publication_snapshots(id) on delete restrict,
  snapshot_type text not null check (snapshot_type in (
    'story', 'fiscal_supply', 'market_state', 'article_review', 'daily_brief'
  )),
  public_summary text not null,
  payload jsonb not null,
  source_record_refs jsonb not null default '[]'::jsonb,
  redaction_log jsonb not null default '[]'::jsonb,
  confidence integer not null default 50 check (confidence between 0 and 100),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists research_slot_runs_slot_time_idx
  on public.research_slot_runs (slot_key, scheduled_for desc);
create index if not exists research_slot_runs_health_idx
  on public.research_slot_runs (health_state, scheduled_for desc);
create index if not exists research_slot_events_run_time_idx
  on public.research_slot_events (slot_run_id, occurred_at desc);
create index if not exists creator_claims_story_time_idx
  on public.creator_claims (story_id, extracted_at desc)
  where story_id is not null;
create index if not exists creator_claims_run_idx
  on public.creator_claims (research_run_id, extracted_at desc)
  where research_run_id is not null;
create index if not exists claim_verifications_claim_time_idx
  on public.claim_verifications (claim_id, verification_version desc, verified_at desc);
create index if not exists causal_edges_story_time_idx
  on public.causal_edges (story_id, effective_at desc)
  where story_id is not null;
create index if not exists causal_edges_nodes_idx
  on public.causal_edges (from_node, to_node, effective_at desc);
create index if not exists asset_impacts_asset_time_idx
  on public.asset_impacts (asset_key, as_of desc);
create index if not exists asset_impacts_story_time_idx
  on public.asset_impacts (story_id, as_of desc)
  where story_id is not null;
create index if not exists fiscal_supply_snapshots_quarter_time_idx
  on public.fiscal_supply_snapshots (quarter_key, as_of desc);
create index if not exists treasury_auction_results_tenor_time_idx
  on public.treasury_auction_results (tenor, auction_at desc);
create index if not exists treasury_auction_results_date_idx
  on public.treasury_auction_results (auction_at desc);
create index if not exists hybrid_publication_snapshots_type_time_idx
  on public.hybrid_publication_snapshots (snapshot_type, published_at desc);
create index if not exists hybrid_publication_snapshots_story_time_idx
  on public.hybrid_publication_snapshots (story_id, published_at desc)
  where story_id is not null;

create trigger research_slot_events_append_only
before update or delete on public.research_slot_events
for each row execute function public.prevent_immutable_research_mutation();

create trigger creator_claims_append_only
before update or delete on public.creator_claims
for each row execute function public.prevent_immutable_research_mutation();

create trigger claim_verifications_append_only
before update or delete on public.claim_verifications
for each row execute function public.prevent_immutable_research_mutation();

create trigger causal_edges_append_only
before update or delete on public.causal_edges
for each row execute function public.prevent_immutable_research_mutation();

create trigger asset_impacts_append_only
before update or delete on public.asset_impacts
for each row execute function public.prevent_immutable_research_mutation();

create trigger fiscal_supply_snapshots_append_only
before update or delete on public.fiscal_supply_snapshots
for each row execute function public.prevent_immutable_research_mutation();

create trigger treasury_auction_results_append_only
before update or delete on public.treasury_auction_results
for each row execute function public.prevent_immutable_research_mutation();

create trigger hybrid_publication_snapshots_append_only
before update or delete on public.hybrid_publication_snapshots
for each row execute function public.prevent_immutable_research_mutation();

create or replace view public.latest_claim_verifications
with (security_invoker = true)
as
select distinct on (claim_id)
  id,
  claim_id,
  verification_version,
  verdict,
  confidence,
  primary_source_record_id,
  source_id,
  observation_ids,
  evidence_ids,
  checked_against,
  reasoning,
  methodology_version,
  verified_at,
  expires_at,
  created_by
from public.claim_verifications
order by claim_id, verification_version desc, verified_at desc;

create or replace view public.current_causal_edges
with (security_invoker = true)
as
select edge.*
from public.causal_edges edge
where not exists (
  select 1
  from public.causal_edges replacement
  where replacement.supersedes_edge_id = edge.id
);

create or replace view public.current_asset_impacts
with (security_invoker = true)
as
select impact.*
from public.asset_impacts impact
where not exists (
  select 1
  from public.asset_impacts replacement
  where replacement.supersedes_asset_impact_id = impact.id
);

create or replace view public.current_fiscal_supply_snapshots
with (security_invoker = true)
as
select distinct on (quarter_key)
  *
from public.fiscal_supply_snapshots
order by quarter_key, as_of desc, created_at desc;

alter table public.research_schedule_slots enable row level security;
alter table public.research_slot_runs enable row level security;
alter table public.research_slot_events enable row level security;
alter table public.creator_claims enable row level security;
alter table public.claim_verifications enable row level security;
alter table public.causal_edges enable row level security;
alter table public.asset_impacts enable row level security;
alter table public.fiscal_supply_snapshots enable row level security;
alter table public.treasury_auction_results enable row level security;
alter table public.hybrid_publication_snapshots enable row level security;

create policy public_read_research_schedule_slots
  on public.research_schedule_slots for select to public using (true);
create policy authenticated_read_research_slot_runs
  on public.research_slot_runs for select to authenticated using (true);
create policy authenticated_read_research_slot_events
  on public.research_slot_events for select to authenticated using (true);
create policy authenticated_read_creator_claims
  on public.creator_claims for select to authenticated using (true);
create policy authenticated_read_claim_verifications
  on public.claim_verifications for select to authenticated using (true);
create policy public_read_causal_edges
  on public.causal_edges for select to public using (true);
create policy public_read_asset_impacts
  on public.asset_impacts for select to public using (true);
create policy public_read_fiscal_supply_snapshots
  on public.fiscal_supply_snapshots for select to public using (true);
create policy public_read_treasury_auction_results
  on public.treasury_auction_results for select to public using (true);
create policy public_read_hybrid_publication_snapshots
  on public.hybrid_publication_snapshots for select to public using (true);

grant select on public.research_schedule_slots to anon, authenticated;
grant select on public.research_slot_runs to authenticated;
grant select on public.research_slot_events to authenticated;
grant select on public.creator_claims to authenticated;
grant select on public.claim_verifications to authenticated;
grant select on public.causal_edges to anon, authenticated;
grant select on public.asset_impacts to anon, authenticated;
grant select on public.fiscal_supply_snapshots to anon, authenticated;
grant select on public.treasury_auction_results to anon, authenticated;
grant select on public.hybrid_publication_snapshots to anon, authenticated;
grant select on public.latest_claim_verifications to authenticated;
grant select on public.current_causal_edges to anon, authenticated;
grant select on public.current_asset_impacts to anon, authenticated;
grant select on public.current_fiscal_supply_snapshots to anon, authenticated;

comment on table public.research_schedule_slots is 'Canonical Asia/Kuala_Lumpur research schedule with four first-class slots.';
comment on table public.research_slot_runs is 'Mutable operational health state for each scheduled research run.';
comment on table public.research_slot_events is 'Append-only stage history for detect-to-Hybrid pipeline execution.';
comment on table public.creator_claims is 'Immutable atomic claims extracted from creator transcripts or commentary.';
comment on table public.claim_verifications is 'Append-only primary-source verification outcomes for creator claims.';
comment on table public.causal_edges is 'Versioned causal links with evidence state, confidence, confirmation and invalidation.';
comment on table public.asset_impacts is 'Versioned asset conclusions derived from verified causal paths.';
comment on table public.fiscal_supply_snapshots is 'Versioned fiscal borrowing, issuance-mix, liquidity and refinancing snapshots.';
comment on table public.treasury_auction_results is 'Treasury auction quality and post-auction market reaction observations.';
comment on table public.hybrid_publication_snapshots is 'Redacted decision-ready state sent from Live Desk to Hybrid without raw transcript payloads.';

commit;
