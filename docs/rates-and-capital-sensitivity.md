# Rates and capital sensitivity — research lens v1

Status: reviewed and integrated behind an off-by-default switch in Live's existing reasoning stages. This is a method, not current market evidence or a new scoring system.

## Purpose and provenance

When news materially concerns an asset, ask how financing costs, customer financing, investment needs and valuation transmit changes in rates into its outlook. Inspired by the user's manually supplied Traders Reality transcript on 7 September 2026. The linked video is excluded from acquisition for this task. Neither the transcript nor this document supplies verified current rates, company financials or forecasts.

## Corrections to retain

- Low debt limits direct financing exposure; it does not eliminate customer, valuation or currency exposure.
- Fixed debt generally reprices at refinancing, floating debt at contractual reset dates. Account for hedges, maturities, currency and credit spreads.
- Separate policy rates, market yields, real yields and corporate borrowing costs. Long yields can rise because of inflation expectations, term premium or supply even without an imminent policy hike.
- Market-implied probabilities are dated estimates derived from pricing, not central-bank promises. Do not infer precise hike odds from qualitative commentary.
- Easing due to disinflation differs from easing during a recession. Cheaper funding can coexist with falling sales and wider credit spreads.
- Gold, FX and crypto have multiple drivers. No mechanical direction rule; nominal unit price does not measure valuation or affordability.
- There is no fixed recession clock. Monetary policy is distinct from fiscal policy; central banks need not move together.

## Trigger and depth

For a material company catalyst or an explicit asset question, consider this lens inside existing analysis. Incidental ticker mentions do not require a new research job. Apply it only if relevant to the causal question; a regulatory or product event can remain the dominant explanation.

Use available dated evidence first. A missing rate or filing detail creates a precise research question, not a reason to stop the edition. Do not require all checklist fields for every company. Do not add output sections when rates are immaterial.

## Evidence to seek when an acquisition tool is available

Reuse a common macro snapshot across companies: relevant jurisdiction, policy rate and effective date, observed benchmark yields and timestamp, market-implied path and observation time, inflation, employment, growth, credit conditions and central-bank communication. Retain source URLs and distinguish observation dates from retrieval dates. A recent retrieval does not make an old observation current. Identify the latest available release; never assume a missing update is unchanged.

For the company, prefer latest 10-K/10-Q or local equivalents, subsequent material disclosures, debt notes and official guidance. Search is an efficient discovery route; verify consequential figures against primary disclosures where possible. Retain reporting period, currency, units and ratio definitions. Separate management guidance from realised performance. Never combine mismatched periods into a ratio without explanation.

Inspect the relevant subset of: gross debt, usable cash, net debt, fixed/floating mix after hedges, reset dates, maturity ladder, coupon versus refinancing yield, interest expense and coverage, operating cash flow, capex commitments, free cash flow, margins, revenue, guidance, customer financing and FX mismatch. Restricted cash is not freely available to repay debt. Debt-free and unknown debt are different states. Negative earnings or cash flow makes some coverage ratios uninformative.

Banks require asset/liability repricing, deposit costs, credit losses and capital analysis; insurers require liability matching; REITs need property cash flows and maturities; utilities need regulatory recovery and funding timing. Do not apply a generic industrial-company score to them.

## Reasoning sequence

1. Identify the catalyst and relevant financing jurisdiction/currency.
2. State what the supplied evidence establishes about rates and expectations, with dates. If unavailable, analyse conditional exposure only.
3. Trace financing, demand, capex and valuation separately. Identify offsets and the dominant channel.
4. Within the existing Scenario stage, consider baseline, higher-for-longer/hikes and easing only as relevant. Distinguish benign easing from distress. Discuss changes relative to market expectations only when pricing evidence exists.
5. Explain direction, horizon, countercase, next resolving evidence and uncertainty using existing output fields. An impact on earnings is not a numerical forecast of the stock price.

For illustration only, incremental annual interest is approximately unhedged floating principal times the change in applicable borrowing rate, adjusted for time exposed. For refinanced debt, use principal refinanced times the new all-in rate less old coupon, adjusted for timing. Avoid double counting the same principal, separate credit spreads from benchmark changes, and account for hedges and interest-income offsets. Do not compute a number if material inputs are missing. A hypothetical $2bn exposed for a full year to +1 percentage point adds about $20m before tax; this is not a company finding.

## Other assets

Bonds: duration, yield and credit spread. Gold: real yields, FX, flows and safe-haven demand. Crypto: liquidity, leverage and asset-specific flows. Property: refinancing, rents and capitalisation rates. Commodities: supply, demand, inventories and FX. Limited direct sensitivity is a valid conclusion; explain the remaining indirect channels without forcing a rates narrative.

