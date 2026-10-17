# AI Dossier V3: presenter explanation and monitored evidence

Status: **partitioned rollout, P0 diagnostic; P1 code proposed in draft PR**. This is not a new reasoning owner, database table, scheduled research job, accepted thesis version, or production Dossier.

## Canonical identity

- Current AI cost-of-capital Story: `261d7726-6503-4603-8570-055177846859` (AI Boom Hits the Cost of Capital).
- Prior verified thesis: version 7, `1f4130fc-b748-495b-a2ae-e4906ed90a98`, 2026-10-07 14:01:37.972967 UTC.
- Last read Dossier: `4044db3a-dd09-4ded-aa41-7f9394703fdd`, as-of 2026-10-17 17:24:46.235 UTC. Do not mistake the as-of time for incorporation of subsequent research.
- Independently observed `intelligence_evidence` UUID `55ad88f5-723b-4fdd-9a91-68e0cdd825f1`: `market-crack:smh_qqq_20s:2026-09-18:2026-10-16`. SMH price return minus **Nasdaq-100 QQQ ETF proxy** return, -4.18 percentage points over 20 *matched* sessions. Measurement, not a causal claim. Observe that the monitor's row id is `ndx` while its declared provider symbol is `QQQ`; confirm the precise underlying asset rather than representing this as NDX cash index.
- Latest Dossier evidence_governance does **not** contain that market-crack external ID. Its analytical Motion acceptance decision set is empty; neither absence proves System 2 defective. Trace the canonical admission/load/selection and eligibility boundary without shortcutting it.
- Recent Reuters-repeated FT Anthropic >10% offered junior-finance yield, CoreWeave unsecured bond quotations and the two Alchemy articles are **candidate research**. Neither a circulated proposed yield nor an equity decline confirms issuer default, wider market OAS or lower chip demand.

## Opening screen: six presenter questions

1. Which AI parts are financially succeeding versus merely performing well in share prices?
2. Is capital rotating across equity sectors, or leaving equities? Price-relative leadership alone is not a measured fund flow.
3. Which tailwinds persist (orders, cash generation, productivity) and which fears have intensified (refinancing, real yields, power/oil, utilisation, obsolescence)?
4. Which side wins on **fundamentals**, separately from market price action, and under which counterfactual?
5. Do dated SMH/QQQ, Brent, rates, credit and breadth technical observations align with those fundamentals?
6. Exactly which source-verified discriminator would change the present view?

Draft thesis, **not an accepted Story mutation**: AI demand and profitable suppliers remain more resilient than heavily leveraged infrastructure financing. Semiconductor leadership has weakened; that alone does not prove a physical AI investment rollover.

## Eight-screen research-to-presentation projection

1. One-paragraph market verdict; separate OBSERVED/SUPPORTED from INFERRED and unresolved.
2. Company-category winners and losers: chips/foundry, memory, cash-funded hyperscalers, neocloud, power/equipment, software; record financial strength separately from price direction.
3. Rotation: SMH/QQQ, equal-weight SPX, SPY/RSP, XLV/XLP/XLU/XLE, breadth and dated actual fund flow if available; avoid calling price returns capital flows.
4. Fundamental economics: invested capital / return on investment, **CFO minus cash PP&E**, asset lives/contract tenors, funding costs, price per unit of compute and paying customer utilisation. Differentiate total capex, AI-specific capex, leased/incurred capex and cash capex.
5. Bull vs bear: macro productivity and diffusion versus overinvestment/competition, discounted cash flows, credit accelerator and funding risk. Distinguish financial ROIC from economy-wide social benefit.
6. Oil/rates/credit transmission: Brent and WTI, oil products, CPI/PCE implications, 2Y/10Y real and nominal, HY/IG OAS and instrument-specific borrow costs, with matched timestamps.
7. Technical x fundamentals: human-supplied chart reading is non-canonical; show observed chart date/timeframe and source; never backdate a fundamental development into an older chart assessment. SMH/QQQ + Brent are key attention monitors.
8. What changes our minds? Describe 2-3 conditional paths: recovery, selective AI financing retrenchment, broad investment rollover. Do not invent probabilities.

**Source starting points**: [Opening Bell](https://alchemymarkets.com/education/market-insights/opening-bell/markets-are-complacent-is-wall-street-ignoring-the-warning-signs/) and [Weekly Outlook](https://alchemymarkets.com/education/market-insights/weekly-outlook/nasdaq-100-eyes-key-support-as-inflation-and-ai-concerns-shake-wall-street/). Those are editorial synthesis, not independent evidence for their own market claims.

## P1: current small monitor enhancement

- Reuse existing `market-monitor:brent`, not a new sensor/provider. `lib/dossier-v2/canonical-snapshot.ts` places Brent among mandatory snapshot market-monitor inputs, preserving all previously mandatory series (selection limit follows core-series count).
- Reclassify existing presenter `oil` check from Additional to Core **without changing key, value schema, user data, timestamps, storage version or 13-entry checklist contract**. The existing per-user cloud row remains authoritative; client normalisation displays its new grouping while retaining user-entered readings and history.
- `smh_qqq_20s` already exists as a canonical market measurement. **Do not create a duplicate calculation**.

## P0 unresolved canonical handoff

Pin one original supplier/issuer filing and one instrument-specific AI credit observation; prove original source identity -> `intelligence_evidence` UUID -> Dossier `evidence_governance` manifest -> System 2 decision or documented UNRESOLVED -> existing `story_thesis_versions` path -> Regime projector -> exact Hybrid readback. Do not mark passed based solely on a table insert, a lead Motion or a generatedAt timestamp.

## P2 before introducing a fourteenth manual checklist node

The 13-key presenter checklist is enforced in TypeScript **and** by Supabase JSON checks and guard trigger. Adding a persisted SMH reading requires a separate backwards-compatible migration, GET normalisation for old 13-key rows, actual database integration tests, revision-conflict preservation, existing history readback and account-private RLS verification. Do not sneak the key into the UI without the persistence contract.

## System 1 attention (no additional scheduler)

Use the existing bounded market-monitor ingestion and deterministic Dossier System 1 / Regime projector.

- **Semiconductor leadership**: completed-session SMH/QQQ return differences and divergence versus verified chip/foundry cash earnings; avoid treating a single weekly cross below an EMA as a Story change.
- **Rotation**: sector-relative returns and real breadth; actual investor flows require fund-flow receipts; differing sampling calendars must be declared.
- **AI financing**: separately classify direct issuer bonds/CDS, market HY/IG OAS, cash FCF, order revisions, utilisation and capex commitments; only comparable instrument tenors and timings can establish deterioration.
- **Energy**: add Brent to core with WTI, distillate and crack spreads; test physical supply, costs, pass-through and real-yield observations rather than assigning oil as the cause of a coincident equity move.
- **Freshness**: store distinct observation, publication, availability, ingestion and interpretation times. If newest telemetry postdates accepted Story interpretation, show INTERPRETATION PENDING or STALE.

## Acceptance and deployment gates

1. Dossier canonical snapshot includes source-linked Brent **without dropping HY/IG credit**; missing source returns UNAVAILABLE, not a fabricated quote.
2. Presenter oil remains the same key; original signed-in user's saved value/history survives. GET+PUT readback must be tested before release.
3. Existing deterministic `smh_qqq_20s` measurements preserve matched sessions and QQQ proxy labeling.
4. No new Story Regime writes, Motion evidence promotion, extra scheduler or unrelated migrations in this partition.
5. Validate tests/CI, then compare exact publication and Dossier IDs in production before declaring a Live/Hybrid update.
