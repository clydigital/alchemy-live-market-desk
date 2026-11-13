# Power Stack issuer valuation underwriting — v1

**Scope:** owner-only, manually reviewed issuer valuation candidates. A source-dated PEG research note, a sharp price decline, or a shared macro theme **cannot** independently promote a security to "Potential Mispricing."

## Canonical evidence and reviewer workflow

1. Confirm the security is an operating-company equity in the already-verified owner-tracked set. Exclude funds, ETFs, government bonds, broad commodity proxies and unrelated names.
2. Record an **actual source-dated regular market quote**, currency and original market price URL. Upstream refresh-batch timestamps (such as a data vendor's refresh job) do not count as exchange sessions.
3. Retrieve original issuer filings for the reported financial period. Record operating cash flow and capital expenditures using consistent reporting currency and period (FCF proxy = operating cash flow minus capex). Supplement with revenue, net income, share-based compensation and net debt where valid.
4. Separately document an analyst-reviewed per-share valuation range and its method: DCF, FCF multiple, earnings multiple, sum of parts or comparables. Include a **third distinct valuation-model source link**, at least 80 characters of economic rationale, a downside case and a specific invalidation test. The range must be in the **same currency as the share quote**, with unit adjustments already reconciled by the reviewer.
5. Insert the original source receipts into the private `power_stack_issuer_valuation_reviews` table **only via a separately authorized privileged review/ingestion process**. No public write endpoint, schedule, autonomously generated model values or browser insert is introduced. The table rejects mismatched valuation currencies and duplicate source URLs; RLS restricts read access to the authenticated owner.
6. The owner UI projects only current, accepted records (review age ≤45 calendar days, price source session ≤6 calendar days old, issuer financial period ≤210 calendar days old). Failing any source, period, rationale, URL or date check hides the reviewed model verdict and leaves an explicit research gap. It does not silently carry forward a stale bargain.
7. For a valid comparison, distinguish **below reviewed range** (price below 90% of the low case), **above reviewed range** (price above 110% of the high case) and **within reviewed range**. Ten percent is a conservative presentation buffer, not a backtested edge, confidence interval or target. FCF losses, earnings losses and unusually large equity compensation relative to operating cash flow remain conspicuous caution flags.
8. The table is owner-only *research history*; existing `power_stack_quote_observations` and `power_stack_peg_research_observations` remain read-only historical context. A one-year PEG below 1, future analyst FY labels or a source retrieval timestamp never imply fair value or estimate-revision recency.

## Exact fields and provenance

`ticker, reviewed_at, review_status='SOURCE_REVIEWED', price_observed_on, market_price, price_currency, price_source_url, source_timestamp_basis='market_session', valuation_low, valuation_high, valuation_currency, valuation_method, valuation_source_url, method_explanation, downside_case, invalidation_test, financial_period_end, fundamental_source_url, revenue, net_income, operating_cash_flow, capital_expenditure, share_based_compensation, net_debt, reviewer_note`.

Amounts in the financial statement metrics must use a **consistent issuer reporting unit** (e.g. USD millions). The interface labels the FCF proxy with the review's currency but the input units must be understood; the UI must not imply an absolute dollar total if the reviewer reported millions. Source records should disclose units explicitly in the reviewer's method note. There is no adjustment for acquired intangibles, lease accounting, maintenance vs growth capex, dilution, future share count or net cash unless documented in the valuation model.

## Rollout fence

- New schema migration: `supabase/migrations/20261113013000_power_stack_issuer_valuation_reviews_v1.sql`.
- Application component: `PowerStackValuationWorkbench`, rendered **only after** authentication, allowlist and verified retirement of the old public source.
- If production migration is absent or its read fails, the review store is marked unavailable and only the existing owner PEG/quote coverage gaps are displayed. Do not suppress errors and claim zero candidates.
- No seed valuations, holdings, orders or watchlist scores are changed.
- Test: source mismatch, snapshot duplicates, period dates, future sources, negative FCF/losses, private access fences, authenticated SELECT/INSERT boundaries, mobile layout, complete application build.
