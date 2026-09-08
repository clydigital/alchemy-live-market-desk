-- Close the remaining durable-research-memory gaps without changing existing Live/Hybrid read contracts.
-- Existing mutable/current tables remain convenience projections; immutable history is appended behind them.

begin;

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
  constraint derived_metric_versions_identity_key
    unique (metric_key, subject_type, subject_key, methodology_version, as_of)
);

create table if not exists public.macro_release_vintages (
  id uuid primary key default gen_random_uuid(),
  macro_release_id text not null references public.macro_releases(id) on delete restrict,
  supersedes_vintage_id uuid references public.macro_release_vintages(id) on delete restrict,
  vintage_number integer not null check (vintage_number > 0),
  actual text,
  consensus text,
  previous text,
  revised_previous text,
  status text not null,
  source_url text not null,
  release_date timestamptz not null,
  reference_period text,
  published_at timestamptz,
  released_at timestamptz,
  actual_retrieved_at timestamptz,
  received_at timestamptz not null default now(),
  is_initial boolean not null default false,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint macro_release_vintages_release_version_key
    unique (macro_release_id, vintage_number)
);

create table if not exists public.record_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id text not null,
  action text not null check (action in (
    'correction',
    'supersession',
    'invalidation',
    'manual_override',
    'restoration'
  )),
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

create index if not exists derived_metric_versions_lookup_idx
  on public.derived_metric_versions (metric_key, subject_type, subject_key, as_of desc);
create index if not exists derived_metric_versions_story_idx
  on public.derived_metric_versions (story_id, as_of desc)
  where story_id is not null;
create index if not exists macro_release_vintages_release_idx
  on public.macro_release_vintages (macro_release_id, vintage_number desc, received_at desc);
create index if not exists macro_release_vintages_supersedes_idx
  on public.macro_release_vintages (supersedes_vintage_id)
  where supersedes_vintage_id is not null;
create index if not exists record_revisions_entity_idx
  on public.record_revisions (entity_table, entity_id, recorded_at desc);

create or replace function public.prevent_durable_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; add a superseding record or revision instead', tg_table_name
    using errcode = '55000';
end;
$$;

revoke all on function public.prevent_durable_history_mutation() from public, anon, authenticated;
grant execute on function public.prevent_durable_history_mutation() to service_role;

drop trigger if exists derived_metric_versions_append_only on public.derived_metric_versions;
create trigger derived_metric_versions_append_only
before update or delete on public.derived_metric_versions
for each row execute function public.prevent_durable_history_mutation();

drop trigger if exists macro_release_vintages_append_only on public.macro_release_vintages;
create trigger macro_release_vintages_append_only
before update or delete on public.macro_release_vintages
for each row execute function public.prevent_durable_history_mutation();

drop trigger if exists record_revisions_append_only on public.record_revisions;
create trigger record_revisions_append_only
before update or delete on public.record_revisions
for each row execute function public.prevent_durable_history_mutation();

alter table public.derived_metric_versions enable row level security;
alter table public.macro_release_vintages enable row level security;
alter table public.record_revisions enable row level security;

revoke all on table public.derived_metric_versions from anon, authenticated;
revoke all on table public.macro_release_vintages from anon, authenticated;
revoke all on table public.record_revisions from anon, authenticated;

grant select on table public.derived_metric_versions to anon, authenticated;
grant select on table public.macro_release_vintages to anon, authenticated;
grant select on table public.record_revisions to authenticated;
grant all on table public.derived_metric_versions to service_role;
grant all on table public.macro_release_vintages to service_role;
grant all on table public.record_revisions to service_role;

drop policy if exists public_read_derived_metric_versions on public.derived_metric_versions;
create policy public_read_derived_metric_versions
  on public.derived_metric_versions
  for select
  to anon, authenticated
  using (true);

drop policy if exists public_read_macro_release_vintages on public.macro_release_vintages;
create policy public_read_macro_release_vintages
  on public.macro_release_vintages
  for select
  to anon, authenticated
  using (true);

drop policy if exists authenticated_read_record_revisions on public.record_revisions;
create policy authenticated_read_record_revisions
  on public.record_revisions
  for select
  to authenticated
  using (true);

-- Preserve the current macro-release row as a convenience projection, but make every
-- data-bearing release state reconstructible from an immutable vintage sequence.
insert into public.macro_release_vintages (
  macro_release_id,
  vintage_number,
  actual,
  consensus,
  previous,
  revised_previous,
  status,
  source_url,
  release_date,
  reference_period,
  published_at,
  released_at,
  actual_retrieved_at,
  received_at,
  is_initial,
  snapshot
)
select
  release.id,
  1,
  release.actual,
  release.consensus,
  release.previous,
  release.revised_previous,
  release.status,
  release.source_url,
  release.release_date,
  release.reference_period,
  release.published_at,
  release.released_at,
  release.actual_retrieved_at,
  coalesce(release.actual_retrieved_at, release.published_at, release.updated_at, release.created_at, now()),
  true,
  to_jsonb(release)
from public.macro_releases release
on conflict (macro_release_id, vintage_number) do nothing;

create or replace function public.mark_macro_release_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.actual is not null
     and new.actual is distinct from old.actual then
    new.status := 'revision_detected';
  end if;
  return new;
