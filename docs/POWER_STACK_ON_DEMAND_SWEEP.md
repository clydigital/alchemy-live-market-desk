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
