-- Minimal current-schema fixture for isolated MRU P1/P2 migration testing.
--
-- This is intentionally not a replacement for the historical migration chain.
-- The repository contains legacy migrations that cannot bootstrap a blank DB
-- independently. This fixture models only the production tables/columns that
-- P1/P2 depend on, then seeds representative rows so their backfill, trigger,
-- provenance and entity-link contracts execute against real data paths.

begin;

create schema if not exists auth;
create schema if not exists extensions;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  thesis text not null,
  status text not null default 'monitor',
  confidence integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.macro_releases (
  id text primary key,
  series_key text not null,
  release_name text not null,
  agency text not null,
  category text not null,
  release_date timestamptz not null,
  release_time_label text not null,
  reference_period text,
  frequency text not null default 'Monthly',
  status text not null default 'upcoming',
  actual text,
  consensus text,
  previous text,
  revised_previous text,
  unit text,
  surprise_direction text,
  market_interpretation text,
  watch_question text not null,
  confirmation_trigger text,
  invalidation_trigger text,
  source_url text not null,
  source_classification text not null default 'official_government',
  affected_assets text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  actual_retrieved_at timestamptz
);

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  schedule_slot text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.research_intake_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  item_key text not null unique,
  item_type text not null,
  publisher text not null,
  external_id text,
  title text not null,
  url text not null,
  published_at timestamptz not null,
  article_position integer,
  transcript_status text,
  transcript_text text,
  summary text not null,
  affected_story_slugs text[] not null default '{}',
  source_quality integer not null,
  relevance integer not null,
  novelty integer not null,
  materiality integer not null,
  candidate_score integer not null,
  recommended_action text not null,
  status text not null default 'candidate',
  stats_signal text,
  news_signal text,
  divergence_kind text not null default 'none',
  divergence_note text,
  evidence_links jsonb not null default '[]'::jsonb,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  transcript_provider text,
  video_review_status text,
  creator_logic text,
  recontextualized_summary text,
  terms_detected text[] not null default '{}',
  jargon_research jsonb not null default '[]'::jsonb,
  claim_checks jsonb not null default '[]'::jsonb,
  expert_notes jsonb not null default '[]'::jsonb,
  freshness_score integer not null default 0,
  transcript_language text,
  transcript_segments jsonb not null default '[]'::jsonb,
  transcript_retrieved_at timestamptz,
  transcript_error_code text,
  transcript_error_message text,
  transcript_http_status integer,
  transcript_retryable boolean,
  transcript_attempted_at timestamptz,
  transcript_attempt_count integer not null default 0,
  transcript_duration_seconds integer,
  transcript_metadata jsonb not null default '{}'::jsonb
);