end;
$$;

revoke all on function public.mark_macro_release_revision() from public, anon, authenticated;
grant execute on function public.mark_macro_release_revision() to service_role;

drop trigger if exists macro_releases_mark_revision on public.macro_releases;
create trigger macro_releases_mark_revision
before update of actual on public.macro_releases
for each row execute function public.mark_macro_release_revision();

create or replace function public.capture_macro_release_vintage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_vintage_id uuid;
  previous_vintage_number integer;
  new_vintage_id uuid;
begin
  if tg_op = 'UPDATE' and row(
    new.actual,
    new.consensus,
    new.previous,
    new.revised_previous,
    new.source_url,
    new.release_date,
    new.reference_period,
    new.published_at,
    new.released_at,
    new.actual_retrieved_at,
    new.surprise_direction,
    new.market_interpretation
  ) is not distinct from row(
    old.actual,
    old.consensus,
    old.previous,
    old.revised_previous,
    old.source_url,
    old.release_date,
    old.reference_period,
    old.published_at,
    old.released_at,
    old.actual_retrieved_at,
    old.surprise_direction,
    old.market_interpretation
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id, 0));

  select vintage.id, vintage.vintage_number
  into previous_vintage_id, previous_vintage_number
  from public.macro_release_vintages vintage
  where vintage.macro_release_id = new.id
  order by vintage.vintage_number desc
  limit 1;

  insert into public.macro_release_vintages (
    macro_release_id,
    supersedes_vintage_id,
    vintage_number,
    actual,
    consensus,
    previous,
    revised_previous,
    status,
    source_url,
    release_date,
    reference_period,
    published_at,
    released_at,
    actual_retrieved_at,
    received_at,
    is_initial,
    snapshot
  ) values (
    new.id,
    previous_vintage_id,
    coalesce(previous_vintage_number, 0) + 1,
    new.actual,
    new.consensus,
    new.previous,
    new.revised_previous,
    new.status,
    new.source_url,
    new.release_date,
    new.reference_period,
    new.published_at,
    new.released_at,
    new.actual_retrieved_at,
    coalesce(new.actual_retrieved_at, new.updated_at, now()),
    previous_vintage_id is null,
    to_jsonb(new)
  )
  returning id into new_vintage_id;

  if previous_vintage_id is not null then
    insert into public.record_revisions (
      entity_table,
      entity_id,
      action,
      previous_record_table,
      previous_record_id,
      replacement_record_table,
      replacement_record_id,
      reason,
      previous_value,
      new_value,
      metadata
    ) values (
      'macro_releases',
      new.id,
      'supersession',
      'macro_release_vintages',
      previous_vintage_id::text,
      'macro_release_vintages',
      new_vintage_id::text,
      case
        when old.actual is not null and new.actual is distinct from old.actual
          then 'official_actual_revision'
        else 'macro_release_data_change'
      end,
      jsonb_build_object(
        'actual', old.actual,
        'consensus', old.consensus,
        'previous', old.previous,
        'revised_previous', old.revised_previous,
        'source_url', old.source_url,
        'release_date', old.release_date,
        'reference_period', old.reference_period,
        'published_at', old.published_at,
        'released_at', old.released_at,
        'actual_retrieved_at', old.actual_retrieved_at,
        'surprise_direction', old.surprise_direction,
        'market_interpretation', old.market_interpretation
      ),
      jsonb_build_object(
        'actual', new.actual,
        'consensus', new.consensus,
        'previous', new.previous,
        'revised_previous', new.revised_previous,
        'source_url', new.source_url,
        'release_date', new.release_date,
        'reference_period', new.reference_period,
        'published_at', new.published_at,
        'released_at', new.released_at,
        'actual_retrieved_at', new.actual_retrieved_at,
        'surprise_direction', new.surprise_direction,
        'market_interpretation', new.market_interpretation
      ),
      jsonb_build_object(
        'automatic', true,
        'previous_vintage_number', previous_vintage_number,
        'replacement_vintage_number', coalesce(previous_vintage_number, 0) + 1
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.capture_macro_release_vintage() from public, anon, authenticated;
grant execute on function public.capture_macro_release_vintage() to service_role;

drop trigger if exists macro_releases_capture_vintage on public.macro_releases;
create trigger macro_releases_capture_vintage
after insert or update of
  actual,
  consensus,
  previous,
  revised_previous,
  source_url,
  release_date,
  reference_period,
  published_at,
  released_at,
  actual_retrieved_at,
  surprise_direction,
  market_interpretation
on public.macro_releases
for each row execute function public.capture_macro_release_vintage();

comment on table public.derived_metric_versions is
  'Append-only calculated-value history. Current UI values may remain elsewhere, but reproducible calculations belong here once their writers are migrated.';
comment on table public.macro_release_vintages is
  'Immutable point-in-time economic release states. public.macro_releases remains the mutable current projection.';
comment on table public.record_revisions is
  'Append-only correction/supersession ledger linking prior and replacement canonical records.';
comment on function public.capture_macro_release_vintage() is
  'Automatically snapshots data-bearing macro release changes and records their supersession lineage.';

commit;
