-- Append-only primary-data memory for deterministic specialist sensors.
--
-- This is intentionally narrow. It revives only the raw-source / normalised-
-- observation portion of the older unapplied V8 persistence proposal. It does
-- not create its Story-versioning, derived-metric, macro-vintage or revision
-- machinery and it does not rewrite existing production records.

create table if not exists public.raw_source_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete restrict,
  intake_item_id uuid references public.research_intake_items(id) on delete restrict,
  research_run_id uuid references public.research_runs(id) on delete restrict,
  supersedes_record_id uuid references public.raw_source_records(id) on delete restrict,
  ingestion_key text,
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

create unique index if not exists raw_source_records_provider_url_hash_uidx
  on public.raw_source_records(provider, source_url, content_hash);

create unique index if not exists raw_source_records_ingestion_key_uidx
  on public.raw_source_records(ingestion_key)
  where ingestion_key is not null;

create index if not exists raw_source_records_source_fetched_idx
  on public.raw_source_records(source_id, fetched_at desc);
create index if not exists raw_source_records_run_idx
  on public.raw_source_records(research_run_id, fetched_at desc);
create index if not exists raw_source_records_provider_fetched_idx
  on public.raw_source_records(provider, fetched_at desc);

create table if not exists public.normalised_observations (
  id uuid primary key default gen_random_uuid(),
  raw_record_id uuid not null references public.raw_source_records(id) on delete restrict,
  source_id uuid references public.sources(id) on delete restrict,
  story_id uuid references public.stories(id) on delete restrict,
  supersedes_observation_id uuid references public.normalised_observations(id) on delete restrict,
  observation_type text not null,
  subject_type text not null,
  subject_key text not null,
  observed_at timestamptz not null,
  effective_at timestamptz,
  value jsonb not null,
  unit text,
  confidence integer not null default 50 check (confidence between 0 and 100),
  is_preliminary boolean not null default false,
  methodology_version text not null default 'sensor-v1',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- A retry of the exact same normaliser against the exact same immutable raw
-- record must not create duplicate normalized rows.
create unique index if not exists normalised_observations_raw_identity_uidx
  on public.normalised_observations(
    raw_record_id,
    observation_type,
    subject_type,
    subject_key,
    observed_at,
    methodology_version
  );

create index if not exists normalised_observations_subject_time_idx
  on public.normalised_observations(
    observation_type,
    subject_type,
    subject_key,
    observed_at desc,
    created_at desc
  );
create index if not exists normalised_observations_story_time_idx
  on public.normalised_observations(story_id, observed_at desc)
  where story_id is not null;
create index if not exists normalised_observations_raw_idx
  on public.normalised_observations(raw_record_id);

-- Preserve the original architecture bridge now that the raw/observation
-- tables actually exist in production schema. Both columns already exist on
-- current deployments; the FKs are added only if absent.
do $$
begin
  if to_regclass('public.intelligence_evidence') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'intelligence_evidence'
        and column_name = 'raw_source_record_id'
    )
    and not exists (
      select 1 from pg_constraint
      where conname = 'intelligence_evidence_raw_source_record_id_fkey'
        and conrelid = 'public.intelligence_evidence'::regclass
    ) then
    alter table public.intelligence_evidence
      add constraint intelligence_evidence_raw_source_record_id_fkey
      foreign key (raw_source_record_id)
      references public.raw_source_records(id)
      on delete set null;
  end if;

  if to_regclass('public.story_events') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'story_events'
        and column_name = 'observation_id'
    )
    and not exists (
      select 1 from pg_constraint
      where conname = 'story_events_observation_id_fkey'
        and conrelid = 'public.story_events'::regclass
    ) then
    alter table public.story_events
      add constraint story_events_observation_id_fkey
      foreign key (observation_id)
      references public.normalised_observations(id)
      on delete set null;
  end if;
end
$$;

create or replace function public.prevent_sensor_memory_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; add a superseding record instead', tg_table_name
    using errcode = '55000';
end;
$$;

drop trigger if exists raw_source_records_append_only on public.raw_source_records;
create trigger raw_source_records_append_only
before update or delete on public.raw_source_records
for each row execute function public.prevent_sensor_memory_mutation();

drop trigger if exists normalised_observations_append_only on public.normalised_observations;
create trigger normalised_observations_append_only
before update or delete on public.normalised_observations
for each row execute function public.prevent_sensor_memory_mutation();

alter table public.raw_source_records enable row level security;
alter table public.normalised_observations enable row level security;

revoke all on table public.raw_source_records from anon, authenticated;
revoke all on table public.normalised_observations from anon, authenticated;
grant all on table public.raw_source_records to service_role;
grant all on table public.normalised_observations to service_role;

revoke all on function public.prevent_sensor_memory_mutation() from public, anon, authenticated;
grant execute on function public.prevent_sensor_memory_mutation() to service_role;

comment on table public.raw_source_records is
  'Immutable canonical raw records for specialist and primary-data sensors. Identical provider+URL+content is deduplicated; changed payloads append.';
comment on table public.normalised_observations is
  'Append-only normalized sensor observation versions. A changed reading supersedes, rather than overwrites, the previous reading for the same identity.';
comment on column public.normalised_observations.subject_key is
  'Stable series/entity identity excluding time; observed_at carries the source observation period or event timestamp.';
