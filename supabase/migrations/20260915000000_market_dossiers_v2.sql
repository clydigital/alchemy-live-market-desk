-- Migration: Market Dossiers V2 persistence foundation
-- Immutable, additive MarketDossierV2 schema for Dossier-First architecture reset.

create table if not exists public.market_dossiers_v2 (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null,
  previous_dossier_id uuid null references public.market_dossiers_v2(id) on delete restrict,
  as_of timestamptz not null,
  freshness jsonb not null,
  research_gaps jsonb not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists market_dossiers_v2_as_of_idx
  on public.market_dossiers_v2 (as_of desc);

create index if not exists market_dossiers_v2_created_at_idx
  on public.market_dossiers_v2 (created_at desc);

create index if not exists market_dossiers_v2_previous_dossier_id_idx
  on public.market_dossiers_v2 (previous_dossier_id)
  where previous_dossier_id is not null;

-- Append-only trigger function (ensure present)
create or replace function public.prevent_immutable_research_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; add a superseding record or revision instead', tg_table_name
    using errcode = '55000';
end;
$$;

-- Append-only protection
drop trigger if exists market_dossiers_v2_append_only on public.market_dossiers_v2;
create trigger market_dossiers_v2_append_only
before update or delete on public.market_dossiers_v2
for each row execute function public.prevent_immutable_research_mutation();

-- Database security: Enable Row Level Security (RLS)
alter table public.market_dossiers_v2 enable row level security;
