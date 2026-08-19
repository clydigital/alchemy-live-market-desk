-- Canonical normalization lineage and deterministic Macro Indicators change events.
-- Additive only: raw snapshots remain immutable and existing macro history is not deleted.

alter table public.macro_source_snapshots
  add column if not exists normalization_status text not null default 'pending',
  add column if not exists normalization_version integer not null default 0,
  add column if not exists normalized_at timestamptz,
  add column if not exists normalization_note text;

alter table public.macro_source_snapshots
  drop constraint if exists macro_source_snapshots_normalization_status_check;

alter table public.macro_source_snapshots
  add constraint macro_source_snapshots_normalization_status_check
  check (normalization_status in ('pending', 'processing', 'complete', 'failed'));

alter table public.macro_releases
  add column if not exists source_snapshot_id uuid references public.macro_source_snapshots(id),
  add column if not exists source_table_id text,
  add column if not exists source_row_key text;

alter table public.macro_release_metrics
  add column if not exists source_snapshot_id uuid references public.macro_source_snapshots(id),
  add column if not exists source_table_id text,
  add column if not exists source_row_key text,
  add column if not exists source_column text;

alter table public.macro_series_observations
  add column if not exists source_snapshot_id uuid references public.macro_source_snapshots(id),
  add column if not exists source_table_id text,
  add column if not exists source_row_key text,
  add column if not exists source_column text;

create index if not exists macro_releases_source_snapshot_idx
  on public.macro_releases(source_snapshot_id);
create index if not exists macro_release_metrics_source_snapshot_idx
  on public.macro_release_metrics(source_snapshot_id);
create index if not exists macro_series_observations_source_snapshot_idx
  on public.macro_series_observations(source_snapshot_id);

create table if not exists public.macro_source_change_events (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  previous_snapshot_id uuid not null references public.macro_source_snapshots(id) on delete cascade,
  current_snapshot_id uuid not null references public.macro_source_snapshots(id) on delete cascade,
  change_key text not null,
  change_type text not null check (change_type in (
    'CELL_CHANGED', 'ROW_ADDED', 'ROW_REMOVED', 'TABLE_ADDED', 'TABLE_REMOVED'
  )),
  section_key text,
  table_id text not null,
  table_kind text,
  row_key text,
  column_key text,
  old_value text,
  new_value text,
  row_data jsonb,
  detected_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(current_snapshot_id, change_key)
);

create index if not exists macro_source_change_events_current_idx
  on public.macro_source_change_events(current_snapshot_id, detected_at desc);
create index if not exists macro_source_change_events_section_idx
  on public.macro_source_change_events(section_key, change_type, detected_at desc);

alter table public.macro_source_change_events enable row level security;
revoke all on table public.macro_source_change_events from anon, authenticated;
grant all on table public.macro_source_change_events to service_role;

comment on table public.macro_source_change_events is
  'Deterministic changes between consecutive COMPLETE Macro Indicators snapshots. These are machine state, not analyst interpretation.';
comment on column public.macro_source_snapshots.normalization_status is
  'Idempotent canonical-normalization state. Only COMPLETE raw snapshots are eligible for normalization.';
comment on column public.macro_releases.source_snapshot_id is
  'Raw Macro Indicators snapshot that supplied Jina-derived fields for this canonical release row.';
comment on column public.macro_series_observations.source_snapshot_id is
  'Raw Macro Indicators snapshot that supplied the current canonical observation; prior values remain recoverable from immutable raw snapshots and change events.';
