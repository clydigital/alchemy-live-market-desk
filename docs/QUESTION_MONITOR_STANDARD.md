# Question-Driven Case Monitor Standard

This is a hard product and research rule for every Alchemy Live Story and Hybrid investigation.

## Core rule

A case file is not maintained by adding generic updates. It is maintained by identifying the unresolved decision question and attaching the smallest set of live or regularly refreshed observations that can answer it.

Every case must be able to answer:

1. What is the unresolved question?
2. Which observation would directly confirm it?
3. Which observation would directly contradict it?
4. What is the latest reading?
5. What was the previous comparable reading?
6. How old is the observation?
7. What source produced it?
8. What remains unmonitored?

If the desk cannot answer those questions, the case remains explicitly unresolved or a coverage gap. Do not fill the gap with commentary.

## Evidence hierarchy

Use monitors in this order:

1. **Direct physical or official statistical observation**
   - vessel crossings, inventories, production, utilisation, employment, CPI, portfolio flows, filings, company cash flow.
2. **Derived market confirmation**
   - prices, spreads, yields, breadth, options, ETF proxies, relative performance.
3. **Official statements and primary-source guidance**
   - ministries, central banks, company IR, carrier advisories, official accounts.
4. **X / Twitter, YouTube and research intake**
   - useful for finding contradictions, claims and emerging events, but never allowed to replace direct physical or statistical confirmation.

A social/video signal may change what the desk investigates. It may not by itself flip a physical-status verdict such as "shipping has normalised".

## Required monitor fields

Every monitor should carry, where the source permits it:

- label;
- question it answers;
- current reading;
- previous comparable reading;
- delta;
- observation timestamp / source age;
- refresh cadence;
- source name and link;
- provenance or derivation note;
- confirmation condition;
- invalidation condition;
- state: confirming, contradicting, unresolved, or coverage gap.

Where a usable historical series exists, show a chart. Where it does not, show a compact **prior snapshot → now** comparison. Never label stale data as live. Surface the age visibly.

## Live vs Hybrid presentation

### Live

Live is the direct research surface. Show the deciding statistical/physical monitors, market confirmation and source watches on the Story page.

### Hybrid

Hybrid uses the same canonical monitor data, but preserves the investigation game:

- the case overview shows the direct deciding monitors and their current verdict;
- a visible Evidence Room notice tells the researcher that statement, X, YouTube and research-intake watches exist;
- statement/social/video watches remain inside the Evidence Room;
- the overview must not be dominated by commentary before the deciding data is inspected.

## Update gate

A dated Story update should only be promoted as a thesis update when it states how the new observation affects the unresolved question.

Bad update:

> New comments were made about negotiations today.

Acceptable update:

> Negotiations resumed, but completed commercial crossings remain below the case normalisation threshold. The update changes diplomatic probability, not the physical reopening verdict.

## Source fallback rule

Prefer a direct API or downloadable official dataset. If that is unavailable:

1. use a stable raw-data endpoint from a specialist monitor;
2. cache timestamped observations in Alchemy's own store;
3. show prior snapshot → now;
4. retain the canonical source URL;
5. mark the monitor stale or unavailable rather than substituting unrelated data.

Do not scrape a visual chart when the underlying data is available. Do not depend on browser-rendered chart pixels for a monitor that can be represented from raw values.

## Current active case monitor map

