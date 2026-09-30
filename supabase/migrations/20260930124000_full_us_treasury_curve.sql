-- Align the persistent cost-of-capital Regime with Live's canonical
-- 2Y / 5Y / 10Y / 20Y / 30Y Treasury curve.
begin;

update public.market_regimes
set affected_markets = array['US02Y','US05Y','US10Y','US20Y','US30Y','DXY','XAUUSD','QQQ','Credit','Housing'],
    updated_at = now()
where slug = 'global-cost-of-capital';

commit;
