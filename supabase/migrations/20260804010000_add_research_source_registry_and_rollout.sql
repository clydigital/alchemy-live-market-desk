-- Applied to qdtlrfgxpsnxajiptrno on 2026-08-04.
-- Canonical research-method registry and role-based rollout.

create table if not exists public.research_source_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  source_kind text not null check (source_kind in ('creator_transcript','official_transcript','livestream_benchmark','data_connector','reporting_connector')),
  source_tier integer not null check (source_tier between 1 and 5),
  status text not null check (status in ('active','reviewed','partial','pending','benchmark','retired')),
  url text, corpus_size integer not null default 0 check (corpus_size >= 0),
  corpus_note text, method_strengths text[] not null default '{}',
  operational_use text not null, safeguards text not null,
  owner_app text not null check (owner_app in ('original_desk','shared','hybrid')),
  last_reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.research_rollout (
  id uuid primary key default gen_random_uuid(), phase_order integer not null unique, phase_key text not null unique,
  name text not null, owner_app text not null check (owner_app in ('original_desk','shared','hybrid')),
  status text not null check (status in ('complete','in_progress','planned','blocked')), scope text not null,
  deliverables text[] not null default '{}', exit_criteria text[] not null default '{}', dependencies text[] not null default '{}',
  notes text, updated_at timestamptz not null default now()
);

alter table public.research_source_registry enable row level security;
alter table public.research_rollout enable row level security;
drop policy if exists public_read_research_source_registry on public.research_source_registry;
create policy public_read_research_source_registry on public.research_source_registry for select to public using (true);
drop policy if exists public_read_research_rollout on public.research_rollout;
create policy public_read_research_rollout on public.research_rollout for select to public using (true);
grant select on public.research_source_registry, public.research_rollout to anon, authenticated;
