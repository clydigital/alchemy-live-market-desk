# Shared Processing and Recording Contract

## Purpose

This document defines how the Original Live Market Desk and the Hybrid Market Desk process, record and present research without creating two competing research systems.

The operating rule is:

> Research once in the Original. Record it as structured, versioned evidence. Present it differently in the Original and Hybrid.

The Original is the canonical research and memory layer. It owns raw intake, source verification, release decomposition, story synthesis, evidence rooms, charts, history, revisions and editorial decisions.

The Hybrid is the edutainment and learning layer. It consumes approved objects from the Original and turns them into faster, more memorable journeys. It must not independently alter facts, recalculate a release or silently replace the Original interpretation.

## Non-regression rule

No existing research method is removed. The following remain mandatory and become explicit modules in the processing pipeline:

1. Source hierarchy and licence classification.
2. Raw source material stored separately from interpreted evidence.
3. Exact publication time, observation time, units, frequency and revision status.
4. Lee's 6-Box Analyst Model.
5. Contradiction-first story selection.
6. The accepted-view or "why the market may be right" pass.
7. One overlooked but measurable variable.
8. Causal transmission audit.
9. Evidence for and evidence against.
10. Confirmation and invalidation conditions.
11. Dated next catalyst or tripwire.
12. Market-pricing check using price, rates, spreads, volatility, flows or positioning.
13. Chart requirement tied to the deciding question.
14. Article-memory and duplicate-coverage checks.
15. Append-only research memory and review history.
16. Accuracy gates before presentation.
17. Publication gates for promoted stories.
18. Calm, probabilistic client-facing writing.

New modules may be added, but they must extend this list rather than overwrite it.

## The canonical processing pipeline

### Stage 1: Intake

Every item enters as raw intake. Examples include:

- official economic releases;
- central-bank statements and speeches;
- filings, earnings releases and transcripts;
- market data and cross-asset moves;
- physical data such as vessel traffic, inventories and capacity;
- reputable reporting;
- social posts used as discovery;
- creator videos and transcripts used as research leads;
- Alchemy article and story memory.

Each intake item records:

- source and source tier;
- title and canonical URL;
- publication timestamp;
- observation period;
- named speaker or institution;
- original wording or raw payload;
- licence class;
- ingestion method;
- hash or duplicate key;
- candidate story links.

No interpretation occurs inside the raw record.

### Stage 2: Normalisation

The system classifies the item as one or more of:

- economic release;
- policy event;
- company event;
- geopolitical event;
- market move;
- physical-flow observation;
- calendar catalyst;
- commentary lead;
- correction or revision.

Normalisation resolves units, dates, country, currency, asset, sector, release family and whether the item updates an existing story or creates a candidate.

### Stage 3: Verification

The system determines whether the claim is:

- confirmed by a primary source;
- independently corroborated;
- credibly reported but unconfirmed;
- contradicted;
- commentary only;
- stale, duplicated or superseded.

Verification is recorded per claim. A story cannot inherit confidence merely because it contains many source links.

### Stage 4: Decomposition

The system opens one layer below the headline.

For economic releases, this means headline, components, revisions, breadth, persistence and historical context.

For earnings, this means revenue quality, unit or volume data, margins, cash flow, capex, guidance, expectations and management commentary.

For geopolitical stories, this means named parties, negotiating stage, implementation conditions, physical confirmation, contradictions and timeline.

For market moves, this means the affected assets, scale, timing, cross-asset confirmation and plausible alternative causes.

### Stage 5: Context and expectation map

Every important event is compared against:

- consensus;
- prior release;
- revisions;
- the last three to twelve observations where relevant;
- current market pricing;
- the active house thesis;
- recent Alchemy coverage;
- the next catalyst.

This prevents a release page from becoming a calendar recap.

### Stage 6: Causal audit

Every promoted interpretation must state:

> Catalyst -> operational effect -> growth, inflation, earnings or liquidity effect -> policy or market sensitivity -> asset implication.

