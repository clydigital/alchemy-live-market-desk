# Bluebelly Market Tools — research workflow contract (v0)

Status: **UI and links merged in PR #1119 and deployed to Bluebelly (28 October 2026); automatic candidate ingestion not yet implemented**.

## Boundaries
- Bluebelly is the only new presentation target; no PowerStack or legacy Live Desk routing.
- Screening outputs, third-party correlation readings and ChatGPT plugin analysis are **candidate intelligence**, not canonical evidence.
- Do not auto-promote a candidate to Story, market motion, trade recommendation, publication or presenter claim.
- No new scheduled tasks. Reuse existing MacroPulse and Research Gap investigation cadence only after the adapters and provenance checks are verified.

## Candidate schema for future adapters
- candidate_id, created_at, asset_1, asset_2 (optional), direction/hypothesis, timeframe, observed_at, source_url, source_provider, retrieved_at
- observed move/level (optional; with units), rolling correlation (optional; 20/60/120 aligned observations), sample_count, correlation_method, calendar_alignment
- suspected catalyst (labelled hypothesis), upcoming catalyst, supporting source receipts, opposing evidence
- confirmation, invalidation, status (candidate → investigated → verified / rejected / expired), source freshness and limitations

## Workflow ownership
1. **Discovery**: TradingView/Finviz screeners and correlation tools provide a candidate and a direct source URL.
2. **Investigation**: existing Research Gap workflow checks the candidate against independent primary sources, observed timestamps and actual market reaction. A third-party widget screenshot alone is not sufficient.
3. **Evidence admission**: only existing canonical evidence ingestion can verify and persist an observation. Preserve source and event time independently.
4. **Story association**: link only to a proven existing Story or create a new one through canonical governance; do not attach based solely on symbol similarity.
5. **Publication**: verified claims may inform Bluebelly Newsroom, Daily Report, and owner Presenter Studio; speculative trade candidates remain in private research context.
6. **Readback**: verify published identity, source links, timestamps, status and invalidation conditions on Bluebelly itself.

