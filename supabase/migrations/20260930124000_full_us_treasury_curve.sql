-- Align the persistent cost-of-capital Regime with Live's canonical
-- 2Y / 5Y / 10Y / 20Y / 30Y Treasury curve without removing any existing
-- cross-market members added by later Regime work.
begin;

update public.market_regimes regime
set affected_markets = (
  select array_agg(item.value order by item.first_ordinal)
  from (
    select value, min(ordinal) as first_ordinal
    from unnest(
      coalesce(regime.affected_markets, '{}'::text[])
      || array['US02Y','US05Y','US10Y','US20Y','US30Y']
    ) with ordinality as expanded(value, ordinal)
    group by value
  ) item
),
updated_at = now()
where slug = 'global-cost-of-capital';

commit;
