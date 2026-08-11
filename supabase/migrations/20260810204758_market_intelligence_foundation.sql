-- Alchemy Market Intelligence foundation.
-- This migration is deliberately additive. The existing stories/evidence tables
-- remain the compatibility projection used by the current Live and Hybrid UIs.

create table if not exists public.intelligence_source_ancestry_groups (
  id uuid primary key default gen_random_uuid(),
  ancestry_key text not null unique,
  canonical_name text not null,
  owner_name text,
  independence_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  ancestry_group_id uuid references public.intelligence_source_ancestry_groups(id) on delete set null,
  provider_key text not null,
  external_source_id text,
  source_name text not null,
  source_type text not null,
  source_url text,
  source_tier smallint not null default 3 check (source_tier between 1 and 5),
  reliability_score numeric(5,2) not null default 50 check (reliability_score between 0 and 100),
  methodology_notes text,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists intelligence_evidence_sources_provider_external_uidx
  on public.intelligence_evidence_sources(provider_key, external_source_id)
  where external_source_id is not null;

create table if not exists public.intelligence_evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.intelligence_evidence_sources(id) on delete restrict,
  -- Optional bridge to the V8 raw-record layer. Some deployed desks predate
  -- that additive migration, so the FK is installed conditionally below.
  raw_source_record_id uuid,
  research_run_id uuid references public.research_runs(id) on delete set null,
  external_evidence_id text,
  evidence_class text not null check (evidence_class in (
    'official_release', 'market_observation', 'company_primary', 'transcript',
    'regulatory_filing', 'news_report', 'research_analysis', 'derived_metric', 'other'
  )),
  support_direction text not null default 'neutral' check (support_direction in (
    'supports', 'contradicts', 'mixed', 'neutral', 'context'
  )),
  claim_text text not null,
  summary text,
  event_at timestamptz,
  published_at timestamptz,
  available_at timestamptz,
  received_at timestamptz not null default now(),
  geography text,
  affected_assets text[] not null default '{}',
  affected_topics text[] not null default '{}',
  measurement_unit text,
  observed_value numeric,
  expected_value numeric,
  previous_value numeric,
  revision_value numeric,
  confidence numeric(5,2) not null default 50 check (confidence between 0 and 100),
  freshness_status text not null default 'current' check (freshness_status in ('current', 'aging', 'stale', 'superseded')),
  content_hash text not null,
  provenance_urls text[] not null default '{}',
  structured_payload jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  normalizer_version text not null,
  supersedes_evidence_id uuid references public.intelligence_evidence(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists intelligence_evidence_source_hash_uidx
  on public.intelligence_evidence(source_id, content_hash);
create index if not exists intelligence_evidence_event_idx
  on public.intelligence_evidence(event_at desc nulls last);
create index if not exists intelligence_evidence_topics_idx
  on public.intelligence_evidence using gin(affected_topics);
create index if not exists intelligence_evidence_assets_idx
  on public.intelligence_evidence using gin(affected_assets);

do $$
begin
  if to_regclass('public.raw_source_records') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'intelligence_evidence_raw_source_record_id_fkey'
        and conrelid = 'public.intelligence_evidence'::regclass
    ) then
    alter table public.intelligence_evidence
      add constraint intelligence_evidence_raw_source_record_id_fkey
      foreign key (raw_source_record_id) references public.raw_source_records(id) on delete set null;
  end if;
end;
$$;

create table if not exists public.intelligence_entities (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  entity_type text not null check (entity_type in (
    'company', 'country', 'central_bank', 'government_agency', 'person',
    'asset', 'currency', 'commodity', 'index', 'sector', 'theme', 'event', 'other'
  )),
  canonical_name text not null,
  aliases text[] not null default '{}',
  identifiers jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_entity_relationships (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid not null references public.intelligence_entities(id) on delete cascade,
  relationship_type text not null,
  to_entity_id uuid not null references public.intelligence_entities(id) on delete cascade,
  direction text not null default 'directed' check (direction in ('directed', 'bidirectional')),
  confidence numeric(5,2) not null default 50 check (confidence between 0 and 100),
  valid_from timestamptz,
  valid_to timestamptz,
  evidence_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(from_entity_id, relationship_type, to_entity_id),
  check (from_entity_id <> to_entity_id)
);

create table if not exists public.intelligence_evidence_entities (
  evidence_id uuid not null references public.intelligence_evidence(id) on delete cascade,
  entity_id uuid not null references public.intelligence_entities(id) on delete cascade,
  relationship_role text not null default 'mentioned',
  salience numeric(5,2) not null default 50 check (salience between 0 and 100),
  created_at timestamptz not null default now(),
  primary key(evidence_id, entity_id, relationship_role)
);

create table if not exists public.intelligence_themes (
  id uuid primary key default gen_random_uuid(),
  theme_key text not null unique,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'dormant', 'archived')),
  parent_theme_id uuid references public.intelligence_themes(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_evidence_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('story', 'hypothesis', 'theme', 'entity', 'evidence')),
  owner_id uuid not null,
  title text not null,
  room_status text not null default 'open' check (room_status in ('open', 'ready', 'attention', 'closed', 'archived')),
  synthesis text,
  unresolved_questions text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_kind, owner_id)
);

