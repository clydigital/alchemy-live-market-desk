-- Owner-only, dated quote observations; independent from archived portfolio valuations.
create table if not exists public.power_stack_quote_observations (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,17}$'),
  observed_on date not null,
  price numeric not null check (price > 0),
  currency text not null default 'USD',
  source_name text not null,
  source_url text not null,
  ingested_at timestamptz not null default now(),
  primary key (owner_user_id,ticker,observed_on)
);
create index if not exists power_stack_quote_owner_recent
  on public.power_stack_quote_observations (owner_user_id,observed_on desc);
alter table public.power_stack_quote_observations enable row level security;
revoke all on public.power_stack_quote_observations from anon,authenticated;
grant select on public.power_stack_quote_observations to authenticated;
drop policy if exists power_stack_quote_owner_read on public.power_stack_quote_observations;
create policy power_stack_quote_owner_read on public.power_stack_quote_observations
 for select to authenticated using (owner_user_id = (select auth.uid()));
-- Service-role writer only; no browser writes or public portfolio disclosures.
