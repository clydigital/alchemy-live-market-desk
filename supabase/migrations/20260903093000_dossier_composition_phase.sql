-- One completed research run owns one immutable base edition and may own one
-- immutable causal-composition successor. The prior single-row index made the
-- accepted Phase 2B superseding write impossible in production.

alter table public.hybrid_publication_snapshots
  add column if not exists edition_phase text not null default 'base'
  check (edition_phase in ('base', 'composed'));

drop index if exists public.hybrid_daily_brief_run_unique;

create unique index if not exists hybrid_daily_brief_run_phase_unique
  on public.hybrid_publication_snapshots(research_run_id, edition_phase)
  where snapshot_type = 'daily_brief' and research_run_id is not null;

create index if not exists hybrid_daily_brief_lineage_idx
  on public.hybrid_publication_snapshots(research_run_id, supersedes_snapshot_id, published_at desc)
  where snapshot_type = 'daily_brief';

comment on column public.hybrid_publication_snapshots.edition_phase is
  'Immutable daily-brief phase: deterministic base or model-composed Dossier successor.';
