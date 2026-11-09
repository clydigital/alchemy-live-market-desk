# Power Stack automatic prices and PEG: implementation boundary

Status: PEG calculation and research-gate foundation implemented on this branch; **automatic monitoring and provider-backed valuation ingestion not yet implemented**.

## Confirmed baseline
- `lib/market.ts` uses Nasdaq historical fetches with a 12-hour revalidation window; `lib/market-monitor.ts` adds other sources with their own caches. This is request-driven caching, not proof of unattended monitoring.
- `vercel.json` has research, provider-health and video crons, but no dedicated portfolio quote/valuation cron.
- `app/power-stack/page.tsx` is an owner-only archived Supabase snapshot, and explicitly says prices and scores are historical. Do not reinterpret archived values as live.

## New PEG contract
- `lib/power-stack-peg.ts` calculates **forward PEG = forward P/E / expected annual EPS growth percentage points**.
- Reject nonpositive or nonfinite inputs; retain estimate source, horizon and as-of date; missing provenance blocks actionable ranking.
- PEG below one is a *research candidate*, never a buy signal. Require separately verified growth quality, Bluebelly macro alignment, and entry/risk checks.

## Next implementation steps (not claimed shipped)
1. Select licensed quote and analyst-estimate providers and confirm redistribution rights and coverage for US/HK/MY tickers.
2. Persist owner-scoped watchlist quote observations with ticker, exchange, currency, provider, observation timestamp and ingestion timestamp. Separate these two dates.
3. Add a server-only scheduled refresh with idempotent upserts, rate-limit budgeting, provider-health telemetry and stale/missing flags; do not trigger expensive full-universe refresh on page views.
4. Ingest forward P/E and forward EPS growth estimates with horizon and provider receipts; do not infer them from price history.
5. Join Bluebelly regime evidence to each symbol with dated source IDs; use unknown when evidence is missing.
6. Render owner-only sortable PEG, price age, 1D/3D/5D change, macro fit and research gates. Never expose holdings or provider keys in public responses.
7. Verify scheduled executions, market-closed handling, source timestamps and production endpoint behaviour before describing monitoring as automatic.
