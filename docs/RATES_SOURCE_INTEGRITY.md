# Rates Source Integrity — Operating Contract

## Purpose

The market monitor can be correct while a persisted Dossier silently drops a Treasury observation. Conversely, a stale official publisher feed is not a broken Live Desk integration. This contract checks **provider observation → Live monitor → persisted Dossier evidence** without reanalysing, rewriting or fabricating market facts.

## Endpoints and schedule

- Production read-only endpoint: `GET /api/rates/source-integrity` (`rates-source-integrity/1`).
- GitHub `.github/workflows/rates-source-integrity.yml` checks every six hours at minute 17 UTC, plus manual `workflow_dispatch`.
- One open GitHub issue per active `WATCH`/`ACTION_REQUIRED` severity; close on recovery/change. GitHub Actions fails on `ACTION_REQUIRED`, making repository status conspicuous.
- The endpoint never persists a Dossier, modifies Story/Regime state, calls a reasoning model, or requests protected vendor data.

## Explicit input contracts

| Required input | Source of truth | What the check compares |
| --- | --- | --- |
| DGS2, DGS5, DGS10, DGS20, DGS30 / Treasury nominal | Official source-dated market monitor (FRED, Treasury fallback) | One latest observation per maturity against exact stored `market-monitor:<id>:<YYYY-MM-DD>` curve evidence |
| New York Fed primary-dealer positions/fails | `markets.newyorkfed.org/api/pd/...` source observation date | Upstream publication age (14 calendar days) and explicit failed acquisition |
| CME FedWatch intraday | Official licensed CME data, if independently integrated in future | **NOT_ENTITLED_OR_NOT_INTEGRATED** until a verified direct adapter exists |
| ICE MOVE | Existing Barchart `$MOVE` adapter with an authorised entitlement | `move.state` reflects a dated observed index level, stale source or adapter present with no verified data; absence must not be called no implementation |
| Intraday US 2Y/10Y Treasury yields | Timestamped direct underlying quotes/bars, if integrated in future | **NOT_ENTITLED_OR_NOT_INTEGRATED** until validated, never derive intraday tape from a daily constant-maturity yield |

## State machine

- `COMPLETE`: dated observation is in the persisted Dossier rate curve by exact ID.
- `PENDING_REBASE`: the provider update was later than the Dossier as-of; a newer Dossier is naturally needed (not a bug).
- `DOWNSTREAM_LOSS`: provider observation precedes Dossier as-of and is eligible, but the persisted curve lacks it. **ACTION_REQUIRED**.
- `UPSTREAM_STALE`: observed date exceeds the fixed five-day Treasury or fourteen-day dealer age bound. **WATCH**; do not pretend fresh.
- `UPSTREAM_UNAVAILABLE`: missing/failed source observation. **WATCH**. Do not replace it with an ETF or assumption.

The Dossier coverage count below 5/5 is an actionable consistency condition; the stored count and exact source IDs are checked separately. The endpoint keeps `inaccessibleDirectFeeds` distinct from source failures, so missing commercial entitlements cannot masquerade as failed configured connectors.

## Repair path

1. Check `/api/rates/source-integrity`, record generatedAt, `dossier.id`, `dossier.asOf`, per-tenor observation dates, source URLs and exact evidence references.
2. If *upstream stale*: check the original official publication site and schedule; do not force a Dossier rebase, lower the threshold or substitute inferred data.
3. If *upstream unavailable*: investigate provider HTTP/response/parser, declared fallback and per-tenor monitor log events. The source timestamp must survive.
4. If *downstream loss*: inspect canonical market monitor selection → input packet rate context (five tenors reserved before 24-evidence cap) → persisted `system1_rate_regime.curve.evidenceRefs`; run an authenticated dry-run, then the audited rebase path only after validation.
5. If *commercial direct feed absent*: open an explicit evidence acquisition/integration task. It remains unresolved in analytical outputs. FedWatch odds cannot be created from policy opinion, MOVE cannot be rewritten as VIX or VIXY, and daily DGS yields cannot certify CPI-day intraday reactions.
6. Confirm live UI, API and DB evidence references agree; use immutable IDs/observation dates rather than page-generation timestamps.


## Mandatory rate-input coverage (separate from nominal tenors)

The **five required Dossier rate inputs** are US 2Y, US 10Y nominal, US 10Y real, US 10Y breakeven and effective Fed funds. This requirement is different from the full nominal Treasury curve of 2Y/5Y/10Y/20Y/30Y. The integrity endpoint independently reports `requiredRateInputs.present`, `missing` and per-input diagnostics.

For a missing rate input, an actual verified dated provider observation that was already eligible by the persisted Dossier's `asOf` creates `ACTION_REQUIRED`, even when all five nominal maturities are complete. Source-lag, missing official observations and later retrievals stay `WATCH` rather than being misclassified as lost evidence. Same-day FRED receipts count only when the monitor's actual retrieval timestamp preceded that specific Dossier run within fifteen minutes. No inference from current page generation time or future market values is permitted. A coverage count of 4/5 with no missing labels is a presentation contract failure.

A source-health WATCH caused by the New York Fed dealer publication delay must **not** hide a second WATCH from newly missing required rate data. Operational issue bodies should reflect the current alert set, rather than merely retaining a status-only title.

## Five-session movement integrity

The monitor now derives a five-session Treasury **basis-point** change from six actual, date-matched nominal observations across all five tenors. The Dossier rate-curve diagnostic must retain every computable movement. `fiveSessionCurve.state=DOWNSTREAM_MEASUREMENT_MISSING` raises `ACTION_REQUIRED` if the latest 5/5 dated curve is in the stored Dossier but one or more 5D bp movements have disappeared. A newer unpublished/missing Dossier or non-comparable history is not mislabelled as a calculation failure. This is a defensive sensor, not permission to promote analysis or fabricate missing data.

The Barchart `$MOVE` adapter has already been implemented in the source tree. `move.state=ADAPTER_PRESENT_NO_VERIFIED_DATA` covers missing/unconfigured/unentitled or failed data without guessing which. `OBSERVED` requires an actual dated source row; `STALE` emits a warning. No VIX substitute is labelled MOVE.

## Regression prevention

- `tests/rates-source-integrity.test.ts` locks in 5/5 completeness, Dossier source loss, upstream delay, unavailable feed, prior-vintage timing and MOVE/FedWatch entitlement fences.
- Existing `tests/full-us-treasury-curve.test.ts`, `tests/dossier-weekend-fred-rate-context.test.ts`, `tests/treasury-nominal-curve.test.ts`, and `tests/dossier-same-day-treasury-admission.test.ts` preserve source selection, bounded evidence admission and no lookahead.
- The GitHub watch creates one deduplicated issue on continued non-OK state and closes it on recovery. A source-integrity issue **does not** automatically initiate model calls, overwrite the Dossier, or change the Regime.

## Publication cadence caveat

NY Fed dealer statistics are typically updated weekly with previous-week data. Publication latency must be measured from the **reported data as-of**, not the HTTP response or monitor run time. An official server reporting an old weekly observation is an upstream lag, even if GET returns HTTP 200.
