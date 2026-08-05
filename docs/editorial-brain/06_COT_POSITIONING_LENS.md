# COT Positioning Lens

## Purpose

The Commitments of Traders layer is a required positioning perspective within the Original Live Market Desk research process.

It is not a standalone directional signal and it must not replace macro, price, policy, physical-market or company evidence.

Its job is to answer:

> How are major participant groups positioned, how unusual is that positioning, how quickly is it changing, and could it confirm, contradict or amplify the active story?

The COT lens is applied after the desk has identified the event, story and expected transmission mechanism, but before the final editorial ranking and Hybrid presentation snapshot are approved.

## Source hierarchy

### Canonical source

The Commodity Futures Trading Commission is the Tier 1 source.

Use the appropriate official report family:

- Traders in Financial Futures for currencies, rates and equity-index futures;
- Disaggregated COT for energy, metals and physical commodities;
- Legacy COT only where a better participant breakdown is unavailable or for long historical comparison;
- Supplemental Commodity Index Traders data where relevant.

The canonical record stores both:

- report date, normally the Tuesday observation;
- publication date, normally the following Friday.

The lag must remain visible. COT is weekly positioning context, not live intraday flow.

### Secondary perspective

COTSignal may be used as:

- a visual benchmark;
- a secondary interpretation check;
- a fast way to notice unusual weekly changes or historical extremes;
- design inspiration for Alchemy heatmaps and drill-downs.

COTSignal must not silently replace official CFTC data or become the only evidence for a positioning claim.

Unless a licensed API or redistribution agreement exists, the desk should reproduce the analytical method using official data rather than scrape, copy or embed proprietary presentation output.

## Required calculations

For each contract and participant group, store or calculate:

- gross long position;
- gross short position;
- net position;
- weekly change in long, short and net position;
- four-week change;
- position as a percentage of open interest;
- change in open interest;
- 52-week percentile;
- three-year percentile;
- five-year percentile where history permits;
- z-score relative to the selected lookback;
- distance from the historical maximum and minimum;
- participant concentration where available;
- price move over the same observation window;
- divergence between price and positioning;
- report age and freshness state.

Display window and historical lookback are separate controls.

Example:

- chart display: 26 weeks;
- historical comparison: three years;
- current leveraged-fund net position: 93rd percentile;
- weekly change: +11 percentile points.

## Participant mapping

### Financial futures

Use:

- Dealer/Intermediary;
- Asset Manager/Institutional;
- Leveraged Funds;
- Other Reportables;
- Non-reportables.

### Physical commodities

Use:

- Producer/Merchant/Processor/User;
- Swap Dealers;
- Managed Money;
- Other Reportables;
- Non-reportables.

The interface must not compare participant categories as though their economic purpose were identical.

## Positioning states

The desk may classify a participant-contract observation as:

- historically light;
- under-owned;
- neutral;
- elevated;
- crowded;
- extreme;
- rapidly building;
- rapidly unwinding;
- price-positioning divergence;
- stale or inconclusive.

These are descriptive states, not trade instructions.

## The COT story filter

Every story linked to a covered futures market receives the following checks.

### 1. Exposure check

Which participant group is most relevant to this story?

Examples:

- leveraged funds for carry, momentum and short-term macro positioning;
- asset managers for institutional duration or index exposure;
- managed money for commodity speculation;
- producers and merchants for physical hedging context.

### 2. Historical-extreme check

Is current positioning unusual relative to:

- one year;
- three years;
- five years;
- the current economic cycle?

The chosen comparison must be stated.

### 3. Change check

Is positioning:

- stable;
- building;
- unwinding;
- reversing sharply;
- changing faster than price?

### 4. Price-confirmation check

Does price action confirm the positioning story?

Examples:

- crowded JPY shorts plus a broad yen reversal can amplify an intervention story;
- crowded gold longs with weak price follow-through can indicate exhaustion or hedging complexity;
- light oil length during persistent physical tightness can challenge a bearish crude narrative.

### 5. Catalyst-amplification check

Could current crowding make the next catalyst more powerful?

The desk records:

- catalyst;
- exposed participant group;
- likely unwind or extension channel;
- assets affected;
- confirmation threshold;
- break condition.

### 6. Contradiction check

Does positioning weaken the accepted story?

Examples:

- a supposedly consensus-long asset may actually be lightly held;
- price strength may be occurring while leveraged exposure falls;
- a macro narrative may be widely discussed but not visible in futures positioning.

### 7. Lag and relevance check

Because the observation is delayed, the desk must ask whether a major event occurred after Tuesday that may have already changed positions.

