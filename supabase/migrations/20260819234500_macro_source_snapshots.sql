-- Durable raw Macro Indicators source capture. This is additive only: existing
-- canonical macro_releases / macro_release_metrics / macro_series_observations
-- remain unchanged and no historical rows are rewritten.

create table if not exists public.macro_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_url text not null,
  transport text not null,
  schema_version integer not null default 1,
  capture_started_at timestamptz not null,
  capture_completed_at timestamptz not null,
  status text not null check (status in ('persisting', 'complete', 'partial', 'failed')),
  fingerprint text,
  expected_sections text[] not null default '{}'::text[],
  captured_sections text[] not null default '{}'::text[],
  missing_sections text[] not null default '{}'::text[],
  missing_required_table_families text[] not null default '{}'::text[],
  table_count integer not null default 0 check (table_count >= 0),
  raw_markdown text,
  transport_status integer,
  transport_error_code text,
  used_authentication boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists macro_source_snapshots_current_idx
  on public.macro_source_snapshots(source_key, status, capture_completed_at desc);

create index if not exists macro_source_snapshots_fingerprint_idx
  on public.macro_source_snapshots(source_key, fingerprint, capture_completed_at desc);

create table if not exists public.macro_source_snapshot_sections (
  snapshot_id uuid not null references public.macro_source_snapshots(id) on delete cascade,
  section_key text not null,
  status text not null check (status in ('captured', 'missing')),
  table_count integer not null default 0 check (table_count >= 0),
  row_count integer not null default 0 check (row_count >= 0),
  checksum text not null,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, section_key)
);

create table if not exists public.macro_source_snapshot_tables (
  snapshot_id uuid not null references public.macro_source_snapshots(id) on delete cascade,
  table_id text not null,
  section_key text,
  table_kind text not null,
  context_label text,
  headers jsonb not null default '[]'::jsonb,
  row_count integer not null default 0 check (row_count >= 0),
  fingerprint text not null,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, table_id)
);

create index if not exists macro_source_snapshot_tables_section_idx
  on public.macro_source_snapshot_tables(snapshot_id, section_key, table_kind);

create table if not exists public.macro_source_snapshot_rows (
  snapshot_id uuid not null,
  table_id text not null,
  row_key text not null,
  row_index integer not null check (row_index >= 0),
  cells jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, table_id, row_key),
  foreign key (snapshot_id, table_id)
    references public.macro_source_snapshot_tables(snapshot_id, table_id)
    on delete cascade
);

create index if not exists macro_source_snapshot_rows_order_idx
  on public.macro_source_snapshot_rows(snapshot_id, table_id, row_index);

alter table public.research_runs
  add column if not exists macro_snapshot_id uuid references public.macro_source_snapshots(id),
  add column if not exists macro_capture_attempt_id uuid references public.macro_source_snapshots(id),
  add column if not exists macro_capture_status text,
  add column if not exists macro_capture_note text;

alter table public.research_runs
  drop constraint if exists research_runs_macro_capture_status_check;

alter table public.research_runs
  add constraint research_runs_macro_capture_status_check
  check (macro_capture_status is null or macro_capture_status in ('complete', 'partial', 'failed', 'unavailable'));

create index if not exists research_runs_macro_snapshot_idx
  on public.research_runs(macro_snapshot_id, scheduled_for desc);

-- Raw source captures are server-side research memory. They are intentionally
-- not public feed tables; curated downstream state remains the publication layer.
alter table public.macro_source_snapshots enable row level security;
alter table public.macro_source_snapshot_sections enable row level security;
alter table public.macro_source_snapshot_tables enable row level security;
alter table public.macro_source_snapshot_rows enable row level security;

revoke all on table public.macro_source_snapshots from anon, authenticated;
revoke all on table public.macro_source_snapshot_sections from anon, authenticated;
revoke all on table public.macro_source_snapshot_tables from anon, authenticated;
revoke all on table public.macro_source_snapshot_rows from anon, authenticated;

grant all on table public.macro_source_snapshots to service_role;
grant all on table public.macro_source_snapshot_sections to service_role;
grant all on table public.macro_source_snapshot_tables to service_role;
grant all on table public.macro_source_snapshot_rows to service_role;

comment on table public.macro_source_snapshots is
  'Immutable Macro Indicators source capture attempts. Only status=complete rows are eligible as the canonical current comparison baseline.';
comment on column public.research_runs.macro_snapshot_id is
  'The COMPLETE Macro Indicators snapshot pinned to this research run. Partial/failed captures never replace it.';
comment on column public.research_runs.macro_capture_attempt_id is
  'The source-capture attempt made for this run, including partial or failed attempts for diagnostics.';
