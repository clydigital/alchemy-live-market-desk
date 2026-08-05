# Live Market Desk Variant B: Release Operating System

## Design intent

This version treats the Live Market Desk as a persistent macro release laboratory.

Its centre of gravity is not the news story queue. It is the interpretation, comparison and historical storage of economic releases, policy decisions and earnings signals.

The desk must answer:

1. What was released?
2. What drove the headline?
3. What changed relative to expectations and previous data?
4. What does it mean for inflation, the Fed and the most relevant assets?
5. How does it alter the current macro state?
6. How does this release compare with previous vintages?

This design preserves all existing story, evidence, chart and article methods. It gives the release engine the primary interface position.

## Visual style

- McKinsey-style macro workbook
- Structured institutional tables
- Clear data hierarchy
- Light or dark neutral canvas with disciplined accent colours
- Release tiles, component matrices and state-change panels
- Minimal animation
- Strong comparison and history controls

Reference mood:

- Central-bank staff briefing
- JPMorgan macro data note
- Alchemy quarterly outlook structure converted into a live application

## Reader promise

Within 90 seconds of an important release, the analyst should know:

- whether it beat or missed;
- which components caused the result;
- whether the result is inflationary, disinflationary or mixed;
- whether the result is hawkish, dovish or not decisive for the Fed;
- which assets have the clearest direct mechanism;
- whether the result confirms or challenges the current macro state;
- what should be stored for later comparison.

## Core homepage flow

### 1. Release Clock

A time-ordered schedule of important releases and policy events.

Each event shows:

- local time;
- release name;
- impact level;
- consensus;
- previous;
- revision risk;
- linked macro states;
- preparation status.

### 2. Latest Important Release

The newest high-impact release takes the main panel.

Required visible fields:

- actual;
- consensus;
- previous;
- revised previous;
- directional surprise;
- component driver;
- first market reaction;
- interpretation confidence;
- whether the release changes the macro state.

### 3. Release Breakdown

The full component table sits directly below the headline.

Each row contains:

- component name;
- current reading;
- previous reading;
- three-month trend;
- twelve-month percentile;
- cycle role;
- inflation relevance;
- policy relevance;
- asset mechanism;
- caveat.

### 4. Macro State Change

The release is compared against persistent state objects:

- inflation state;
- labour state;
- growth state;
- demand state;
- supply state;
- liquidity state;
- policy state;
- risk state.

The system states:

- strengthened;
- weakened;
- unchanged;
- conflicted.

### 5. Latest Releases Board

A compact board of the last ten material releases.

Filters:

- inflation;
- labour;
- growth;
- manufacturing;
- services;
- consumer;
- housing;
- policy;
- earnings sensors.

### 6. History Cabinet

The user can compare:

- current release with prior month;
- current release with prior cycle turning points;
- original data with revisions;
- original interpretation with later outcome;
- asset reaction across comparable releases.

## Update model

### Pre-release cycle

At T-24 hours:

- fetch consensus;
- record range of estimates;
- identify revision risk;
- connect the release to active stories;
- define surprise thresholds;
- request required charts.

At T-60 minutes:

- refresh consensus and market pricing;
- record current yields, DXY, equity futures and relevant asset levels;
- lock the pre-release snapshot.

### Release cycle

At T+0:

- record actual, previous and revisions;
- parse all available components;
- calculate surprise direction;
- publish a provisional interpretation.

At T+5 minutes:

- record first market reaction;
- flag whether price confirms the initial interpretation.

At T+60 minutes:

- update market reaction;
- add analyst review;
- promote or downgrade linked stories.

At session close and T+24 hours:

- store reaction windows;
- compare initial interpretation with later market behaviour.

### Event-driven updates

The page refreshes when:

- a revision is published;
- a release component is corrected;
- a central-bank official interprets the data;
- market pricing materially changes;
- a related release confirms or contradicts the result.

## ISM release template

### Headline row

- Manufacturing PMI
- Actual
- Forecast
- Previous
- Revision
- Expansion or contraction
- Three-month direction

### Component rows

- New Orders
- Production
- Employment
- Supplier Deliveries
- Inventories
- Prices
- Backlog of Orders
- New Export Orders
- Imports

### Component interpretation fields

#### New Orders

Questions:

- Is demand expanding or contracting?
- Is the direction improving or worsening?
- Does it lead Production?
- Does it confirm export demand?

#### Production

Questions:

- Is output following demand?
- Is production running ahead of orders?
- Is there a risk of unwanted inventory accumulation?

#### Employment

Questions:

- Is labour demand confirming activity?
- Is the component lagging broader changes?
- Does it add useful evidence ahead of payrolls?

#### Supplier Deliveries

Questions:

- Are deliveries slower because demand is strong?
- Are deliveries slower because of disruption, war, weather or transport constraints?
- Is the inflation implication genuine or misleading?

#### Inventories

Questions:

- Are firms building stock because demand is expected to improve?
- Are inventories accumulating because sales are weak?
- What does the Orders minus Inventories relationship imply?

#### Prices

Questions:

