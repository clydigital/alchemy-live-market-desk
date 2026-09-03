-- Fresh-news recruitment is a server-owned intelligence ledger. It records the
-- exact semantic clusters admitted to the causal research brain and keeps
-- present attention distinct from durable Story confidence.

create table if not exists public.intelligence_recruitment_clusters (
  id uuid primary key default gen_random_uuid(),
  engine_run_id uuid not null references public.intelligence_engine_runs(id) on delete cascade,
  stage_run_id uuid not null references public.intelligence_stage_runs(id) on delete cascade,
  cluster_key text not null,
  model_cluster_key text not null,
  title text not null,
  summary text not null,
  primary_category text not null,
  themes text[] not null default '{}',
  affected_assets text[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  freshness_score numeric(5,2) not null check (freshness_score between 0 and 100),
  materiality_score numeric(5,2) not null check (materiality_score between 0 and 100),
  momentum_score numeric(5,2) not null check (momentum_score between 0 and 100),
  breadth_score numeric(5,2) not null check (breadth_score between 0 and 100),
  urgency_score numeric(5,2) not null check (urgency_score between 0 and 100),
  verdict text not null check (verdict in ('recruit', 'context', 'defer')),
  rationale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(engine_run_id, cluster_key),
  unique(engine_run_id, model_cluster_key)
);

create index if not exists intelligence_recruitment_clusters_run_verdict_idx
  on public.intelligence_recruitment_clusters(engine_run_id, verdict, materiality_score desc);
create index if not exists intelligence_recruitment_clusters_evidence_idx
  on public.intelligence_recruitment_clusters using gin(evidence_ids);

alter table public.intelligence_market_beliefs
  add column if not exists recruitment_cluster_ids uuid[] not null default '{}',
  add column if not exists primary_category text not null default 'uncategorised',
  add column if not exists themes text[] not null default '{}',
  add column if not exists freshness_score numeric(5,2) not null default 0 check (freshness_score between 0 and 100),
  add column if not exists materiality_score numeric(5,2) not null default 0 check (materiality_score between 0 and 100),
  add column if not exists momentum_score numeric(5,2) not null default 0 check (momentum_score between 0 and 100),
  add column if not exists breadth_score numeric(5,2) not null default 0 check (breadth_score between 0 and 100),
  add column if not exists urgency_score numeric(5,2) not null default 0 check (urgency_score between 0 and 100);

alter table public.intelligence_story_candidates
  add column if not exists current_attention jsonb not null default '{}'::jsonb
  check (jsonb_typeof(current_attention) = 'object');

alter table public.intelligence_recruitment_clusters enable row level security;
revoke all privileges on table public.intelligence_recruitment_clusters from anon, authenticated;
grant select, insert, update, delete on table public.intelligence_recruitment_clusters to service_role;

comment on table public.intelligence_recruitment_clusters is
  'Durable fresh-news-first semantic recruitment diagnostics for each intelligence engine run.';
comment on column public.intelligence_market_beliefs.materiality_score is
  'Current decision relevance inherited from recruited evidence; intentionally distinct from Story confidence.';

update public.intelligence_prompt_versions
set is_active = false,
    retired_at = coalesce(retired_at, now())
where stage_key = 'market_belief' and is_active;

insert into public.intelligence_prompt_versions (
  stage_key,
  version,
  prompt_text,
  output_schema,
  model_hint,
  is_active
)
values (
  'market_belief',
  coalesce((select max(version) from public.intelligence_prompt_versions where stage_key = 'market_belief'), 0) + 1,
  'Recruit and semantically cluster fresh canonical evidence before consulting persistent Story memory. Keep current materiality, freshness, momentum, breadth and urgency distinct from confidence. Scheduled-only evidence belongs to Ahead, not the news brain. Then state the market beliefs supported by recruited clusters and perform the bounded existing-Story assessments.',
  '{}'::jsonb,
  'gpt-5.6-luna',
  true
);