Each arrow is labelled:

- observed;
- strongly supported;
- inferred;
- speculative.

The system must identify lags, broken links and plausible alternative explanations.

### Stage 7: Editorial synthesis

The desk produces a Decision Brief with:

1. What happened.
2. What changed since the last update.
3. What the market expected.
4. Why the initial reaction is reasonable.
5. The overlooked variable.
6. The transmission mechanism.
7. Evidence for.
8. Evidence against.
9. Market pricing versus fundamental or physical reality.
10. What matters next.
11. Confirmation.
12. Invalidation.
13. Relevant assets only.
14. Best chart or chart request.
15. Editorial action.

Editorial actions are:

- Lead now;
- Develop today;
- Prepare conditional OB;
- COTD candidate;
- Add to an existing piece;
- Wait for confirmation;
- Background monitor;
- Cooling;
- Resolved;
- Reject or duplicate.

### Stage 8: Presentation snapshots

The system creates presentation snapshots from the same canonical record.

The Original snapshot is detailed, source-rich and analyst-facing.

The Hybrid snapshot is concise, interactive and pedagogical. It may simplify wording and sequence, but it may not change the underlying claim status, evidence, timestamps or conditions.

### Stage 9: History Cabinet

Every material update is stored as an append-only historical snapshot.

The cabinet preserves:

- original release vintage;
- subsequent revisions;
- component table;
- interpretation at the time;
- market pricing at the time;
- asset reaction windows;
- story links;
- article links;
- later outcome;
- what the desk got right or wrong;
- method and source changes.

Corrections create a new version. They do not overwrite the original record.

### Stage 10: Review and learning

After the next catalyst or a defined review window, the system records:

- thesis outcome;
- whether confirmation or invalidation occurred;
- whether the chosen chart was useful;
- whether the story deserved its ranking;
- missing evidence;
- duplicated work;
- time saved or manual research still required.

This review updates templates and ranking weights, not historical facts.

## Canonical data objects

The minimum shared object model is:

### `source_items`
Raw material and metadata.

### `claims`
Atomic claims with speaker, wording, verification status and contradiction links.

### `release_events`
The release identity, schedule, source, consensus, prior, revision and observation period.

### `release_component_definitions`
Stable metadata describing what each component measures, its cycle role, caveats and typical transmission channels.

### `release_component_observations`
The latest component value, prior, change, percentile, direction and interpretation.

### `story_candidates`
Unpromoted discoveries with reason for relevance, duplication check and evidence gaps.

### `stories`
Persistent story records with status, thesis, central question, affected assets, freshness and next catalyst.

### `evidence_records`
Observed evidence for or against the thesis.

### `causal_links`
The mechanism, evidence strength, lag and break conditions for each arrow.

### `asset_impacts`
Only directly relevant asset implications with mechanism, direction, confidence, horizon and cross-confirmation.

### `decision_briefs`
Versioned editorial synthesis for a given time.

### `presentation_snapshots`
Original and Hybrid render-ready views generated from one Decision Brief.

### `history_entries`
Immutable snapshots, revisions, outcomes and post-event reviews.

## Latest Data Releases contract

The Original must maintain a page that breaks down the most recent high-impact releases. It is not a list of numbers. Each release includes:

- exact release time;
- actual, consensus, prior and revision;
- surprise direction and magnitude;
- component breakdown;
- what changed from the prior trend;
- accepted market interpretation;
- overlooked component;
- Inflation check;
- Fed check;
- Other relevant asset check;
- cross-checks with related releases;
- market reaction and whether it confirms the interpretation;
- next test;
- history-cabinet link.

### Inflation check

Classify the signal as:

- inflationary;
- disinflationary;
- mixed;
- not meaningfully informative.

The explanation must distinguish:

- input versus output prices;
- goods versus services;
- level versus rate of change;
- breadth versus one-off movement;
- leading pipeline pressure versus coincident realised inflation;
- persistence versus volatility.

