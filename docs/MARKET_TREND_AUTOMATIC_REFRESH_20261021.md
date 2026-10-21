# Automatic market and macro trend charts — operations

**Implementation:** source-backed trend charts from #939; historic macro-series auto-refresh in this repair. No independent scheduler and no new Story/evidence writer.

## Automatic lifecycle

| Stage | Owner and cadence | Action | Acceptance / fallback |
|---|---|---|---|
| Market history (private Markets) | Existing market monitor, server cache as configured (base 5 minutes, extras up to 1 hour) | Fetch dated closes/yields from existing named providers; preserve source and observation day | No points → explicit unavailable; delayed points → stale warning. Dated values, not invented live quotes |
| Market history (public Blue Desk) | Same existing market monitor | Public chart projects **only approved US Treasury nominal yields / matching FRED redistributed government series** | Exact source allowlist; no raw Nasdaq/energy/FX/crypto histories are silently published |
| Open chart refresh | Existing authenticated/reader browser session, every five minutes *while visible* | Refresh React Server Components via Next router, re-use server-side source cache and rights gates | No additional backend cron, no client-side provider keys, inactive tabs skip network |
| Macro historical chart | Existing Live Desk 09:30 / 21:30 MYT research acquisition | Batch official BLS v2 CPI headline/core, PPI final demand and payroll employment levels; compute carefully matched historical measurements; **insert only missing dated IDs** into existing `macro_series_observations` | Both month-to-month index changes use seasonally adjusted levels, yearly changes use non-seasonally adjusted matching levels; payroll is the change in jobs (thousands), not a percentage. No missing month interpolation |
| Research source quality | Same Live research slot | Emit `scheduled_macro_trend_history` source-health log with last period by series, inserted count and degraded reasons | Missing series, more than 75 days behind, bad BLS response, persistence errors → warning only; do not block unrelated canonical research or fabricate history |
| Reader | Existing `/data/macro` chart component | Consume current stored observations and mark source staleness clearly | No Store/Story mutation. Current Macro Trend is descriptive, not a System 2 verdict |

## After each existing scheduled slot

1. Inspect the production event `scheduled_macro_trend_history`. Verify `source=BLS_PUBLIC_DATA_API`, `coveredSeries` includes `cpi_all`, `cpi_core`, `ppi_final_demand`, `nfp`; inspect `latestBySeries`, `eligibleRecords`, `insertedRecords`, and `warnings`.
2. Verify `macro_series_observations` has dated rows for each available BLS published reference month. A repeat run should insert **zero** duplicates.
3. Check that the private Macro Data page shows 12 recorded readings per chart and no stale-warning banner if the latest valid month is sufficiently recent. Expect a natural publication lag; do not infer missing official values from day-of-month alone.
4. Browse the public Blue Desk government-rate chart and confirm a current source date, real dated points, range switching and a source hyperlink. Private Markets requires owner authentication.
5. If the provider fails or returns no eligible data, retain previous rows and escalate the `BLS_TREND_...` warning. Do not write zeroes, estimates, stale invented readings, or switch to an unlicensed third-party price feed.

### Correctness boundaries

- The BLS Public Data API v2 batch endpoint is `https://api.bls.gov/publicAPI/v2/timeseries/data/`. No new API key is required for this bounded unregistered request; provider throttling can still occur.
- Source data can be revised. This job deliberately **does not overwrite existing historical rows**, so an explicitly separate revision-vintage contract and provenance audit are required before updating an older stored month. Previous published Market Dossiers remain immutable.
- A chart rate is not a consensus surprise. Neither Trend storage nor the chart updates canonical `intelligence_evidence`, `story_thesis_versions` or the Market Dossier.
- Private Markets' displayed MAX is the most recent retained source history (up to 64 points); it is not a full historical price database.
- The public source-rights allowlist remains narrow until compliance authorises other asset classes. The draft V7 Markets styling PR #911 must be rebased against main to retain its government-yield trend.
- `getDeskData` caches macro rows for 60 seconds. Existing browser RSC refreshing applies to market charts, while the private Macro Data page reads new stored values on page reload/navigation. The scheduled source collector is automatic regardless of whether any browser is open.

## Deployment acceptance

Require full Validate Live Desk tests + typecheck + database contracts and exact merged-SHA Vercel READY. A green build proves wiring and parsing fixtures, **not** successful real provider ingestion; that requires a post-merge production scheduled run and source-record readback.