If so, COT is labelled:

- pre-catalyst context;
- stale for the immediate move;
- useful only for vulnerability or baseline exposure.

## Integration with the editorial brain

COT should be added to the market-pricing and evidence process, not treated as a disconnected module.

The canonical Decision Brief gains a required field when a covered contract is relevant:

### Positioning perspective

- relevant contract;
- report family;
- participant group;
- current percentile and lookback;
- weekly and four-week change;
- price relationship;
- whether positioning supports, contradicts or merely amplifies the story;
- data lag caveat;
- next COT release date;
- linked History Cabinet record.

The final judgement is one of:

- supports the thesis;
- contradicts the thesis;
- increases squeeze or unwind risk;
- reduces crowding concern;
- neutral;
- stale or not useful.

## Story-ranking effect

COT can change a story's rank only when the positioning link is direct and material.

Examples of valid promotion:

- extreme JPY shorts ahead of confirmed intervention risk;
- rapidly rising Treasury-futures shorts before a decisive inflation release;
- unusually light oil length while physical evidence remains tight;
- crowded equity-index positioning combined with weakening breadth and a near-term catalyst.

COT alone cannot promote a story to Today's Lead.

It must be paired with at least one of:

- material event;
- macro release;
- policy catalyst;
- market-price confirmation;
- physical-market evidence;
- earnings or guidance development.

## Original Live Desk presentation

The Original should include:

### Positioning heatmap

Rows:

- contract;
- participant group;
- net position;
- percentage of open interest;
- weekly change;
- 52-week percentile;
- three-year percentile;
- state;
- linked story.

### Largest changes

Rank:

- largest weekly builds;
- largest weekly unwinds;
- new historical extremes;
- strongest price-positioning divergences.

### Drill-down

Clicking a cell opens:

- complete history;
- report and release dates;
- participant definition;
- open-interest context;
- price overlay;
- active story;
- interpretation history;
- Hybrid usage;
- official source.

## Hybrid presentation

Hybrid receives only the positioning observations that materially alter comprehension.

Possible Journey treatments:

### Market at a Glance

- Yen shorts moved towards a three-year extreme;
- Oil managed-money exposure remained light despite physical stress;
- Treasury-futures shorts increased before the next inflation test.

### Today's Lead

A small Positioning Lens panel explains whether crowding:

- supports the move;
- makes reversal risk larger;
- contradicts the popular narrative;
- remains too stale to judge the immediate reaction.

### Investigation

The Evidence Board includes a Positioning section with:

- current state;
- historical comparison;
- weekly change;
- price relationship;
- caveat;
- next report.

Hybrid must not display every COT series. It shows only the observations selected by the Original relevance gate.

## History Cabinet

Each weekly COT vintage stores:

- report date;
- publication date;
- raw participant positions;
- calculated percentiles;
- linked stories at the time;
- interpretation at the time;
- price reaction before the next report;
- whether the expected squeeze, unwind or confirmation occurred;
- method changes.

Revisions or corrected releases append a new version.

## Operational cadence

### Weekly baseline

After the official report is published:

1. ingest official CFTC data;
2. validate report date, contract mapping and participant fields;
3. calculate net positions, open-interest shares, changes and percentiles;
4. compare with the previous report and selected lookbacks;
5. identify largest changes and extremes;
6. run the story filter against active stories;
7. create or update positioning evidence records;
8. publish selected Original and Hybrid snapshots;
9. store the vintage in History Cabinet.

### Daily use

Between reports, COT remains the latest weekly baseline.

Daily research may reference it as:

- crowding context;
- vulnerability context;
- pre-catalyst exposure;
- evidence that a move is not yet position-led.

The displayed age must update daily.

## Acceptance tests

### Yen intervention

The desk should identify extreme leveraged-fund JPY shorts, explain that the positioning may amplify official action, and still require rate and cross-pair price confirmation.

### Oman and oil

The desk should compare managed-money oil exposure with physical tightness, curves and product cracks. Light speculative length should be allowed to contradict the assumption that oil is universally overcrowded.

### Inflation release

The desk should identify whether Treasury or USD positioning raises squeeze risk around CPI, PCE or payrolls, while clearly separating the delayed COT baseline from the live market reaction.

### Equity rebound

The desk should compare index positioning with breadth, earnings, rates and price confirmation. Positioning alone must not determine whether the rebound is durable.

## Final rule

> COT describes who may be exposed and how unusually they are positioned. It does not determine what happens next.

The editorial value comes from combining that exposure with a material catalyst, a causal mechanism and live confirmation.