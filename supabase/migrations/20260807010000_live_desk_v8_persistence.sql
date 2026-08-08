-- Alchemy Live Desk V8 persistence foundation
-- Additive only. This migration does not drop or rename existing objects.
-- It is intentionally not applied by this pull request.

begin;

create table if not exists public.raw_source_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  intake_item_id uuid references public.research_intake_items(id) on delete set null,
  research_run_id uuid references public.research_runs(id) on delete set null,
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
  created_by uuid default auth.uid(),
  constraint raw_source_records_provider_hash_key unique (provider, content_hash),
  constraint raw_source_records_ingestion_key_key unique nulls not distinct (ingestion_key)
);

create table if not exists public.normalised_observations (
  id uuid primary key default gen_random_uuid(),
  raw_record_id uuid not null references public.raw_source_records(id) on delete restrict,
  source_id uuid references public.sources(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
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
  methodology_version text not null default 'v1',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.story_events (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  source_id uuid references public.sources(id) on delete set null,
  evidence_id uuid references public.evidence(id) on delete set null,
  observation_id uuid references public.normalised_observations(id) on delete set null,
  research_run_id uuid references public.research_runs(id) on delete set null,
  legacy_update_id uuid unique references public.story_updates(id) on delete set null,
  event_type text not null check (event_type in (
    'headline_update',
    'evidence_update',
    'contradiction',
    'confirmation',
    'invalidation',
    'catalyst',
    'thesis_revision',
    'archive',
    'reopen',
    'correction',
    'source_update'
  )),
  headline text not null,
  detail text,
  impact text check (impact is null or impact in ('supports', 'contradicts', 'amplifies', 'neutral', 'stale')),
  confidence_delta integer check (confidence_delta is null or confidence_delta between -100 and 100),
  event_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid()
);

create table if not exists public.story_thesis_versions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  event_id uuid references public.story_events(id) on delete set null,
  version_number integer not null check (version_number > 0),
  title text not null,
  thesis text not null,
  status text not null,
  confidence integer not null check (confidence between 0 and 100),
  market_question text,
  dominant_narrative text,
  best_explanation text,
  strongest_support text,
  strongest_contradiction text,
  priced_assessment text,
  confirmation_trigger text,
  invalidation_trigger text,
  next_catalyst text,
  article_angle text,
  provisional_title text,
  article_verdict text,
  assets text[] not null default '{}'::text[],
  portfolio_map jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  change_reason text not null,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint story_thesis_versions_story_version_key unique (story_id, version_number)
);

create table if not exists public.derived_metric_versions (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  subject_type text not null,
  subject_key text not null,
  story_id uuid references public.stories(id) on delete set null,
  methodology_version text not null,
  as_of timestamptz not null,
  value numeric,
  value_json jsonb not null default '{}'::jsonb,
  unit text,
  input_observation_ids uuid[] not null default '{}'::uuid[],
  calculation jsonb not null default '{}'::jsonb,
  source_freshness jsonb not null default '{}'::jsonb,
  is_stale boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint derived_metric_versions_identity_key unique (metric_key, subject_type, subject_key, methodology_version, as_of)
);

create table if not exists public.macro_release_vintages (
  id uuid primary key default gen_random_uuid(),
  macro_release_id text not null references public.macro_releases(id) on delete restrict,
  source_id uuid references public.sources(id) on delete set null,
  raw_record_id uuid references public.raw_source_records(id) on delete set null,
  supersedes_vintage_id uuid references public.macro_release_vintages(id) on delete restrict,
  vintage_number integer not null check (vintage_number > 0),
  actual text,
  consensus text,
  previous text,
  revised_previous text,
  surprise jsonb not null default '{}'::jsonb,
  decisive_component text,
  interpretation jsonb not null default '{}'::jsonb,
  source_url text not null,
  published_at timestamptz,
  received_at timestamptz not null default now(),
  is_initial boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint macro_release_vintages_release_version_key unique (macro_release_id, vintage_number)
);

create table if not exists public.record_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id text not null,
  action text not null check (action in ('correction', 'supersession', 'invalidation', 'manual_override', 'restoration')),
  previous_record_table text,
  previous_record_id text,
  replacement_record_table text,
  replacement_record_id text,
  reason text not null,
  previous_value jsonb,
  new_value jsonb,
  recorded_at timestamptz not null default now(),
  recorded_by uuid default auth.uid(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.stories
  add column if not exists current_thesis_version_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stories_current_thesis_version_id_fkey'
      and conrelid = 'public.stories'::regclass
  ) then
    alter table public.stories
      add constraint stories_current_thesis_version_id_fkey
      foreign key (current_thesis_version_id)
      references public.story_thesis_versions(id)
      on delete set null;
  end if;
end
$$;

create index if not exists raw_source_records_source_fetched_idx
  on public.raw_source_records (source_id, fetched_at desc);
create index if not exists raw_source_records_run_idx
  on public.raw_source_records (research_run_id, fetched_at desc);
create index if not exists raw_source_records_url_idx
  on public.raw_source_records (source_url);

create index if not exists normalised_observations_subject_time_idx
  on public.normalised_observations (subject_type, subject_key, observed_at desc);
create index if not exists normalised_observations_story_time_idx
  on public.normalised_observations (story_id, observed_at desc)
  where story_id is not null;
create index if not exists normalised_observations_raw_idx
  on public.normalised_observations (raw_record_id);

create index if not exists story_events_story_time_idx
  on public.story_events (story_id, event_at desc, recorded_at desc);
create index if not exists story_events_type_time_idx
  on public.story_events (event_type, event_at desc);
create index if not exists story_events_source_idx
  on public.story_events (source_id)
  where source_id is not null;

create index if not exists story_thesis_versions_story_time_idx
  on public.story_thesis_versions (story_id, version_number desc, effective_at desc);
create index if not exists story_thesis_versions_event_idx
  on public.story_thesis_versions (event_id)
  where event_id is not null;

create index if not exists derived_metric_versions_lookup_idx
  on public.derived_metric_versions (metric_key, subject_type, subject_key, as_of desc);
create index if not exists derived_metric_versions_story_idx
  on public.derived_metric_versions (story_id, as_of desc)
  where story_id is not null;

create index if not exists macro_release_vintages_release_idx
  on public.macro_release_vintages (macro_release_id, vintage_number desc, received_at desc);

create index if not exists record_revisions_entity_idx
  on public.record_revisions (entity_table, entity_id, recorded_at desc);

create or replace function public.prevent_immutable_research_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; add a superseding record or revision instead', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger raw_source_records_append_only
before update or delete on public.raw_source_records
for each row execute function public.prevent_immutable_research_mutation();

create trigger normalised_observations_append_only
before update or delete on public.normalised_observations
for each row execute function public.prevent_immutable_research_mutation();

create trigger story_events_append_only
before update or delete on public.story_events
for each row execute function public.prevent_immutable_research_mutation();

create trigger story_thesis_versions_append_only
before update or delete on public.story_thesis_versions
for each row execute function public.prevent_immutable_research_mutation();

create trigger derived_metric_versions_append_only
before update or delete on public.derived_metric_versions
for each row execute function public.prevent_immutable_research_mutation();

create trigger macro_release_vintages_append_only
before update or delete on public.macro_release_vintages
for each row execute function public.prevent_immutable_research_mutation();

create trigger record_revisions_append_only
before update or delete on public.record_revisions
for each row execute function public.prevent_immutable_research_mutation();

insert into public.story_events (
  story_id,
  legacy_update_id,
  event_type,
  headline,
  detail,
  event_at,
  recorded_at,
  metadata
)
select
  su.story_id,
  su.id,
  case
    when su.update_type in ('contradiction', 'confirmation', 'invalidation', 'catalyst', 'archive', 'reopen', 'thesis_revision') then su.update_type
    when su.update_type = 'evidence' then 'evidence_update'
    else 'headline_update'
  end,
  su.headline,
  su.detail,
  coalesce(su.observed_at, su.published_at, su.created_at),
  su.created_at,
  jsonb_build_object('legacy_update_type', su.update_type, 'backfilled', true)
from public.story_updates su
on conflict (legacy_update_id) do nothing;

insert into public.story_thesis_versions (
  story_id,
  version_number,
  title,
  thesis,
  status,
  confidence,
  market_question,
  dominant_narrative,
  best_explanation,
  strongest_support,
  strongest_contradiction,
  priced_assessment,
  confirmation_trigger,
  invalidation_trigger,
  next_catalyst,
  article_angle,
  provisional_title,
  article_verdict,
  assets,
  snapshot,
  change_reason,
  effective_at,
  created_at
)
select
  s.id,
  1,
  s.title,
  s.thesis,
  s.status,
  s.confidence,
  s.market_question,
  s.dominant_narrative,
  s.best_explanation,
  s.strongest_support,
  s.strongest_contradiction,
  s.priced_assessment,
  s.confirmation_trigger,
  s.invalidation_trigger,
  s.next_catalyst,
  s.article_angle,
  s.provisional_title,
  s.article_verdict,
  s.assets,
  to_jsonb(s),
  'baseline_from_existing_story',
  coalesce(s.updated_at, s.created_at),
  s.created_at
from public.stories s
on conflict (story_id, version_number) do nothing;

update public.stories s
set current_thesis_version_id = v.id
from public.story_thesis_versions v
where v.story_id = s.id
  and v.version_number = 1
  and s.current_thesis_version_id is null;

create or replace function public.capture_story_thesis_version()
returns trigger
language plpgsql
as $$
declare
  next_version integer;
  new_version_id uuid;
  revision_event_id uuid;
begin
  if tg_op = 'UPDATE' and row(
    new.title,
    new.thesis,
    new.status,
    new.confidence,
    new.market_question,
    new.dominant_narrative,
    new.best_explanation,
    new.strongest_support,
    new.strongest_contradiction,
    new.priced_assessment,
    new.confirmation_trigger,
    new.invalidation_trigger,
    new.next_catalyst,
    new.article_angle,
    new.provisional_title,
    new.article_verdict,
    new.assets
  ) is not distinct from row(
    old.title,
    old.thesis,
    old.status,
    old.confidence,
    old.market_question,
    old.dominant_narrative,
    old.best_explanation,
    old.strongest_support,
    old.strongest_contradiction,
    old.priced_assessment,
    old.confirmation_trigger,
    old.invalidation_trigger,
    old.next_catalyst,
    old.article_angle,
    old.provisional_title,
    old.article_verdict,
    old.assets
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.story_thesis_versions
  where story_id = new.id;

  if tg_op = 'UPDATE' then
    insert into public.story_events (
      story_id,
      event_type,
      headline,
      detail,
      event_at,
      metadata
    ) values (
      new.id,
      'thesis_revision',
      format('Story thesis version %s recorded', next_version),
      'A thesis-bearing Story field changed. The complete prior version remains preserved.',
      now(),
      jsonb_build_object('automatic', true, 'previous_version_id', old.current_thesis_version_id)
    )
    returning id into revision_event_id;
  end if;

  insert into public.story_thesis_versions (
    story_id,
    event_id,
    version_number,
    title,
    thesis,
    status,
    confidence,
    market_question,
    dominant_narrative,
    best_explanation,
    strongest_support,
    strongest_contradiction,
    priced_assessment,
    confirmation_trigger,
    invalidation_trigger,
    next_catalyst,
    article_angle,
    provisional_title,
    article_verdict,
    assets,
    snapshot,
    change_reason,
    effective_at
  ) values (
    new.id,
    revision_event_id,
    next_version,
    new.title,
    new.thesis,
    new.status,
    new.confidence,
    new.market_question,
    new.dominant_narrative,
    new.best_explanation,
    new.strongest_support,
    new.strongest_contradiction,
    new.priced_assessment,
    new.confirmation_trigger,
    new.invalidation_trigger,
    new.next_catalyst,
    new.article_angle,
    new.provisional_title,
    new.article_verdict,
    new.assets,
    to_jsonb(new),
    case when tg_op = 'INSERT' then 'story_created' else 'story_updated' end,
    now()
  )
  returning id into new_version_id;

  update public.stories
  set current_thesis_version_id = new_version_id
  where id = new.id
    and current_thesis_version_id is distinct from new_version_id;

  return new;
end;
$$;

create trigger stories_capture_thesis_version
after insert or update on public.stories
for each row execute function public.capture_story_thesis_version();

alter table public.raw_source_records enable row level security;
alter table public.normalised_observations enable row level security;
alter table public.story_events enable row level security;
alter table public.story_thesis_versions enable row level security;
alter table public.derived_metric_versions enable row level security;
alter table public.macro_release_vintages enable row level security;
alter table public.record_revisions enable row level security;

create policy public_read_normalised_observations
  on public.normalised_observations for select to public using (true);
create policy public_read_story_events
  on public.story_events for select to public using (true);
create policy public_read_story_thesis_versions
  on public.story_thesis_versions for select to public using (true);
create policy public_read_derived_metric_versions
  on public.derived_metric_versions for select to public using (true);
create policy public_read_macro_release_vintages
  on public.macro_release_vintages for select to public using (true);
create policy authenticated_read_record_revisions
  on public.record_revisions for select to authenticated using (true);

revoke all on public.raw_source_records from anon, authenticated;
grant select on public.normalised_observations to anon, authenticated;
grant select on public.story_events to anon, authenticated;
grant select on public.story_thesis_versions to anon, authenticated;
grant select on public.derived_metric_versions to anon, authenticated;
grant select on public.macro_release_vintages to anon, authenticated;
grant select on public.record_revisions to authenticated;

create or replace view public.current_story_thesis_versions
with (security_invoker = true)
as
select distinct on (story_id)
  id,
  story_id,
  event_id,
  version_number,
  title,
  thesis,
  status,
  confidence,
  market_question,
  dominant_narrative,
  best_explanation,
  strongest_support,
  strongest_contradiction,
  priced_assessment,
  confirmation_trigger,
  invalidation_trigger,
  next_catalyst,
  article_angle,
  provisional_title,
  article_verdict,
  assets,
  portfolio_map,
  snapshot,
  change_reason,
  effective_at,
  created_at,
  created_by
from public.story_thesis_versions
order by story_id, version_number desc, effective_at desc;

grant select on public.current_story_thesis_versions to anon, authenticated;

comment on table public.raw_source_records is 'Immutable raw source payloads. Corrections append a superseding record.';
comment on table public.normalised_observations is 'Immutable structured observations derived from raw source records.';
comment on table public.story_events is 'Append-only material event history for each persistent Story.';
comment on table public.story_thesis_versions is 'Immutable Story thesis snapshots. The latest version is selected by version number.';
comment on table public.derived_metric_versions is 'Versioned derived calculations with explicit inputs and methodology.';
comment on table public.macro_release_vintages is 'Append-only release vintages preserving initial and revised values.';
comment on table public.record_revisions is 'Append-only correction, invalidation and manual-override ledger.';

commit;
