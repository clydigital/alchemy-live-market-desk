create table if not exists public.market_state_ledger (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  sector text not null,
  sub_industry text not null,
  status text not null default 'monitoring',
  direction text not null default 'Mixed' check (direction in ('Boon', 'Risk', 'Mixed', 'Data gap')),
  magnitude integer check (magnitude between 0 and 100),
  probability integer check (probability between 0 and 100),
  risk text not null,
  boon text not null,
  beneficiaries text[] not null default '{}',
  losers text[] not null default '{}',
  evidence_summary text not null,
  source_name text not null,
  source_url text not null,
  source_type text not null default 'official',
  observed_at timestamptz,
  freshness_status text,
  next_test text not null,
  story_id uuid,
  transcript_id uuid,
  owner_status text not null default 'monitoring',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_state_ledger_sector_idx on public.market_state_ledger (sector, sub_industry);
create index if not exists market_state_ledger_observed_at_idx on public.market_state_ledger (observed_at desc nulls last);
create index if not exists market_state_ledger_story_idx on public.market_state_ledger (story_id) where story_id is not null;

alter table public.market_state_ledger enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_state_ledger'
      and policyname = 'Public market state is readable'
  ) then
    create policy "Public market state is readable"
      on public.market_state_ledger
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

alter table public.macro_releases
  add column if not exists country text,
  add column if not exists impact text default 'High',
  add column if not exists local_timezone text;

alter table public.earnings_calls
  add column if not exists source_url text,
  add column if not exists event_time_label text,
  add column if not exists story_id uuid,
  add column if not exists market_reaction text,
  add column if not exists boon text,
  add column if not exists risk text;

comment on table public.market_state_ledger is
  'Persistent risk and boon state by market sub-industry. Story and transcript links are optional until a module becomes editorially material.';
