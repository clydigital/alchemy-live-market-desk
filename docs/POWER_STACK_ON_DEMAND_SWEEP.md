# Power Stack — manual multi-market research sweep

## Reader contract
- Private Power Stack route `/power-stack` remains Google-gated and owner-scoped.
- Existing `power_stack_owner_snapshots` is an immutable imported archive, not the editable live research ledger.
- Source-dated, currency-specific observations go to `power_stack_quote_observations`; a price is never substituted for a broker execution or holdings quantity.
- User-requested bond research remains in `power_stack_idea_tracker`, with `macro_reason` beginning `Bond Watch role ...`; `peg` remains null for bond ETFs.
- Page shows bond watch and its latest source-dated TLT quote; the full quote ledger and per-ETF rationale are collapsed by default.
- `ingested_at` means storage time; `observed_on` is the provider date. iSaham `upstream_batch` must NOT be called an executed trade time.

## On-demand research paths (not all are background APIs)
- ChatGPT connected Longbridge quote plugin: US canonical `SYMBOL.US`, Hong Kong canonical `CODE.HK`, Shanghai `688825.SH`. Store original Power Stack ticker, exchange currency and exchange-local observation timestamp. **These ChatGPT plugin credentials are not available to Vercel automatically**.
- Bursa Malaysia: source-date-verified official issuer/market end-of-day pages for equities. A named ticker with MYR holdings metadata must be verified against Bursa code. The iSaham private credential may still be restricted with 403; fail closed, do not spend on an unauthorized quote sweep.
- Crypto: exchange-sourced quote time; label a bid/ask midpoint as indicative, not a last trade or EOD close.
- The YTL Power `6742UW` unlisted warrant is an instrument requiring a separate contract-adjusted value methodology. Do not invent an executable market price.
- Special caution with `forwardPEG`: an undated vendor value or cyclically inflated EPS-growth denominator is a screen flag only, not independent investment evidence. Preserve prior theses and issuer source lineage.

## Bond watch (ETF investment ideas, not owned positions)
Core rates: TLT, IEF, TLH, SHY, SGOV, USFR, GOVT.
Inflation: TIP.
Credit: AGG, LQD, HYG.
High convexity/ultra-long duration: EDV, ZROZ.
Bond context: 2Y/10Y/20Y/30Y nominal, 10Y real yield, breakeven inflation, Fed policy expectations, auction demand/term premium, IG/HY credit spreads and stock/bond correlations. Real yield versus breakeven is critical: a TIPS ETF is not automatically protected against higher real yields.

## Operational policy
- Trigger fresh scans only on explicit user request. Do not treat a ChatGPT connector read as equivalent to production API entitlement.
- Refresh a ticker only when source data is missing/stale or a material event warrants it; group requests by venue and observe quota.
- Append dated observations rather than rewriting historical market or portfolio facts. Keep private holdings and notes out of GitHub source.
- Do not run another scheduler or paid-tier job. Existing legacy quote cron is independently retired only after manual ingestion and site readback have been verified.
- Keep the risk/decision conclusion source-aware: macro alignment, earnings revisions, technical confirmation and failure/invalidation gates all matter.

## Mandatory shared EMA Scanner review (27 Nov 2026)
For every owner-requested manual sweep, read current BB regime, credit/rotation/breadth and fresh admitted research (including creator transcripts and counterevidence). Then open the Technical Watch band-state decision queue in PowerStack or the owner EMA Scanner (/market-tools?view=technical-scan&scope=ps). Do not infer current readings from old screenshots, archived dossiers, this document or prior recommendations.
- Same canonical 20/50/100/200 EMA with widths 1/1/0.5/0.25 population SD. Assess each period separately. M structural context; W investment bias; D setup; 4H execution only. W/M quick view is latest completed daily close versus prior completed anchors; inspect native closes if necessary. Do not count 4H as an investment vote.
- Outward exits up/down are candidate changes, not automatic trades. A break plus two subsequent same-side verified closes confirms a hold. Approaching up/down means a converging edge, not an exit. Inside arrows remember last outward exit, never the midpoint or the direction of re-entry. Unknown direction stays unknown (bounded 60 contiguous observations). Daily respected support/resistance and its retest/reset evidence outrank a historical arrow; a new support failure gets risk review.
- Review holdings first for downside/invalidation, recovery, then approach/retest. Review saved ideas and archived candidates separately; archived intent is historical, not an active order. Broader BB candidates are discovery only. Identify the actual EMA period, boundary, current and prior observations, date, source, latest respected edge and invalidation. State W/M conflicts and missing frames; never average all periods into a fabricated trend score. No live price inferred for 6742UW; real estate remains valuation-only.
- Matt (macro): assess current risk regime and scenario probabilities against BB tape, credit, yields, rotation and fresh research; distinguish conflicting evidence from missing coverage. Technical reviewer: inspect every relevant period and identify decisive band, hold/retest, next levels, risk and invalidation. Fundamental reviewer: compare normalized earnings/free cash flow, financing, valuation and issuer-specific thesis against current evidence; test downside. Portfolio reviewer: consider concentration, liquidity, currency, position role, and opportunity cost; specify staged sizing only after user risk parameters and actual holdings are known.
- Output per reviewed holding/idea: ticker, industry/theme, holding or watch status, source-dated price, D/W/M band/last exit, optional 4H timing, macro and fundamental reason, Buy/Add/Hold/Trim/Exit/Watch **research recommendation** (or Unassessed), trigger/levels, invalidation and what would change the view. Do not treat a technical recovery as value, or sell solely because an EMA breaks. When fundamentals or price coverage is unverified, show research gate not a fabricated verdict. Confirm current holdings independently when archive quantities are stale.
- Coverage failures: stale source, gaps, short warm-up, local calendar uncertainty, unavailable history and conflicting sources are explicit; never turn missing observations into "no signal." Read-only shared BB source; no new provider fanout, scheduler, database writes, or automatic orders.
