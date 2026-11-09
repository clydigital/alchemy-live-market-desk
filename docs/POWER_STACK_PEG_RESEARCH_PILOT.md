# Power Stack 1Y PEG — private source-dated research pilot

Status: **private owner readback only; not a public Markets filter, not a scheduled provider feed**.

## Scope
- Reuses the **existing** Power Stack price-observation ledger rather than adding another Markets page/tab.
- Data stored in `power_stack_peg_research_observations` with owner-only SELECT RLS; no anonymous read, browser write, public API or token exposure.
- One-year forward PEG defined explicitly as `(dated quote / first forecast fiscal year EPS) / ((second forecast fiscal year EPS / first forecast fiscal year EPS - 1) * 100)`.
- If either EPS is nonpositive, forecast periods are not adjacent years, the quote and EPS currencies differ, or forecast growth is zero/negative, PEG is unavailable. Stale quotes and retrievals are labelled, not hidden.
- `retrieved_at` is the date a connected research plugin was read; `forecast_first_fy_end` and `forecast_second_fy_end` are **fiscal periods**. **None is an analyst-estimate revision timestamp.** `estimate_native_updated_at` is null unless expressly supplied by a provider.
- PEG here is a **research annotation**, never counted in the five-family technical alignment tally. Even PEG below 1 is not a buy recommendation.
- The FMP plugin returned analyst EPS forecasts and quotes for two eligible US holdings/watchlist names on 10 Nov 2026. Four further requests were plan-restricted. These are manually retrieved illustrative private research observations, not proof of full entitlement or automatic coverage.

## Provider and freshness boundary
The production project does not currently expose `FMP_API_KEY` or `FMP_API`. The ChatGPT-connected FMP tool cannot be assumed to grant that Vercel app an API credential or a public data-display licence. Do not silently query hundreds of symbols or insert `retrieved_at` as `estimate_native_updated_at`.

For proper scheduled PEG screening, separately verify licence/entitlement, estimate revision timestamps and EPS currency/normalisation, add a quota-budgeted server adapter and idempotent owner-snapshot persistence, then run live freshness tests.

## Verified migration/security
Supabase migration `20261109233058_power_stack_peg_research_owner_read_v1` was applied and RLS inspected: anonymous SELECT false; authenticated SELECT true with per-owner policy; authenticated INSERT false. Two initial owner-scoped research rows are present. The old quote ledger and all other research automations remain unchanged.

## Rollback
Revert Power Stack UI integration first, leaving audit history intact; schema remains owner-only. Never drop research history as a side effect of UI rollback.
