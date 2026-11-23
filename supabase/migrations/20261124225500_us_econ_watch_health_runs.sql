-- Source-only operational receipts for the US Econ Stat Watch.
-- Keep these distinct from canonical research_runs, Story, Regime, and holdings.
-- Secrets and private creator/portfolio data must never be stored here.
create table if not exists public.us_econ_watch_health_runs (
 id uuid primary key default gen_random_uuid(),
 run_kind text not null check (run_kind in ('DAILY_CHECK','MISSED_RUN_AUDIT')),
 scheduled_for timestamptz not null,
 checked_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 state text not null check (state in ('HEALTHY','DEGRADED','CRITICAL','MISSED')),
 source_status text not null,
 consensus_provider text not null,
 verified_recent integer not null default 0 check (verified_recent >= 0),
 pending_recent integer not null default 0 check (pending_recent >= 0),
 last_metric_retrieved_at timestamptz,
 warning_codes text[] not null default '{}'::text[],
 critical_count integer not null default 0 check (critical_count >= 0),
 error_code text,
 canonical_regime_unchanged boolean not null default true check (canonical_regime_unchanged = true)
);
create index if not exists us_econ_watch_health_runs_time_idx
 on public.us_econ_watch_health_runs(scheduled_for desc,checked_at desc);
create unique index if not exists us_econ_watch_health_once_missed_idx
 on public.us_econ_watch_health_runs(run_kind,scheduled_for)
 where run_kind='MISSED_RUN_AUDIT';
alter table public.us_econ_watch_health_runs enable row level security;
revoke all on table public.us_econ_watch_health_runs from public,anon,authenticated;
grant select,insert on table public.us_econ_watch_health_runs to service_role;
-- Intentionally no anonymous/authenticated RLS policy.
-- service_role is the only DB role entitled to write/read operational receipts.
