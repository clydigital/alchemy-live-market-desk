# Reader-Safe Provenance and Research Data Watchlist

## Purpose

Live Desk owns canonical research. Hybrid presents that research. Both must preserve traceability without turning internal database identifiers into reader-facing prose.

This document records the presentation rule and the preferred data sources for the current divergence-led research workflow.

## Reader-facing provenance rule

Traceability and readability are separate requirements.

### Reader-facing prose

Story titles, theses, explanations, contradictions, catalysts, article angles, Dossier prose, Overview text, What's New text and Hybrid narrative must use normal market language.

Never place any of the following directly into reader-facing prose:

- raw evidence IDs;
- source IDs;
- UUIDs;
- filenames or upload handles;
- ingestion keys;
- provider record keys;
- strings such as `ASDA-file...`;
- parenthetical dumps of internal references.

Bad:

> Credit is widening while AI equities remain strong (ASDA-file140129-35159-, ev_4f91..., source_id ...).

Good:

> AI equities remain strong while the financing layer is demanding more compensation.

The source publisher, title, timestamp and link belong in the evidence/source UI. Internal identifiers remain available only in structured audit/reference fields.

### Technical audit surfaces

Internal IDs may remain persisted for deterministic linking, deduplication, lineage and replay. If they are exposed at all, they should sit behind an explicit technical/audit control, not in the reading path.

Hybrid must not turn structured `evidenceRefs` into prose. It should show readable source information or a reference count and let the evidence drawer resolve provenance separately.

## Source hierarchy

Prefer, in order:

1. official releases, regulators and filings;
2. exchange / official market data;
3. high-quality wires and reporting for events not directly published in structured primary data;
4. licensed specialist data;
5. creator/commentary material only as research leads until independently verified.

Do not bypass access controls or scrape around CAPTCHAs, authentication or licence restrictions. A blocked source is a data-quality state, not permission to infer the missing reading.

## Current data watchlist

### 1. AI funding / capital scarcity

Research question: can AI equity and adoption momentum remain strong while financing quality deteriorates?

Preferred inputs:

- SEC EDGAR / XBRL: debt, guarantees, commitments, capex, free cash flow, tenant/customer concentration;
- issuer filings and prospectuses for project-finance and guarantee structures;
- Reuters and other high-quality reporting for secondary-market project-debt marks and new-issue concessions;
- FRED broad IG/HY option-adjusted spreads for the market baseline;
- issuer/project spread and TRACE-style data when available under an authorised feed;
- hyperscaler debt issuance calendars and pricing;
- authorised sector/credit datasets plus TradingView or Koyfin for manual chart discovery; neither is a runtime dependency.

Key charts:

- ORCL and NVDA relative performance;
- broad IG / HY spreads;
- AI issuer spread or project-loan marks;
- new-issue concessions versus equity performance.

### 2. Rates / Fed transmission

Research question: if oil falls, are front-end and belly yields still restrictive because of demand, policy or debt supply?

Preferred inputs:

- FRED: 2Y, 5Y, 10Y Treasury yields;
- FRED real yields and breakevens;
- Federal Reserve statements, speeches, minutes and projections;
- Treasury refunding, auction and borrowing data;
- fed-funds / SOFR futures when an authorised market-data source is available;
- corporate issuance calendar and concessions;
- FRED real-yield/breakeven series, Treasury data and authorised futures feeds; TradingView/Koyfin may be used manually for chart discovery.

Key charts:

- US02Y / US05Y / US10Y;
- real yields;
- breakevens;
- WTI alongside rates;
- curve changes such as 2s10s and 2s30s.

### 3. Energy: financial crude versus physical products

Research question: is lower crude actually resolving the inflationary energy shock?

Preferred inputs:

- EIA Weekly Petroleum Status Report / API;
- distillate inventories;
- refinery utilisation;
- product supplied and exports;
- WTI / Brent / ULSD and crack spreads from authorised market feeds;
- pipeline and official operator notices where available;
- shipping, tanker, insurance and physical-flow reporting from Reuters;
- Kpler or S&P Commodity Insights when licensed;
- EIA Open Data v2 for weekly petroleum state, plus authorised shipping/physical-flow sources when available.

Key charts:

- WTI versus ULSD;
- distillate crack proxy;
- refinery utilisation;
- distillate inventories;
- tanker/freight measures.

### 4. Financials / agentic disintermediation

Research question: is financial underperformance mainly curve sensitivity, credit stress or a new AI-disintermediation premium?

Preferred inputs:

- SCHW, AMP, RJF, XLF, KRE and major-bank prices;
- 2s10s curve;
- Fed bank-credit and lending data;
- Senior Loan Officer Opinion Survey;
- IG/HY spreads;
- private-credit redemption / liquidity reporting;
- company filings and product announcements for adviser-agent integrations;
- FRED/SLOOS plus authorised credit/CDS and bank-funding data where available.

Key comparison:

- wealth managers versus lenders while controlling for the curve.

Do not call a current selloff "AI-driven" without current relative-price evidence that survives the rate/curve check.

### 5. Breadth / leadership quality

Research question: is the rally broadening or still concentrated in AI and semiconductors?

Preferred inputs:

- SPY / QQQ / RSP / IWM / SMH / KRE;
- advance/decline;
- 52-week highs minus lows;
- percentage above 20-day and 50-day averages;
- sector relative strength;
- authorised breadth/volatility feeds; TradingView may be used manually for chart inspection.

Never collapse all breadth measures into one score without preserving their time horizon.

### 6. Gold / defensive divergence

Research question: is gold becoming persistently strong despite a firm dollar and real yields?

Preferred inputs:

- XAUUSD;
- DXY;
- 10Y real yield;
- GDX / GLD relative strength;
- ETF flows;
- central-bank purchase data where current and attributable;
- FRED real yields and breakevens plus authorised ETF-flow data when available.

### 7. Positioning / market structure

Preferred inputs:

- CFTC COT official data;
- options gamma / open interest / skew from authorised feeds;
- futures positioning where licensed;
- CFTC COT official data and authorised futures-positioning feeds;
- creator positioning claims only as leads until reproduced.

Historical creator statistics must include sample dates, sample size and forward-return distribution before they affect a Story conclusion.

## Optional third-party website rule

Public chart websites are not canonical runtime dependencies.

The Dossier data path should prefer stable machine-readable sources: FRED and official agencies for macro/rates, EIA Open Data v2 for energy, and Trading Economics only through its authenticated API for optional U.S. event-surprise enrichment.

Therefore:

- never require browser scraping, anti-bot workarounds or authenticated browser sessions for Dossier health;
- treat Trading Economics and EIA enrichment as optional: unavailable or unconfigured providers must not degrade an otherwise healthy Dossier;
- preserve the source's raw actual, consensus, previous and timestamp fields before deriving surprise values;
- keep TradingView/Koyfin as human investigation and chart-discovery tools rather than unattended backend dependencies;
- prefer official APIs or authorised feeds whenever a source becomes fragile or blocked.

## Publication check

Before Live or Hybrid renders new research, ask:

1. Is every reader-facing sentence understandable without an internal ID?
2. Is provenance still available separately through source/evidence controls?
3. Are creator claims visibly separated from independently verified facts?
4. Are partial or blocked data sources labelled rather than silently filled?
5. Are market-data timestamps current enough for the conclusion being made?
6. Does Hybrid preserve the canonical Live conclusion instead of generating a second interpretation?

If the answer to any of the first five is no, the research can remain in the evidence/audit layer but should not be promoted as polished reader-facing copy.
