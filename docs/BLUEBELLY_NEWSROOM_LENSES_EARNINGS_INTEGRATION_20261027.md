# Bluebelly single-site plan — Newsroom/Lenses amendment, 27 October 2026

## Source of change
The separate Live Desk chat `6adfbddf-dd8c-83ec-97af-542fb2243ac6` ("Plan Bluebelly Newsrooms") supplied:
1. Three topical Newsrooms: AI Innovation, Geopolitics + Bonds, Stocks/Trading.
2. Add Fireship to creator sweeps and consider technical-transcript context.
3. Main finance interpretation from Traders Reality (expected versus actual, debt/credit, valuations); Shark Tank questions on investment terms and risk to different stakeholders.
4. Repair the weekly major-name Earnings Hub using original issuer dates and transparent estimates.

The parallel chat reports the existing 07:00 MYT creator sweep was updated to eight creators (including Fireship and Traders Reality), retaining 18 completed transcript reviews/day and **no additional scheduled task**. This branch **does not modify or independently re-claim that automation**.

## Changed experience, unchanged product architecture
Do NOT implement three extra public pages, independent cron jobs or canonical reasoning tables. These are **topic facets and analyst lenses** over existing canonical, source-qualified intelligence:

- **Today `/`**: lead news, source freshness, and optional topic lenses (AI Innovation, Geopolitics + Bonds, Stocks/Trading), reusing the same verified records and original-source links.
- **Stories `/key-stories`**: context facet with durable Story history. Do not label a transcript as confirmed market evidence.
- **Markets `/markets`**: monitored observed prices, rates, oil and equity reactions. Time-verified observations are mandatory for measured claims.
- **Calendar `/calendar#earnings-hub`**: current US Eastern Monday–Sunday company list, with provider estimates separately identified, prioritising material AI, funding and macro names. The 30-day spillover is subordinate, not a duplicate calendar.
- **Briefings `/daily-report` / private `/my-reports`**: one source-led chronological narrative across these lenses, not three competing PDFs. Existing **private** report publication gates and jobs remain authoritative.
- **My Desk**: same signed-in Bluebelly writing, presenter and personal PDF library.

## Four analyst questions (prompt/rubric specification; no production model prompt changed here)
For any relevant development, ask:
1. **Technology:** What independently verified capability/adoption changed? What benchmark or product limitation matters?
2. **Economics:** Who earns incremental revenue and operating/free cash flow? How much capex and capacity are required? Which results are source-dated?
3. **Financing shark:** Who puts up capital, on what equity/debt terms? What dilution, credit exposure or circular-financing incentive follows? Whose payoff differs?
4. **Trading:** What was expected, what was actually observed across dated price/credit/FX sessions, and what condition would invalidate the analysis?

Conclusions may explicitly say `UNKNOWN`, `UNVERIFIED`, or `NO MEASURED REACTION`. Good technology does not automatically establish good shareholder return. Large reported GAAP losses do not automatically establish equivalent operating cash burn. External creator transcripts and opinions enter research as attributed **leads** until primary sources, filings and source-dated market observations validate their constituent claims.

## What ships in this narrow PR
- Issuer-verified 28 October Microsoft/Alphabet and 29 October Amazon earnings notices in existing source adapter, retaining exact call-time versus date-only results timing.
- Existing Calendar's Earnings Hub now groups current **ET Monday–Sunday week** and later source-listed 30-day dates.
- Explicit confirmed-versus-provider-reported labels, real source URL, current source precision and investment-economics questions.
- Tests for no invented release clocks, expiry, original source references, and continued licensing restrictions. No new route, public data table, scheduler, private reports or Gemini prompt changes.

## Later distinct partitions — not bundled or concurrently modified
- P2 Facets: add topical filters to Today/Stories on existing `NewsBriefV1` and original-source projections, showing coverage and stale state; a filter should NEVER manufacture a trend, fill a blank verified-news feed from transcript opinions or write canonical Stories.
- P3 Evaluation rubric: adapt existing report/presenter narrative schema to **tech → business cash flow → financing → priced-in reaction → falsifier**, separately from parallel PDF work. Keep economic source IDs, investor disagreement and source coverage explicit.
- P4 Data health: evaluate research acquisition breadth and update the earnings provider when licensed/authorized. No scraping of third-party sites or invented estimates; no new tasks.
- P5 Legacy removal: after successful full Bluebelly owner OAuth and actual real private PDF generation/readback, migrate exact historical links and audit machine callers, then archive Hybrid and retire old Live human URLs. Keep canonical research backend.

## Conflict protection
The prior Bluebelly consolidation PR `#1053` already merged owner access. The parallel linked conversation owns creator sweep and transcripts, and ongoing separate work owns private PDF input quality. This PR changes **only Calendar / official earnings source adapter / pure calendar projection / tests / this document**. No schedule/provider secrets, storage/DB, canonical Dossier/Story, or Hybrid repo changes.

## Earnings presentation standard (28 October 2026)

The active recurring earnings briefing standard is now [Bluebelly Simple Earnings Scorecard](BLUEBELLY_SIMPLE_EARNINGS_SCORECARD.md). When a released issuer result is discussed, distinguish **beat/miss versus sourced pre-release consensus** from **up/down versus like-for-like fiscal period** for sales, profit, free cash flow and actual capital expenditure; separate management forward capex guidance. Explain it in one small table or 3–6 plain-English lines first, then one money/cash-conversion consequence and countercase. Use NOT REPORTED / NO COMPARABLE CONSENSUS when source evidence is absent. Scheduled MacroPulse, Research Gap, AI Bubble, and Writing Brain tasks have been instructed to use this rule without new tasks or authority changes.