| Case | Central question | Primary monitor set | Secondary confirmation | Source watches / fallback |
| --- | --- | --- | --- | --- |
| `refining-crack-spread-stress` | Can crude fall while product tightness stays inflationary, and has Hormuz actually normalised? | Hormuz completed crossings / throughput; gasoline stocks; distillate stocks; refinery utilisation; gasoline and diesel crack spreads | USO / crude; product prices; refinery equities | Official carrier/insurer statements; verified X/YouTube claims; EIA WPSR fallback snapshots |
| `oil-physical-disruption` | Has the physical disruption actually cleared? | Hormuz completed crossings and 7-day trend; throughput; war-risk insurance; carrier posture; incident count | crude and freight response | WTO Trade Tracker; AIS context; official maritime statements; verified social/video claims |
| `fed-rate-repricing` | Is the front end validating a softer or tighter Fed path? | CME FedWatch probabilities; US 2Y; payrolls/revisions; CPI/core CPI | USD / UUP; curve shape | Fed statements; BLS releases; Treasury data |
| `productivity-labor-share` | Is productivity improving faster than labour income participation? | BLS productivity; unit labour costs; payrolls; real average earnings; retail sales | margins / cyclical market response | BLS API; Census releases; company labour commentary |
| `ai-capex-cash-conversion` | Is AI capex translating into cash generation and guidance? | company capex; CFO; FCF; capex/revenue and capex/FCF ratios; guidance | QQQ / AI basket vs yields | SEC Companyfacts/filings; company IR calls; verified model-demand evidence |
| `earnings-market-support` | Are strong results translating into broad index support? | post-earnings reactions; equal-weight vs cap-weight; breadth proxy | SPY, QQQ, RSP / QEW | company filings and guidance; exchange breadth if reliable |
| `yen-carry-unwind` | Is yen strength broad and persistent enough to represent a carry unwind? | USDJPY, AUDJPY, GBPJPY / NZDJPY breadth; US front end; Japan weekly securities flows | intervention warnings / rate checks; cross-asset volatility | Japan MOF weekly flows; BoJ/MOF statements; verified official-account posts |
| `fed-long-end-stress` | Is the long end restrictive because of term-premium/inflation stress rather than a clean Fed repricing? | US 2Y/10Y/30Y; 10Y breakeven; credit spreads | TLT; USD; equity duration response | Treasury/FRED data; Fed/Treasury statements |
| `china-ai-pressure` | Are cheaper Chinese models gaining enough real usage to pressure Western AI economics? | model usage share; token volume; model price/performance; release cadence | Western AI-equity relative performance | OpenRouter usage/rankings; Hugging Face; official model releases; company commentary |
| `mag7-guidance-dispersion` | Which megacaps are improving guidance faster than their capital burden rises? | revenue/earnings guidance changes; capex; CFO; FCF; capex intensity | post-earnings price dispersion | SEC filings; company IR; transcripts |
| `market-breadth-health` | Is index strength being confirmed by broader participation? | SPY vs RSP; QQQ vs QEW; % above 50D/200D where sourced reliably; advance/decline where sourced reliably | volatility and sector breadth | exchange/market data; never invent unavailable breadth series |

## Preferred free / public sources

### Hormuz and physical oil flow

- WTO Data Lab Strait of Hormuz Trade Tracker for daily trade-flow context and downloadable data.
- IMF PortWatch-derived completed crossing counts when exposed by a stable data provider.
- Straits.live status/raw endpoints as a convenient monitor and cross-check. Treat AIS presence as context, not a substitute for completed crossing counts.
- AISstream or another raw AIS feed only as a fallback/context layer when authoritative completed crossing data is unavailable.

### Petroleum products

- EIA Weekly Petroleum Status Report CSV tables for crude, gasoline and distillate stocks, refinery inputs/utilisation and spot product prices.
- Derived crack spreads must record the exact formula and contract/spot inputs. Do not mix spot and futures inputs without labelling the proxy.

### Rates / macro

- US Treasury downloadable daily rates.
- BLS public API for labour, CPI, productivity and earnings series.
- CME FedWatch for meeting probabilities.
- FRED or the original agency for breakevens and credit series where licensing permits.

### Companies / AI

- SEC EDGAR / Companyfacts APIs for filed financial data.
- Company investor-relations releases and transcripts for guidance.
- OpenRouter rankings/usage and official model releases for model-usage questions. Treat third-party AI leaderboards as corroboration, not company financial evidence.

### Japan

- Japan Ministry of Finance weekly International Transactions in Securities data.
- Ministry of Finance and Bank of Japan official statements for intervention/policy confirmation.

## New-case checklist

Before a new case file can be considered monitor-ready:

- [ ] central unresolved question is written as a testable sentence;
- [ ] at least one direct physical/statistical monitor is attached, or the absence is labelled a coverage gap;
- [ ] at least one confirmation/invalidation condition is defined;
- [ ] latest and prior readings are stored when possible;
- [ ] source age is visible;
- [ ] direct source link/provenance is recorded;
- [ ] market confirmation is separated from primary evidence;
- [ ] social/video/statement watches are separated from deciding evidence;
- [ ] Hybrid Evidence Room placement is defined;
- [ ] Live direct placement is defined;
- [ ] no generic update can change the case status without stating its impact on the central question.