### Fed check

Classify the release as:

- hawkish relative to prior pricing;
- dovish relative to prior pricing;
- mixed;
- not policy-relevant by itself.

The check must state which channel dominates:

- inflation;
- labour demand;
- growth;
- financial conditions;
- revisions;
- risk management.

It must compare the release with market pricing rather than assigning a generic label from the headline direction.

### Other relevant assets check

Only assets with a direct and current transmission channel are shown.

Each displayed asset requires:

- mechanism;
- expected directional pressure;
- horizon;
- current market confirmation;
- a reason the asset is more relevant than alternatives.

The system must not fill a generic grid with USD, gold, stocks and bonds for every release.

## ISM release contract

The ISM page must preserve the headline while breaking down the components that explain it.

Minimum manufacturing components:

- Headline PMI;
- New Orders;
- Production;
- Employment;
- Supplier Deliveries;
- Inventories;
- Prices;
- Backlog of Orders;
- New Export Orders;
- Imports.

Each component stores:

- latest value;
- prior value;
- three-month direction;
- expansion or contraction status;
- cycle role;
- inflation relevance;
- policy relevance;
- asset relevance;
- caveat.

Interpretive roles should be explicit:

- New Orders: forward demand signal and a leading component of the manufacturing cycle.
- Production: current output confirmation and generally more coincident than New Orders.
- Employment: labour confirmation that can lag turning points and should be cross-checked with payrolls and claims.
- Supplier Deliveries: slower delivery can lift the index, but may reflect demand strength or supply disruption. The cause must be identified.
- Inventories: stock-building or destocking context, interpreted together with New Orders and customer inventories where available.
- Prices: goods-input pipeline pressure. It is not a direct substitute for CPI or PPI.
- Backlog: accumulated demand and capacity pressure.
- New Export Orders and Imports: external-demand and trade-flow context.

The page must answer:

1. Is the headline being driven by demand, supply disruption or inventories?
2. Are New Orders and Production confirming each other?
3. Is Employment confirming or lagging the cycle?
4. Are Prices and Supplier Deliveries pointing to persistent inflation pressure or a temporary disruption?
5. Does the release change the Fed path, or merely reinforce an existing view?
6. Which asset relationships are directly relevant today?

## Maintenance rules

### Write once, render twice

All interpretation is stored in canonical objects. Original and Hybrid views are generated, not manually duplicated.

### Template plus exceptions

Release families use stable templates. Analysts may add release-specific notes without changing the global schema.

### Append, do not overwrite

Revisions and corrections create new versions.

### Separate calculation from prose

Surprise scores, percentiles, changes and classifications are calculated once. Prose consumes those values.

### Visible freshness

Every object includes:

- `last_meaningful_update_at`;
- `last_verified_at`;
- `next_catalyst_at`;
- `freshness_status`;
- `stale_reason`;
- `source_health`.

### No silent degradation

If a source is unavailable, stale or conflicting, the page must show the gap rather than presenting an unchanged conclusion as current.

## Research cadence

The shared system supports:

- 00:40 Asia/Kuala_Lumpur: video and overnight discovery intake;
- 08:30: full editorial desk update;
- 11:30: late-morning video and Europe-preparation refresh;
- 22:00: US-session and evening delta update;
- event-driven updates for major releases, earnings, policy decisions, verified geopolitical developments and material market moves.

Scheduled runs create a baseline. Event-driven updates create timeliness.

## Success test

The design succeeds when:

- the Original can reconstruct exactly how a conclusion was reached;
- the Original can show the latest release and its component-level meaning without new manual research;
- the Hybrid can explain the same conclusion in under two minutes without losing the decisive caveat;
- a revision updates both products from one canonical record;
- a user can retrieve the prior vintage, interpretation, market reaction and outcome from the History Cabinet;
- opening a separate chat is optional rather than necessary to discover what matters today.