## Runtime integration boundary

Activation requires `ALCHEMY_RATES_RESEARCH_LENS_ENABLED=true`. With the switch absent or any other value, existing stage instructions are unchanged. Keep it off in production until comparative model-output evaluation establishes that relevance and evidence quality are preserved. Run that evaluation in an isolated non-publishing environment; do not replay research into canonical production data. Existing completed checkpoints are not rewritten on activation. Disable the switch to revert future invocations; already published findings still require ordinary review.

Live's model stages currently reason over supplied evidence without browsing tools. This release embeds the compact rules below into Hypothesis and Scenario; Story Synthesis receives a preservation instruction. It adds no acquisition call, filing crawler, database field, timer, model stage or mandatory publication requirement. Existing evidence references and output schemas remain authoritative. Missing inputs stay explicit. This release does not claim to implement a refreshed macro cache or company-profile service.

Hybrid receives supported conclusions through the existing canonical Story publication path. Its presenter must not invent a second analysis or fill missing company data. Cranium or other chat consumers only gain the lens when their actual instruction path loads it; this release does not claim to install instructions into an unverified chat integration.

## Compact runtime rules

```text
Rates and capital sensitivity lens v1 (conditional, evidence-only):
When material to the asset's causal question, distinguish policy rates, market/real yields and credit spreads; date supplied observations and separate market-implied expectations from inference. Missing current data means unknown, never unchanged or zero. Do not recall rates or company ratios from training or creator commentary.
Trace relevant financing (fixed/floating, hedges, maturities), customer demand, capex/cash flow and valuation channels separately, including cash-interest offsets. Low debt is not immunity; fixed debt does not immediately reprice. Use sector-appropriate reasoning and supplied currency/period/ratio definitions. Quantify only with sufficient inputs and avoid double counting refinancing and floating exposure.
Do not force rates to dominate the catalyst, impose a checklist, add assets, invent evidence or change the output schema. This lens is not a source, score, publication gate or instruction to fetch data. Missing details can inform an existing resolving-evidence field without blocking useful research. No automatic gold/FX/crypto direction or stock-price prediction.
```

## Power Stack assessment and optional chat use

Eligible as a narrow qualitative overlay; not eligible as an automatic score modifier or replacement research mandate. Existing Power Stack work already assesses expensive capital, funded load, cash flow and macro conditions. Repeating that work as another mandatory workflow could dilute company research, duplicate penalties and consume the chat context window.

Do not install this full document as a repeated daily chat prompt. Do not change holdings-fundamentals, conviction scores, rankings, position sizing, technical levels or automation instructions solely because this lens exists. A material new company fact can still go through Power Stack's established review rules. No Power Stack chat message is dispatched in this integration.

Optional compact guidance for a future Power Stack chat integration: "Where material, explain how dated rates evidence transmits through this company's refinancing, customer financing, capex and valuation. Reuse existing macro research; distinguish direct exposure from offsets, identify one missing fact if needed, and preserve the existing research priorities and scoring rules. Unknown data is not adverse evidence. Do not double count risks already assessed."

## Review and acceptance

Reviewed against the current Live runtime and recent Power Stack research history. Chosen boundary: conditional instructions within existing stages. Residual risk: added instructions can still influence model attention; deterministic tests cannot prove improved reasoning quality. Before broadening, evaluate model outputs on representative cases using the same evidence and compare relevance, sourcing, completeness, latency and token usage.

Acceptance cases: low-debt growth company still has valuation/customer exposure; fixed debt with distant maturities has limited immediate repricing; near-term refinancing includes spreads; recession cuts can hurt demand; stale probabilities remain dated; absent debt mix produces uncertainty; supply-led commodity news retains its primary driver; financial institutions use sector logic. No case may invent numeric inputs, lower scores mechanically or block publication for missing rates data.

Rollback: remove the runtime helper call/import; existing contracts, persisted data and consumers require no migration.

## Reference anchors

- [CME FedWatch methodology](https://www.cmegroup.com/articles/2023/understanding-the-cme-group-fedwatch-tool-methodology.html): market-implied probabilities and assumptions.
- [Investor.gov corporate bonds](https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products): fixed coupons and bond risks.
- [Federal Reserve research on equity transmission](https://www.federalreserve.gov/econres/feds/files/2026023pap.pdf): multiple policy, yield and equity channels; research findings are not deterministic trading rules.
