-- Migration applied to Supabase project on 10 Nov 2026 MYT.
-- Private Power Stack PEG research observations. Fiscal ends are not analyst revision dates.
create table if not exists public.power_stack_peg_research_observations (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,17}$'),
  retrieved_at timestamptz not null,
  estimate_native_updated_at timestamptz null,
  forecast_first_fy_end date not null,
  forecast_second_fy_end date not null,
  eps_first_fy numeric(20,8) not null check (eps_first_fy > 0),
  eps_second_fy numeric(20,8) not null check (eps_second_fy > 0),
  first_fy_analysts integer null check (first_fy_analysts >= 0),
  second_fy_analysts integer null check (second_fy_analysts >= 0),
  quote_price numeric(20,8) not null check (quote_price > 0),
  quote_observed_on date not null,
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  estimate_currency text not null check (estimate_currency ~ '^[A-Z]{3}$'),
  forecast_source text not null,
  forecast_source_url text not null check (forecast_source_url ~ '^https://'),
  quote_source text not null,
  ingested_at timestamptz not null default now(),
  primary key (owner_user_id,ticker,retrieved_at),
  constraint power_stack_peg_fiscal_order check (forecast_second_fy_end > forecast_first_fy_end)
);
create index if not exists power_stack_peg_owner_latest_idx
  on public.power_stack_peg_research_observations(owner_user_id,ticker,retrieved_at desc);
alter table public.power_stack_peg_research_observations enable row level security;
revoke all on public.power_stack_peg_research_observations from anon,authenticated;
grant select on public.power_stack_peg_research_observations to authenticated;
drop policy if exists power_stack_peg_owner_read on public.power_stack_peg_research_observations;
create policy power_stack_peg_owner_read on public.power_stack_peg_research_observations
 for select to authenticated using (owner_user_id=(select auth.uid()));
-- No public read and no browser insert/update/delete policy. Privileged research ingestion only.