create table public.raw_source_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid,
  intake_item_id uuid,
  research_run_id uuid,
  supersedes_record_id uuid references public.raw_source_records(id) on delete set null,
  ingestion_key text unique,
  provider text not null,
  source_url text not null,
  source_type text not null,
  content_type text,
  content_hash text not null,
  content_text text,
  payload jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  observed_at timestamptz,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.normalised_observations (
  id uuid primary key default gen_random_uuid(),
  raw_record_id uuid not null references public.raw_source_records(id) on delete restrict,
  source_id uuid,
  story_id uuid,
  supersedes_observation_id uuid references public.normalised_observations(id) on delete set null,
  observation_type text not null,
  subject_type text not null,
  subject_key text not null,
  observed_at timestamptz not null,
  effective_at timestamptz,
  value jsonb not null,
  unit text,
  confidence integer not null default 50,
  is_preliminary boolean not null default false,
  methodology_version text not null default 'sensor-v1',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.intelligence_evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  raw_source_record_id uuid,
  research_run_id uuid,
  external_evidence_id text,
  evidence_class text not null,
  support_direction text not null default 'neutral',
  claim_text text not null,
  summary text,
  event_at timestamptz,
  published_at timestamptz,
  available_at timestamptz,
  received_at timestamptz not null default now(),
  geography text,
  affected_assets text[] not null default '{}',
  affected_topics text[] not null default '{}',
  confidence numeric(5,2) not null default 50,
  freshness_status text not null default 'current',
  content_hash text not null,
  provenance_urls text[] not null default '{}',
  structured_payload jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  normalizer_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intelligence_entities (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  entity_type text not null,
  canonical_name text not null,
  aliases text[] not null default '{}',
  identifiers jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intelligence_entity_relationships (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid not null references public.intelligence_entities(id) on delete cascade,
  relationship_type text not null,
  to_entity_id uuid not null references public.intelligence_entities(id) on delete cascade,
  direction text not null default 'directed',
  confidence numeric(5,2) not null default 50,
  valid_from timestamptz,
  valid_to timestamptz,
  evidence_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(from_entity_id, relationship_type, to_entity_id)
);

create table public.intelligence_evidence_entities (
  evidence_id uuid not null references public.intelligence_evidence(id) on delete cascade,
  entity_id uuid not null references public.intelligence_entities(id) on delete cascade,
  relationship_role text not null default 'mentioned',
  salience numeric(5,2) not null default 50,
  created_at timestamptz not null default now(),
  primary key(evidence_id, entity_id, relationship_role)
);

create table public.intelligence_story_evidence (
  story_id uuid not null references public.stories(id) on delete cascade,
  evidence_id uuid not null references public.intelligence_evidence(id) on delete cascade,
  evidence_role text not null,
  weight numeric(5,2) not null default 50,
  rationale text,
  linked_at timestamptz not null default now(),
  primary key(story_id, evidence_id, evidence_role)
);

create table public.story_thesis_versions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.stories (id, slug, title, thesis, status, confidence)
values (
  '11111111-1111-4111-8111-111111111111',
  'fixture-story',
  'Fixture Story',
  'Representative MRU migration fixture.',
  'developing',
  70
);

insert into public.macro_releases (
  id, series_key, release_name, agency, category, release_date,
  release_time_label, reference_period, status, actual, consensus, previous,
  source_url, watch_question, affected_assets, published_at, released_at,
  actual_retrieved_at
) values (
  'fixture-cpi', 'us-cpi', 'US CPI', 'BLS', 'inflation',
  '2026-09-11T12:30:00Z', '08:30 ET', 'August 2026', 'released',
  '2.8%', '2.7%', '2.6%', 'https://example.invalid/bls-cpi',
  'Does inflation reaccelerate?', array['SPX','UST10Y'],
  '2026-09-11T12:30:00Z', '2026-09-11T12:30:00Z', '2026-09-11T12:31:00Z'
);

insert into public.research_runs (id, run_key, schedule_slot, scheduled_for)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'fixture-run',
  'manual',
  '2026-09-08T10:00:00Z'
);

insert into public.research_intake_items (
  id, run_id, item_key, item_type, publisher, title, url, published_at,
  transcript_status, transcript_text, summary, recontextualized_summary,
  affected_story_slugs, source_quality, relevance, novelty, materiality,
  candidate_score, freshness_score, recommended_action, status,
  stats_signal, news_signal, divergence_kind, divergence_note, evidence_links,
  claim_checks, expert_notes, video_review_status, transcript_provider,
  transcript_language
) values (
  '22222222-2222-4222-8222-222222222222',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'fixture-intake',
  'news',
  'Fixture Wire',
  'Fixture evidence item',
  'https://example.invalid/fixture-evidence',
  '2026-09-08T10:01:00Z',
  'not_applicable',
  null,
  'Representative evidence used to exercise P2 provenance backfill.',
  'Representative evidence used to exercise P2 provenance backfill.',
  array['fixture-story'],
  85, 90, 75, 80, 84, 95,
  'collect_evidence',
  'accepted',
  'CPI firming',
  'Rates repricing',
  'stats_lead',
  'Fixture divergence',
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'reviewed',
  'official',
  'en'
);

insert into public.intelligence_evidence (
  id, source_id, research_run_id, external_evidence_id, evidence_class,
  support_direction, claim_text, summary, affected_assets, affected_topics,
  confidence, content_hash, normalizer_version
) values (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'research-intake:22222222-2222-4222-8222-222222222222',
  'news_report',
  'supports',
  'Fixture evidence supports the Story.',
  'Representative canonical Evidence row.',
  array['SPX','UST10Y'],
  array['inflation','rates'],
  85,
  'fixture-content-hash',
  'fixture-v1'
);

insert into public.intelligence_story_evidence (
  story_id, evidence_id, evidence_role, weight, rationale
) values (
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  'supporting',
  80,
  'Fixture story/evidence link.'
);

insert into public.story_thesis_versions (
  id, story_id, version_number, snapshot
) values (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  1,
  jsonb_build_object(
    'reasoning', jsonb_build_object(
      'claims', jsonb_build_array(
        jsonb_build_object(
          'id', 'fixture-claim',
          'type', 'support',
          'text', 'Fixture claim with canonical Evidence lineage.',
          'evidenceIds', jsonb_build_array('33333333-3333-4333-8333-333333333333')
        )
      )
    )
  )
);

commit;
