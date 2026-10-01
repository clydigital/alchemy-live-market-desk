-- Market Motion freshness reset: 48-hour event window with an 18-item application safety ceiling.
-- Existing append-only rows are not rewritten. The current view applies the shorter freshness
-- ceiling immediately, while new rows receive a 48-hour default expiry at insertion.

begin;

create or replace function public.assign_market_motion_version()
returns trigger
language plpgsql
as $$
declare
  prior_id uuid;
  prior_version integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.motion_key, 0));

  select id, version_number
  into prior_id, prior_version
  from public.market_motion_items
  where motion_key = new.motion_key
  order by version_number desc, created_at desc
  limit 1;

  new.version_number := coalesce(prior_version, 0) + 1;
  new.previous_version_id := prior_id;
  new.contract_version := coalesce(nullif(new.contract_version, ''), 'market-motion/v1');
  new.expires_at := coalesce(
    new.expires_at,
    greatest(new.occurred_at, coalesce(new.observed_at, now())) + interval '48 hours'
  );

  return new;
end;
$$;

create or replace view public.current_market_motion_items
with (security_invoker = true)
as
select distinct on (motion_key)
  id,
  motion_key,
  version_number,
  previous_version_id,
  contract_version,
  research_run_id,
  source_id,
  evidence_id,
  primary_story_id,
  primary_regime_slug,
  lifecycle_state,
  case
    when lifecycle_state = 'EXPIRED'
      or least(
        expires_at,
        greatest(occurred_at, observed_at) + interval '48 hours'
      ) <= now()
    then 'EXPIRED'
    else lifecycle_state
  end as effective_state,
  category,
  verification_state,
  headline,
  what_happened,
  market_reaction,
  why_interesting,
  big_picture_bridge,
  next_test,
  promotion_reason,
  tickers,
  source_name,
  source_url,
  source_kind,
  materiality,
  relevance,
  novelty,
  occurred_at,
  observed_at,
  least(
    expires_at,
    greatest(occurred_at, observed_at) + interval '48 hours'
  ) as expires_at,
  metadata,
  created_at
from public.market_motion_items
order by motion_key, version_number desc, created_at desc;

grant select on public.current_market_motion_items to anon, authenticated, service_role;

commit;