## COT Signal / official CFTC positioning input
- Existing MacroPulse and Research Gap scheduled prompts were updated on 28 October 2026 to add *conditional* COT positioning checks; original task schedules and Notion destinations were preserved. This updates research instructions, not unattended website-to-canonical ingestion.
- COTSignal (https://www.cotsignal.com) is a secondary reference to spot and interpret the weekly CFTC Legacy Futures Only positioning context, not an official data source, realtime indicator, owned API or automatic trade signal.
- Prefer original CFTC **TFF** for currency/rates/equity financial futures and **Disaggregated** for energy/metals/commodities, with Legacy where explicitly relevant. Do not equate incompatible participant categories.
- Record original Tuesday observation/report date, Friday release date, retrieval date, lookback window, participant, open interest and price-catalyst clock. If a market-moving event happened after Tuesday, mark the positioning pre-catalyst.
- COTSignal’s current 0–100 historical range score is min/max-normalised over a selectable 52–260-week lookback; its Commercial display is inverted. Alchemy’s pre-existing 52-week rank is a *different statistic*. Never cross-compare scores without formula labels or imply numeric parity.
- Qualify the outcome as support / challenge / catalyst amplification / neutral / stale, using independent price, rates, macro, policy or physical-market evidence. COT alone cannot promote an Idea, Story or Regime.
- If public site retrieval fails, mark that comparison unavailable and retain independently sourced CFTC observations. No automated scraping, new schedule or publication rights.

## Integration gates
- Verify existing FRED/FMP/market monitor feeds before buying or requesting new API plans.
- Compute correlations from aligned **returns**, not a mix of price levels and yield percentages; document exceptions such as yield changes in basis points.
- Check asset calendars, missing values, corporate actions, sampling frequency, stale data and data licensing.
- Use server-side secrets and caching. A missing or failed provider must show 'not connected', not fabricated data.
- Do not change existing schedule or publication contracts until end-to-end evidence receipts and readback are proven.

## Verification checklist
- [x] Source directory and candidate relationship watchlist implemented and merged
- [x] Presenter Studio and Bluebelly navigation link to the workspace
- [x] Manual workflow handoff links implemented
- [x] GitHub validation passed for PR #1119
- [x] Merged to main; Vercel production deployment READY with Bluebelly alias
- [x] Read-only 20/60/120 matched-session correlations using existing cached Nasdaq/Treasury-FRED/ECB/EIA and monitor history (subject to CI and deployment)
- [ ] Direct DXY, EURUSD, BTC spot and spot VIX feeds: current equivalents are clearly labelled ETF/index/futures proxies
- [ ] Extend history beyond the existing 64-point market-monitor payload for all 120-session cross-asset windows without inflating canonical public payloads
- [ ] Candidate persistence with provenance
- [ ] Research Gap intake and canonical evidence admission
- [ ] Newsroom/Presenter readback with verified candidate association


## Existing-feed correlation pilot (28 October 2026)

Implementation candidate in `lib/market-tools-correlations.ts`:

- Seven named research relationships use the existing `getMarketData()` and `getMarketMonitor()` cached historical data, **no new subscriptions, credentials, third-party scraping or scheduled jobs**.
- Dollar UUP ETF versus gold GLD ETF; dollar UUP versus euro FXE ETF; Nasdaq Composite versus Bitcoin IBIT ETF; official FRED 2Y yield versus ECB USDJPY; GLD versus 10Y real yield; EIA WTI spot versus FRED 5Y inflation breakeven; SPY proxy versus VIXY VIX-futures ETF. Each pair visibly discloses the *actual instruments*.
- Join dated observations on the same UTC calendar date before computing consecutive observed-period changes; skip cross-source gaps over seven days. Price instruments use log returns; yield/breakeven instruments use **basis-point changes**, not percent returns on yield levels. Report Pearson correlation for the last 20/60/120 *valid aligned changes*, with n, source links and both source dates. Do not interpolate, pad, carry forward or fabricate absent measurements.
- The existing extra Nasdaq provider requests only 50 observations; the monitor’s public row history is limited to 64. Thus 60/120-sample results for some pairs must show unavailable rather than synthetic longer histories. The shared core price series may have up to 280 points and support 120-day windows.
- A source's original observation date governs freshness. No `updatedAt` cache time is sufficient proof of an updated market quote. Label age > 7 days as STALE, and do not call these statistical co-movements signals. Correlation and source success do not grant canonical evidence admission.

Follow-up before enabling decision feedback: provider audit, 60/120-window coverage upgrade, spot-vs-proxy choice, separate persistence for source receipts and canonical evidence IDs, actual Research Gap receipt, and governance tests for owner-only publication.

## Manually test installed provider keys (28 October 2026)
- Go to the authenticated `/market-tools?check=providers` page. This checks exactly one FRED DGS10 daily observation, the existing EIA weekly petroleum v2 snapshot and a single compact, free-tier Alpha Vantage SPY daily history request. It is read-only and no scheduled job is added.
- The check runs only when the owner opens that URL. Responses are cached for 60 minutes to preserve free-tier API limits. Plain `/market-tools` does not request API-key smoke checks.
- The provider panel shows ready / unconfigured / unavailable / limited, the most recent source observation date and valid row count; it never sends credentials, raw vendor error payloads or credential-bearing request URLs to the page.
- `ALPHA_VANTAGE_API_KEY` currently powers only an explicitly labelled smoke test, **not** a replacement for existing Nasdaq/ECB/EIA market prices, verified signals, correlation calculations, Story/Regime updates or production financial evidence.
- Project-level Vercel variables and team Shared Environment Variables are different scopes. A key is usable only after it is linked to the project and environment and a new deployment is built. On source failure show a gap, do not infer a broken API key merely from an unavailable price.
- Auth remains the exact Bluebelly owner allowlist. If deployed and signed-in readback is not verified, label release as unverified.

## Connected API data use and remaining verification — 28 October 2026
- Live Production authenticated owner diagnostics have VERIFIED FRED DGS10 (3 observations, as of 2026-10-26) and Alpha Vantage SPY compact (100 observations, as of 2026-10-27). Alpha Vantage remains a bounded secondary verification source: 100-session compact history is NOT enough to claim 120-session correlation coverage, and there is no automatic canonical promotion or additional polling.
- EIA_API_KEY is present as a Production variable, but EIA v2 stocks/refinery/supply requests returned HTTP 403 across all three routes. Presence of a secret does **not** prove API entitlement. The adapter now exposes only recognised EIA gateway error codes (e.g., API_KEY_INVALID, API_KEY_UNVERIFIED), without the raw response, request URL or credentials. Record unsupported 403 codes as HTTP_403.
- The correlation owner page now consumes longer, already-cached underlying Nasdaq, FRED or Treasury histories directly for the 20/60/120-day comparisons while the existing public/hybrid MarketMonitorRow remains capped at 64 points. It will never extend a 120-day result through interpolation, nor substitute older source history over a fresher observation.
- No existing official petroleum time-series or research pipeline may be marked EIA-API READY until dated rows are retrieved and compared to the Weekly Petroleum Status Report. Existing EIA HTML spot-price readings remain separate from EIA v2 weekly inventory observations.
- Continue the same MacroPulse, Research Gap and Notion publication schedules. Measurements remain observation candidates until evidence IDs and provenance have been admitted by the established Research Gap governance. 
