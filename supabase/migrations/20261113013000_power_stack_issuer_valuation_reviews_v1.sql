-- Private reviewer-attested issuer underwriting. No automatic PEG-to-mispricing promotion.
-- One immutable snapshot per issuer/review time; only privileged ingestion may insert.
create table if not exists public.power_stack_issuer_valuation_reviews (
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 ticker text not null check (ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,17}$'),
 reviewed_at timestamptz not null,
 review_status text not null check (review_status='SOURCE_REVIEWED'),
 price_observed_on date not null,
 market_price numeric(20,8) not null check (market_price>0),
 price_currency text not null check (price_currency ~ '^[A-Z]{3}$'),
 price_source_url text not null check (price_source_url ~ '^https://'),
 source_timestamp_basis text not null check (source_timestamp_basis='market_session'),
 valuation_low numeric(20,8) not null check (valuation_low>0),
 valuation_high numeric(20,8) not null check (valuation_high>=valuation_low),
 valuation_currency text not null check (valuation_currency ~ '^[A-Z]{3}$'),
 valuation_method text not null check (valuation_method in ('DCF','FCF_MULTIPLE','EARNINGS_MULTIPLE','SUM_OF_PARTS','COMPS')),
 valuation_source_url text not null check (valuation_source_url ~ '^https://'),
 method_explanation text not null,
 downside_case text not null,
 invalidation_test text not null,
 financial_period_end date not null,
 financials_currency text not null check (financials_currency ~ '^[A-Z]{3} text not null check (fundamental_source_url ~ '^https://'),
 revenue numeric(24,4),
 net_income numeric(24,4),
 operating_cash_flow numeric(24,4) not null,
 capital_expenditure numeric(24,4) not null check (capital_expenditure>=0),
 share_based_compensation numeric(24,4) check (share_based_compensation is null or share_based_compensation>=0),
 net_debt numeric(24,4),
 reviewer_note text not null,
 ingested_at timestamptz not null default now(),
 primary key(owner_user_id,ticker,reviewed_at),
 constraint power_stack_issuer_review_three_sources check (
   price_source_url<>fundamental_source_url
   and price_source_url<>valuation_source_url
   and fundamental_source_url<>valuation_source_url),
 constraint power_stack_issuer_review_currency_match check (
   price_currency=valuation_currency and price_currency=financials_currency),
 constraint power_stack_issuer_review_dates check (
   price_observed_on<=reviewed_at::date
   and financial_period_end<=reviewed_at::date)
);
create index if not exists power_stack_issuer_review_owner_latest
 on public.power_stack_issuer_valuation_reviews(owner_user_id,ticker,reviewed_at desc);
alter table public.power_stack_issuer_valuation_reviews enable row level security;
revoke all on table public.power_stack_issuer_valuation_reviews from anon,authenticated;
grant select on table public.power_stack_issuer_valuation_reviews to authenticated;
drop policy if exists power_stack_issuer_review_owner_read on public.power_stack_issuer_valuation_reviews;
create policy power_stack_issuer_review_owner_read on public.power_stack_issuer_valuation_reviews
 for select to authenticated using(owner_user_id=(select auth.uid()));
-- No insert/update/delete grant or policy for authenticated, anon, public
-- clients. Only an independent privileged, reviewed ingestion pathway may write.
),
 financials_unit text not null check (financials_unit in ('ones','thousands','millions')),
 fundamental_source_url text not null check (fundamental_source_url ~ '^https://'),
 revenue numeric(24,4),
 net_income numeric(24,4),
 operating_cash_flow numeric(24,4) not null,
 capital_expenditure numeric(24,4) not null check (capital_expenditure>=0),
 share_based_compensation numeric(24,4) check (share_based_compensation is null or share_based_compensation>=0),
 net_debt numeric(24,4),
 reviewer_note text not null,
 ingested_at timestamptz not null default now(),
 primary key(owner_user_id,ticker,reviewed_at),
 constraint power_stack_issuer_review_three_sources check (
   price_source_url<>fundamental_source_url
   and price_source_url<>valuation_source_url
   and fundamental_source_url<>valuation_source_url),
 constraint power_stack_issuer_review_currency_match check (price_currency=valuation_currency),
 constraint power_stack_issuer_review_dates check (
   price_observed_on<=reviewed_at::date
   and financial_period_end<=reviewed_at::date)
);
create index if not exists power_stack_issuer_review_owner_latest
 on public.power_stack_issuer_valuation_reviews(owner_user_id,ticker,reviewed_at desc);
alter table public.power_stack_issuer_valuation_reviews enable row level security;
revoke all on table public.power_stack_issuer_valuation_reviews from anon,authenticated;
grant select on table public.power_stack_issuer_valuation_reviews to authenticated;
drop policy if exists power_stack_issuer_review_owner_read on public.power_stack_issuer_valuation_reviews;
create policy power_stack_issuer_review_owner_read on public.power_stack_issuer_valuation_reviews
 for select to authenticated using(owner_user_id=(select auth.uid()));
-- No insert/update/delete grant or policy for authenticated, anon, public
-- clients. Only an independent privileged, reviewed ingestion pathway may write.
