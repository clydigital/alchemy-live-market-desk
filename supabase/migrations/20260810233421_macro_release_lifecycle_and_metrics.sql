-- Make economic-release lifecycle state operational rather than leaving past
-- releases in the legacy `upcoming` state when the official Actual is missing.
-- This migration is additive and preserves the existing prose fields.

alter table public.macro_releases
  add column if not exists released_at timestamptz,
  add column if not exists actual_retrieved_at timestamptz,
  add column if not exists consensus_source text,
  add column if not exists consensus_captured_at timestamptz,
  add column if not exists last_ingestion_attempt_at timestamptz,
  add column if not exists ingestion_gap_reason text,
  add column if not exists lifecycle_evaluated_at timestamptz;

alter table public.macro_releases
  drop constraint if exists macro_releases_status_check;

alter table public.macro_releases
  add constraint macro_releases_status_check
  check (status in (
    'upcoming',
    'scheduled',
    'pre_release',
    'released_pending_ingestion',
    'completed',
    'revision_detected',
    'stale_error'
  ));

create index if not exists macro_releases_lifecycle_idx
  on public.macro_releases(status, release_date);

create table if not exists public.macro_release_metrics (
  id uuid primary key default gen_random_uuid(),
  release_id text not null references public.macro_releases(id) on delete cascade,
  metric_key text not null,
  label text not null,
  transformation text not null check (transformation in (
    'level', 'mom', 'yoy', 'qoq', 'annualised', 'change'
  )),
  unit text,
  previous numeric,
  revised_previous numeric,
  consensus numeric,
  consensus_source text,
  consensus_captured_at timestamptz,
  forecast_low numeric,
  forecast_high numeric,
  alchemy_expectation numeric,
  alchemy_expectation_low numeric,
  alchemy_expectation_high numeric,
  alchemy_expectation_confidence numeric(5,2)
    check (alchemy_expectation_confidence is null or alchemy_expectation_confidence between 0 and 100),
  actual numeric,
  surprise_vs_consensus numeric generated always as (
    case when actual is not null and consensus is not null then actual - consensus end
  ) stored,
  surprise_vs_alchemy numeric generated always as (
    case when actual is not null and alchemy_expectation is not null then actual - alchemy_expectation end
  ) stored,
  source_url text not null,
  retrieved_at timestamptz not null default now(),
  realtime_start date,
  realtime_end date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(release_id, metric_key)
);

create index if not exists macro_release_metrics_release_idx
  on public.macro_release_metrics(release_id, metric_key);

alter table public.macro_release_metrics enable row level security;
revoke all on table public.macro_release_metrics from anon, authenticated;
grant select on table public.macro_release_metrics to anon, authenticated;
grant all on table public.macro_release_metrics to service_role;

drop policy if exists public_read_macro_release_metrics on public.macro_release_metrics;
create policy public_read_macro_release_metrics
  on public.macro_release_metrics
  for select
  to anon, authenticated
  using (true);

drop trigger if exists macro_release_metrics_updated_at on public.macro_release_metrics;
create trigger macro_release_metrics_updated_at
before update on public.macro_release_metrics
for each row execute function public.intelligence_set_updated_at();

create or replace function public.refresh_macro_release_lifecycle(
  p_now timestamptz default now(),
  p_ingestion_grace interval default interval '4 hours'
)
returns table (
  evaluated_count integer,
  scheduled_count integer,
  pre_release_count integer,
  released_pending_ingestion_count integer,
  completed_count integer,
  revision_detected_count integer,
  stale_error_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.macro_releases release
  set
    status = case
      when nullif(btrim(release.actual), '') is not null and release.status = 'revision_detected'
        then 'revision_detected'
      when nullif(btrim(release.actual), '') is not null
        then 'completed'
      when release.release_date > p_now + interval '24 hours'
        then 'scheduled'
      when release.release_date > p_now
        then 'pre_release'
      when release.release_date >= p_now - p_ingestion_grace
        then 'released_pending_ingestion'
      else 'stale_error'
    end,
    released_at = case
      when nullif(btrim(release.actual), '') is not null
        then coalesce(release.released_at, release.published_at)
      else release.released_at
    end,
    ingestion_gap_reason = case
      when nullif(btrim(release.actual), '') is not null
        then null
      when release.release_date > p_now
        then null
      when release.release_date >= p_now - p_ingestion_grace
        then 'Official Actual is not yet available in the ingestion store after the scheduled release time.'
      else 'Official Actual remains unavailable beyond the post-release ingestion grace window.'
    end,
    lifecycle_evaluated_at = p_now,
    updated_at = case
      when release.status is distinct from case
        when nullif(btrim(release.actual), '') is not null and release.status = 'revision_detected' then 'revision_detected'
        when nullif(btrim(release.actual), '') is not null then 'completed'
        when release.release_date > p_now + interval '24 hours' then 'scheduled'
        when release.release_date > p_now then 'pre_release'
        when release.release_date >= p_now - p_ingestion_grace then 'released_pending_ingestion'
        else 'stale_error'
      end then p_now
      else release.updated_at
    end;

  get diagnostics evaluated_count = row_count;

  select
    count(*) filter (where status = 'scheduled'),
    count(*) filter (where status = 'pre_release'),
    count(*) filter (where status = 'released_pending_ingestion'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'revision_detected'),
    count(*) filter (where status = 'stale_error')
  into
    scheduled_count,
    pre_release_count,
    released_pending_ingestion_count,
    completed_count,
    revision_detected_count,
    stale_error_count
  from public.macro_releases;

  return next;
end;
$$;

revoke all on function public.refresh_macro_release_lifecycle(timestamptz, interval) from public, anon, authenticated;
grant execute on function public.refresh_macro_release_lifecycle(timestamptz, interval) to service_role;

select * from public.refresh_macro_release_lifecycle(now(), interval '4 hours');

comment on table public.macro_release_metrics is
  'Component-level, point-in-time economic release observations. Consensus and Alchemy expectation remain separate.';
comment on function public.refresh_macro_release_lifecycle(timestamptz, interval) is
  'Moves past releases with no official Actual into an explicit ingestion-gap lifecycle without fabricating values.';
