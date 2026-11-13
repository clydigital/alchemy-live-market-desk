# Crash vs Opportunity — automatically refreshed decision framework (14 November 2026)

## What refreshes, and what does NOT

This is a **read-only, on-request projection of existing scheduled pipelines**. It is not a new cron, Notion poller, creator-transcript scraper or independent portfolio model.

1. `getMarketMonitor()` supplies dated completed-session market proxies, issuer-agnostic market numbers, HY OAS and other observations.
2. Existing `publicMarketObservations() → buildMarketDivergenceWatch() → buildMarketCompassSummary()` supplies a conservative **four-ETF same-session 1D tape**; incomplete, unmatched or intraday observations fail closed.
3. Existing `buildCrashWatchView()` supplies seven research pillars, of which **five-session RSP versus S&P cash index** and **HY OAS over five dated points** can presently be scored. The other five are not converted into fabricated binary conclusions.
4. Existing publicly RLS-published `getPublishedMacroPulseBriefs()` supplies timely related research notes. The page filters by relevance, 7-day event clock, public source-link presence, and explicit `RESEARCH_DERIVED_UNADJUDICATED` status. Creator/social leads alone do not qualify. Those notes stay outside scenario scoring.
5. Existing `getPublicSourceObservations()` and `getRegimeShadowHealth()` retain their separate evidence-vintage, reviewed outlook and shadow-projector clocks.

The page rebuilds on the next request using new eligible source observations or already-published briefs. It **does not promise a background refresh interval**, prove that every feed is healthy or rewrite canonical Regime and Story conclusions. If publication stops, the relevant section must display a coverage gap.

## What the recent transcript research adds

Reviewed private creator research in Bluebelly includes:
- 11 Nov: Traders Reality's *priced-in/hawkish yields* bullish absorption hypothesis (user-supplied transcript without independently verified video timestamp).
- 13 Nov: FXEvolution's 200D semiconductor relief-trap countercase and TraderNick's growth-led rebound/gold-versus-real-yields thesis (third-party transcript mirror, not authenticated YouTube-native captions).
- 30 Oct–13 Nov: StockedUp, Mark Malek, Why X and related creator studies of financing constraints, private credit, margin spirals, capex/cash timing and Minsky feedback loops.

These are **questions, NOT admitted market facts**. The public code does not read private creator stores, disclose raw transcripts, infer private positions or promote a speaker's ETF flow numbers, 200D levels or predictions into verified events.

### Five research gates

| Gate | What source-dated data can currently say | What must be checked beyond automated proxies |
| --- | --- | --- |
| 1. Shock vs expectations | Same-session SMH/QQQ and RSP/SPY all up or all down (1D) | Pre-event consensus, first reaction clock and subsequent sessions |
| 2. Sellers vs absorbers | Five-session matched RSP versus SPX participation | Actual ETF creations/redemptions, market depth, 200D retest and breadth internals |
| 3. Credit transmission | Original FRED HY OAS over five source observations | CCC OAS, actual credit issuance, loan covenants, borrowing base and repo |
| 4. Business cash returns | Not yet admitted to a cross-issuer automatic market score | Issuer-paid cash demand, OCF, cash capex, leases, interest, maturity and revised forecasts |
| 5. Durable confirmation | Not inferred from market return alone | Higher-TF trend (20/50/100/200 EMA bands), 200D held close/retest, volume context, invalidation/stop |

**Three mutually competing, *conditional* scenarios:** durable recovery (1D risk-on + improving 5D breadth + HY OAS relief), temporary rebound/trap (1D risk-on while 5D breadth or credit contradicts), systemic risk escalation (1D risk-off + weak 5D breadth + widening HY OAS). Even all three observed signals aligning is **not** proof of earnings resilience, a forced-selling cascade or an executable trade; no scenario probabilities or buy/sell signals are calculated.

The five-session breadth is an **ETF versus cash index proxy**, not official equal-weight index methodology. HY OAS changes are **basis points**, not HYG returns. These are different source-session clocks, so a joint state does not establish a single-event causal response.

## Failure, freshness and evidence safeguards

- A missing, invalid, untrusted-domain, mismatched, future or older-than-eligible market reading cannot contribute to an aligned scenario; the existing watch applies source and time gates.
- 1D tape requires four matched ETF observations from a completed US market session.
- Published research must be published, dated, topic-relevant and include a non-social original/reporting source URL. It is *not* accepted into score, confidence, published Key Stories or canonical research automatically.
- **Research stage labels ≠ position orders.** Red on a crash scenario means observed warning alignment; amber on a trap means candidate squeeze; grey means insufficient data.
- No raw transcript retrieval, service-role client, mutable DB, cron, extra scheduled task, model inference or persistent watch decision inside the public route.
- Existing October 30/November 11 fixed research editions are explicitly archived/collapsed so that old commentary cannot impersonate the current state.
- Every source date displayed is an observation or source-publication date. "Viewed now" is not a market quote.
- Terminal use: **only promote to an actual investment/short idea after** issuer/technical corroboration, independent invalidation, entry range and risk budget. Power Stack remains the decision/execution interface.

## How a genuinely new creator transcript flows in

Existing Creator Intelligence schedule → authentic transcript retrieval with ledger and retry controls → private review (VIEW / MECHANISM / TRIGGER / COUNTERCASE / WHAT TO VERIFY) → primary-source + market-source verification → eligible publication (if separately approved) → public read-model refresh. A new private transcript **by itself never changes the crash gauge or public page**.

## Release check

Run repo tests/typecheck/build and confirm production deployment SHA READY. After deployment, uncached GET `/crash-opportunity` must display:
- `data-crash-live="existing-source-feeds-v1"`;
- 3 independently labelled scenarios with evidence status;
- 5 tests with measured/unmeasured statuses;
- `data-crash-automated-research="public-macropulse"` and public research/provenance;
- previous editions collapsed into dated archive;
- old `data-crash-research-verdict`, 7 pillars, historical mirrors and links remain intact.