create table if not exists public.intelligence_evidence_room_items (
  room_id uuid not null references public.intelligence_evidence_rooms(id) on delete cascade,
  evidence_id uuid not null references public.intelligence_evidence(id) on delete cascade,
  evidence_role text not null default 'context' check (evidence_role in (
    'decisive', 'supporting', 'contradicting', 'context', 'confirmation', 'invalidation'
  )),
  independence_group_id uuid references public.intelligence_source_ancestry_groups(id) on delete set null,
  relevance_score numeric(5,2) not null default 50 check (relevance_score between 0 and 100),
  notes text,
  added_at timestamptz not null default now(),
  primary key(room_id, evidence_id)
);

create table if not exists public.intelligence_market_beliefs (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references public.intelligence_themes(id) on delete set null,
  belief_key text not null unique,
  statement text not null,
  priced_state text,
  consensus_strength numeric(5,2) not null default 50 check (consensus_strength between 0 and 100),
  affected_assets text[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'weakening', 'superseded', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_divergences (
  id uuid primary key default gen_random_uuid(),
  market_belief_id uuid not null references public.intelligence_market_beliefs(id) on delete cascade,
  divergence_key text not null unique,
  observed_change text not null,
  expected_change text,
  magnitude numeric(5,2) not null default 50 check (magnitude between 0 and 100),
  persistence_score numeric(5,2) not null default 50 check (persistence_score between 0 and 100),
  decisive_evidence_ids uuid[] not null default '{}',
  detected_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'explained', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_hypotheses (
  id uuid primary key default gen_random_uuid(),
  divergence_id uuid references public.intelligence_divergences(id) on delete set null,
  hypothesis_key text not null unique,
  statement text not null,
  causal_mechanism text not null,
  affected_assets text[] not null default '{}',
  confirmation_criteria text[] not null default '{}',
  invalidation_criteria text[] not null default '{}',
  next_catalysts text[] not null default '{}',
  confidence numeric(5,2) not null default 50 check (confidence between 0 and 100),
  status text not null default 'detected' check (status in (
    'detected', 'developing', 'confirmed', 'weakening', 'invalidated', 'archived'
  )),
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_hypothesis_evidence (
  hypothesis_id uuid not null references public.intelligence_hypotheses(id) on delete cascade,
  evidence_id uuid not null references public.intelligence_evidence(id) on delete cascade,
  evidence_role text not null check (evidence_role in ('decisive', 'supporting', 'contradicting', 'confirmation', 'invalidation', 'context')),
  weight numeric(5,2) not null default 50 check (weight between 0 and 100),
  rationale text,
  created_at timestamptz not null default now(),
  primary key(hypothesis_id, evidence_id, evidence_role)
);

create table if not exists public.intelligence_challenger_assessments (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid not null references public.intelligence_hypotheses(id) on delete cascade,
  stage_run_id uuid,
  verdict text not null check (verdict in ('survives', 'qualified', 'rejected', 'insufficient_evidence')),
  strongest_countercase text not null,
  hidden_assumptions text[] not null default '{}',
  alternative_mechanisms text[] not null default '{}',
  missing_evidence text[] not null default '{}',
  adjusted_confidence numeric(5,2) not null check (adjusted_confidence between 0 and 100),
  assessment_payload jsonb not null default '{}'::jsonb,
  assessed_at timestamptz not null default now()
);

create table if not exists public.intelligence_story_states (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null unique references public.stories(id) on delete cascade,
  primary_hypothesis_id uuid references public.intelligence_hypotheses(id) on delete set null,
  lifecycle_status text not null default 'detected' check (lifecycle_status in (
    'detected', 'developing', 'confirmed', 'weakening', 'invalidated', 'archived'
  )),
  publication_eligible boolean not null default false,
  qualification_score numeric(6,3) not null default 0 check (qualification_score between 0 and 100),
  event_signature text not null default '',
  thesis_signature text not null default '',
  causal_mechanism text not null default '',
  affected_assets text[] not null default '{}',
  decisive_evidence_ids uuid[] not null default '{}',
  source_ancestry_group_ids uuid[] not null default '{}',
  confirmation_criteria text[] not null default '{}',
  invalidation_criteria text[] not null default '{}',
  next_catalysts text[] not null default '{}',
  novelty_fingerprint text,
  novelty_class text check (novelty_class is null or novelty_class in (
    'new_story', 'existing_story_update', 'duplicate', 'related_distinct', 'insufficient_novelty'
  )),
  duplicate_of_story_id uuid references public.stories(id) on delete set null,
  canonical_external_url text,
  research_synthesis text,
  last_evidence_at timestamptz,
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (story_id <> duplicate_of_story_id)
);

create index if not exists intelligence_story_states_publication_idx
  on public.intelligence_story_states(publication_eligible, lifecycle_status, qualification_score desc);
create unique index if not exists intelligence_story_states_novelty_uidx
  on public.intelligence_story_states(novelty_fingerprint)
  where novelty_fingerprint is not null and novelty_class <> 'related_distinct';

create table if not exists public.intelligence_story_evidence (
  story_id uuid not null references public.stories(id) on delete cascade,
  evidence_id uuid not null references public.intelligence_evidence(id) on delete cascade,
  evidence_role text not null check (evidence_role in ('decisive', 'supporting', 'contradicting', 'confirmation', 'invalidation', 'context')),
  weight numeric(5,2) not null default 50 check (weight between 0 and 100),
  rationale text,
  linked_at timestamptz not null default now(),
  primary key(story_id, evidence_id, evidence_role)
);

create table if not exists public.intelligence_story_relations (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  related_story_id uuid not null references public.stories(id) on delete cascade,
  relation_type text not null check (relation_type in (
    'duplicate_of', 'updates', 'supersedes', 'related_distinct', 'contradicts', 'shares_evidence'
  )),
  similarity_score numeric(5,2) not null default 0 check (similarity_score between 0 and 100),
  rationale text not null,
  exception_proof jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(story_id, related_story_id, relation_type),
  check (story_id <> related_story_id)
);

create table if not exists public.intelligence_story_history (
  id uuid primary key default gen_random_uuid(),
  story_state_id uuid not null references public.intelligence_story_states(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  lifecycle_status text not null,
  publication_eligible boolean not null,
  novelty_class text,
  qualification_score numeric(6,3) not null,
  change_reason text,
  state_snapshot jsonb not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.intelligence_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  stage_key text not null,
  version integer not null check (version > 0),
  prompt_text text not null,
  output_schema jsonb not null default '{}'::jsonb,
  model_hint text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique(stage_key, version)
);

create unique index if not exists intelligence_prompt_versions_one_active_uidx
  on public.intelligence_prompt_versions(stage_key)
  where is_active;

create table if not exists public.intelligence_engine_runs (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.research_runs(id) on delete set null,
  trigger_kind text not null check (trigger_kind in ('scheduled', 'new_evidence', 'manual', 'targeted_reevaluation', 'api')),
  trigger_evidence_ids uuid[] not null default '{}',
  target_story_ids uuid[] not null default '{}',
  target_hypothesis_ids uuid[] not null default '{}',
  status text not null default 'started' check (status in ('started', 'completed', 'partial', 'failed', 'blocked')),
  stories_considered integer not null default 0,
  stories_published integer not null default 0,
  warnings text[] not null default '{}',
  failure_detail text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.intelligence_stage_runs (
  id uuid primary key default gen_random_uuid(),
  engine_run_id uuid not null references public.intelligence_engine_runs(id) on delete cascade,
  prompt_version_id uuid references public.intelligence_prompt_versions(id) on delete set null,
  stage_key text not null,
  status text not null default 'started' check (status in ('started', 'completed', 'failed', 'blocked', 'skipped')),
  input_refs jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  model_name text,
  provider_request_id text,
  input_tokens integer,
  output_tokens integer,
  failure_code text,
  failure_detail text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.intelligence_story_candidates (
  id uuid primary key default gen_random_uuid(),
  engine_run_id uuid not null references public.intelligence_engine_runs(id) on delete cascade,
  primary_hypothesis_id uuid references public.intelligence_hypotheses(id) on delete set null,
  promoted_story_id uuid references public.stories(id) on delete set null,
  title text not null,
  thesis text not null,
  event_signature text not null,
  causal_mechanism text not null,
  affected_assets text[] not null default '{}',
  decisive_evidence_ids uuid[] not null default '{}',
  source_ancestry_group_ids uuid[] not null default '{}',
  confirmation_criteria text[] not null default '{}',
  invalidation_criteria text[] not null default '{}',
  next_catalysts text[] not null default '{}',
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  qualification_score numeric(6,3) not null check (qualification_score between 0 and 100),
  publication_eligible boolean not null default false,
  lifecycle_status text not null check (lifecycle_status in (
    'detected', 'developing', 'confirmed', 'weakening', 'invalidated', 'archived'
  )),
  novelty_fingerprint text not null,
  novelty_class text not null check (novelty_class in (
    'new_story', 'existing_story_update', 'duplicate', 'related_distinct', 'insufficient_novelty'
  )),
  duplicate_of_story_id uuid references public.stories(id) on delete set null,
  canonical_external_url text,
  research_synthesis text,
  candidate_status text not null default 'pending' check (candidate_status in ('pending', 'qualified', 'rejected', 'promoted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(engine_run_id, novelty_fingerprint)
);

alter table public.intelligence_story_states
  add column if not exists story_candidate_id uuid references public.intelligence_story_candidates(id) on delete set null;

alter table public.intelligence_challenger_assessments
  add constraint intelligence_challenger_stage_run_fk
  foreign key(stage_run_id) references public.intelligence_stage_runs(id) on delete set null;

create table if not exists public.intelligence_acquisition_failures (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  capability text not null,
  request_key text,
  failure_code text not null,
  failure_detail text not null,
  retryable boolean not null default false,
  request_metadata jsonb not null default '{}'::jsonb,
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  resolved_at timestamptz,
  occurrence_count integer not null default 1 check (occurrence_count > 0)
);

create index if not exists intelligence_acquisition_failures_open_idx
  on public.intelligence_acquisition_failures(provider_key, last_failed_at desc)
  where resolved_at is null;

create table if not exists public.intelligence_novelty_memory (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete set null,
  fingerprint text not null,
  event_signature text not null,
  thesis_signature text not null,
  mechanism_signature text not null,
  asset_signature text[] not null default '{}',
  decisive_evidence_signature text[] not null default '{}',
  source_independence_signature text[] not null default '{}',
  confirmation_signature text[] not null default '{}',
  invalidation_signature text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(fingerprint, story_id)
);

create index if not exists intelligence_novelty_memory_fingerprint_idx
  on public.intelligence_novelty_memory(fingerprint, last_seen_at desc);

create table if not exists public.intelligence_reevaluation_queue (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('story', 'hypothesis', 'theme', 'entity')),
  target_id uuid not null,
  requested_by_evidence_id uuid references public.intelligence_evidence(id) on delete set null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority smallint not null default 50 check (priority between 0 and 100),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists intelligence_reevaluation_queue_pending_uidx
  on public.intelligence_reevaluation_queue(target_kind, target_id, requested_by_evidence_id)
  where status in ('pending', 'processing');

create or replace function public.intelligence_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.intelligence_capture_story_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.intelligence_story_history (
    story_state_id, story_id, lifecycle_status, publication_eligible,
    novelty_class, qualification_score, change_reason, state_snapshot
  ) values (
    old.id, old.story_id, old.lifecycle_status, old.publication_eligible,
    old.novelty_class, old.qualification_score, 'state_updated', to_jsonb(old)
  );
  return new;
end;
$$;

create or replace function public.intelligence_enqueue_linked_reevaluation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_target_kind text;
  v_target_id uuid;
  v_evidence_id uuid;
begin
  if tg_table_name = 'intelligence_story_evidence' then
    v_target_kind := 'story';
    v_target_id := new.story_id;
    v_evidence_id := new.evidence_id;
  elsif tg_table_name = 'intelligence_hypothesis_evidence' then
    v_target_kind := 'hypothesis';
    v_target_id := new.hypothesis_id;
    v_evidence_id := new.evidence_id;
  elsif tg_table_name = 'intelligence_evidence_room_items' then
    select owner_kind, owner_id into v_target_kind, v_target_id
    from public.intelligence_evidence_rooms where id = new.room_id;
    v_evidence_id := new.evidence_id;
    if v_target_kind not in ('story', 'hypothesis', 'theme', 'entity') then
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.intelligence_reevaluation_queue (
    target_kind, target_id, requested_by_evidence_id, reason, priority
  )
  select v_target_kind, v_target_id, v_evidence_id, 'new_linked_evidence', 70
  where not exists (
    select 1 from public.intelligence_reevaluation_queue q
    where q.target_kind = v_target_kind
      and q.target_id = v_target_id
      and q.requested_by_evidence_id = v_evidence_id
      and q.status in ('pending', 'processing')
  );
  return new;
end;
$$;

create trigger intelligence_source_ancestry_groups_updated_at
before update on public.intelligence_source_ancestry_groups
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_evidence_sources_updated_at
before update on public.intelligence_evidence_sources
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_evidence_updated_at
before update on public.intelligence_evidence
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_entities_updated_at
before update on public.intelligence_entities
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_entity_relationships_updated_at
before update on public.intelligence_entity_relationships
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_themes_updated_at
before update on public.intelligence_themes
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_evidence_rooms_updated_at
before update on public.intelligence_evidence_rooms
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_market_beliefs_updated_at
before update on public.intelligence_market_beliefs
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_divergences_updated_at
before update on public.intelligence_divergences
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_hypotheses_updated_at
before update on public.intelligence_hypotheses
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_story_states_updated_at
before update on public.intelligence_story_states
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_story_candidates_updated_at
before update on public.intelligence_story_candidates
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_story_states_history
before update on public.intelligence_story_states
for each row when (old is distinct from new)
execute function public.intelligence_capture_story_history();
create trigger intelligence_reevaluation_queue_updated_at
before update on public.intelligence_reevaluation_queue
for each row execute function public.intelligence_set_updated_at();
create trigger intelligence_story_evidence_revaluate
after insert on public.intelligence_story_evidence
for each row execute function public.intelligence_enqueue_linked_reevaluation();
create trigger intelligence_hypothesis_evidence_revaluate
after insert on public.intelligence_hypothesis_evidence
for each row execute function public.intelligence_enqueue_linked_reevaluation();
create trigger intelligence_room_evidence_revaluate
after insert on public.intelligence_evidence_room_items
for each row execute function public.intelligence_enqueue_linked_reevaluation();

insert into public.intelligence_prompt_versions (stage_key, version, prompt_text, output_schema, model_hint, is_active)
values
  ('normalizer', 1, 'Normalize the supplied provider record into the canonical Alchemy Evidence Object. Preserve provenance and uncertainty. Never invent a value.', '{}'::jsonb, 'gpt-5-mini', true),
  ('entity_extractor', 1, 'Extract canonical entities and explicit relationships from evidence. Return only relationships supported by the supplied record.', '{}'::jsonb, 'gpt-5-mini', true),
  ('market_belief', 1, 'State the market belief that appears priced or broadly expected before considering the new divergence.', '{}'::jsonb, 'gpt-5-mini', true),
  ('divergence', 1, 'Identify material differences between observed evidence and the stated market belief. Do not force a divergence.', '{}'::jsonb, 'gpt-5-mini', true),
  ('hypothesis', 1, 'Generate testable causal hypotheses for material divergences, including affected assets, confirmation, invalidation and next catalysts.', '{}'::jsonb, 'gpt-5-mini', true),
  ('challenger', 1, 'Attack each hypothesis independently. Surface hidden assumptions, alternative mechanisms, missing evidence and the strongest countercase.', '{}'::jsonb, 'gpt-5-mini', true),
  ('story_synthesis', 1, 'Synthesize a first-party Alchemy Story only when the surviving hypothesis is useful, testable and sufficiently evidenced. An external canonical article URL is optional.', '{}'::jsonb, 'gpt-5-mini', true),
  ('semantic_deduplication', 1, 'Compare event, thesis, mechanism, assets, decisive evidence, source independence, catalyst, confirmation and invalidation. Prefer an update over a duplicate new Story.', '{}'::jsonb, 'gpt-5-mini', true),
  ('lifecycle', 1, 'Choose exactly one persistent Story lifecycle state: detected, developing, confirmed, weakening, invalidated or archived. Base the transition only on new evidence.', '{}'::jsonb, 'gpt-5-mini', true),
  ('positioning_recommender', 1, 'Assess COT and order-book evidence as one independent lens. State limitations and never treat positioning alone as proof of causality.', '{}'::jsonb, 'gpt-5-mini', true)
on conflict (stage_key, version) do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'intelligence_source_ancestry_groups', 'intelligence_evidence_sources',
    'intelligence_evidence', 'intelligence_entities', 'intelligence_entity_relationships',
    'intelligence_evidence_entities', 'intelligence_themes', 'intelligence_evidence_rooms',
    'intelligence_evidence_room_items', 'intelligence_market_beliefs', 'intelligence_divergences',
    'intelligence_hypotheses', 'intelligence_hypothesis_evidence',
    'intelligence_challenger_assessments', 'intelligence_story_states',
    'intelligence_story_evidence', 'intelligence_story_relations',
    'intelligence_story_history', 'intelligence_prompt_versions',
    'intelligence_engine_runs', 'intelligence_stage_runs', 'intelligence_story_candidates',
    'intelligence_acquisition_failures', 'intelligence_novelty_memory',
    'intelligence_reevaluation_queue'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

comment on table public.intelligence_evidence is
  'Canonical, provider-neutral Evidence Objects. Legacy public.evidence remains a UI compatibility projection.';
comment on table public.intelligence_story_states is
  'Persistent Alchemy-first lifecycle, novelty and publication qualification state for legacy public.stories.';
comment on table public.intelligence_acquisition_failures is
  'Visible provider failures; unavailable integrations must never be represented as successful empty data.';
