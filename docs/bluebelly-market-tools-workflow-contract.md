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
- [ ] Historical price adapter and correlation calculation
- [ ] Candidate persistence with provenance
- [ ] Research Gap intake and canonical evidence admission
- [ ] Newsroom/Presenter readback with verified candidate association