- Is input inflation broadening?
- Is the rise energy-led, tariff-led or demand-led?
- Is the move likely to reach consumer prices?

#### Backlog of Orders

Questions:

- Does the backlog support future production?
- Is backlog weakness consistent with softer demand?

#### New Export Orders and Imports

Questions:

- Is external demand improving?
- Does trade activity confirm the domestic picture?
- Are imports reflecting production demand or inventory adjustment?

### Required ISM summary

The final summary must include:

- headline direction;
- demand direction;
- production direction;
- labour direction;
- supply pressure;
- inflation pressure;
- inventory condition;
- Fed implication;
- relevant assets;
- confidence and caveats.

## Inflation check

Every release receives an inflation classification:

- Inflationary
- Disinflationary
- Mixed
- Not meaningful for inflation

The classification must identify:

- the active channel;
- whether the evidence is leading, coincident or lagging;
- whether it is broad or concentrated;
- whether it is persistent or temporary;
- whether the release changes the inflation state.

## Fed check

Every release receives a policy classification relative to current pricing:

- Hawkish
- Dovish
- Mixed
- Not decisive alone

The page must explain:

- what the market expected before the release;
- whether the release changes the next-meeting probability;
- whether it changes the medium-term path;
- whether the Fed is more likely to focus on inflation, labour, growth or risk management;
- what other data is needed before the interpretation becomes reliable.

## Relevant asset check

The design avoids a generic asset checklist.

An asset appears only if all four conditions are met:

1. A direct mechanism exists.
2. The release is material to that mechanism.
3. The asset is currently sensitive to that variable.
4. The expected reaction can be tested.

Each asset row shows:

- asset;
- expected directional pressure;
- mechanism;
- time horizon;
- observed reaction;
- confirmation status;
- invalidation condition.

## Earnings as macro sensors

The Release Operating System also treats selected companies as economic sensors.

Examples:

- freight and parcel companies for goods movement;
- grocers for volumes and household pressure;
- banks for credit and funding;
- hyperscalers for AI capex;
- semiconductors for demand and inventory;
- discretionary companies for consumer traffic.

Each earnings sensor must separate:

- company-specific execution;
- industry-wide evidence;
- macro inference;
- market reaction;
- next corroborating dataset.

## History Cabinet

### Stored release record

- release metadata;
- source document;
- original vintage;
- revised vintage;
- consensus snapshot;
- component table;
- provisional interpretation;
- reviewed interpretation;
- linked macro states;
- linked stories;
- market reaction windows;
- later confirmation or invalidation;
- articles produced;
- analyst lesson.

### Comparison views

- Month-over-month
- Three-month trend
- Twelve-month history
- Cycle turning points
- Same release under similar policy regimes
- Similar surprise magnitude
- Similar market positioning

### Revision discipline

No release value or interpretation is overwritten.

Corrections create new versions and preserve:

- what was known at the time;
- what changed;
- when it changed;
- how the original market reaction should be interpreted.

## Code architecture

### Canonical entities

- `release_event`
- `release_vintage`
- `release_component`
- `consensus_snapshot`
- `surprise_threshold`
- `macro_state`
- `macro_state_change`
- `market_reaction_window`
- `policy_pricing_snapshot`
- `asset_sensitivity`
- `release_interpretation`
- `history_snapshot`

### Release templates

Use schema-driven templates rather than custom code per release.

Examples:

- `ism_manufacturing_template`
- `ism_services_template`
- `cpi_template`
- `ppi_template`
- `nfp_template`
- `retail_sales_template`
- `gdp_template`
- `fomc_template`
- `earnings_sensor_template`

Each template defines:

- required components;
- labels;
- interpretation rules;
- chart requirements;
- historical comparison fields.

### Component architecture

- `ReleaseHero`
- `ActualForecastPrevious`
- `ComponentMatrix`
- `InflationCheck`
- `FedCheck`
- `RelevantAssetTable`
- `MacroStateDelta`
- `ReactionTimeline`
- `HistoryComparison`

### Performance strategy

- Precompute release summaries
- Use materialised comparison tables
- Cache historical views
- Stream the latest release panel
- Load long histories on demand
- Keep source documents separate from derived interpretations
- Invalidate only the affected release family and linked state cards

## Maintenance model

The main maintenance tasks are:

- maintaining release templates;
- validating source parsers;
- approving interpretations;
- reviewing macro-state changes;
- checking asset relevance;
- recording later outcomes.

Once a template exists, recurring releases should require minimal new interface code.

## Strengths

- Best release analysis
- Strongest ISM implementation
- Best historical comparison
- Lowest long-term content duplication
- Excellent for macro credibility
- Clear revision discipline

## Weaknesses

- Breaking geopolitical stories can feel secondary
- Less effective as an immediate OB newsroom
- Dense tables can overwhelm casual use
- Requires robust release parsing and historical data storage

## Acceptance test

The design passes only if a new ISM release can be ingested, decomposed, interpreted, linked to the Fed and relevant assets, compared with prior vintages and stored in the History Cabinet without writing a new bespoke page.
