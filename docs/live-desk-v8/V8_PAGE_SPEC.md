# V8 Page and Component Specification

## Shared shell

All pages use the existing deep-purple Live Desk identity.

Shared structure:

1. compact workspace header;
2. visible two-row navigation;
3. page title and local controls;
4. dense equal-width panels;
5. side drawer or shared expanded stage for detail;
6. source and freshness footer states.

The shell should not reload the entire research data set for every small interaction. Route pages should load only the contracts they own, while shared system health may be cached at shell level.

## Overview

### Required panels

- Research system status
- Last validated run
- Next scheduled run
- Source failures and stale checks
- Hybrid object readiness
- Latest material changes
- Active Story map
- Top market and macro signals

### Behaviour

- Every alert opens its underlying record.
- Overview does not reproduce the complete Macro, Positioning or Charts page.
- System failures remain visible until resolved or acknowledged.

## What's New

### Required panels

- Incoming developments stream
- Category and time filters
- Processing rule
- Queue status

### Candidate states

- New
- Awaiting verification
- Material delta
- Duplicate
- Promoted to Story
- Rejected

### Behaviour

- A candidate can be linked to an existing Story.
- Duplicate stories are collapsed into one candidate group.
- The page distinguishes detection time, publication time and verification time.

## Stories

### Registry card

- status;
- last material update;
- title;
- current thesis;
- start date;
- major event count;
- next catalyst;
- COT or market-state relevance.

### Story detail

- persistent question;
- current support;
- strongest contradiction;
- next test;
- exact confirmation and invalidation;
- dated major-event timeline;
- related evidence, releases, articles, statements, charts and positioning;
- interpretation history.

### Behaviour

- Older events remain accessible.
- New events append to the same Story.
- A Story may be archived and later reopened without losing history.

## Articles

### Article memory card

- title;
- publication date;
- related Story;
- Story-match score;
- change score;
- number of material events since publication;
- status.

### Comparison panel

- what the article said;
- what the desk knows now;
- material changes;
- unchanged assumptions;
- follow-up recommendation;
- duplicate-angle warning;
- new chart or catalyst required.

## Macro Data

### Top workspace

- release stack for the selected day;
- fixed day synthesis;
- selected release interpretation;
- actual, consensus, prior and revisions;
- inflation, Fed, growth and relevant-asset checks;
- central question and next test.

### Component Laboratory

The table is generated from stable component definitions and selected release observations.

It changes by release family. Examples:

- ISM: Headline, New Orders, Production, Employment, Deliveries, Inventories, Prices, Backlog, Exports, Imports.
- Payrolls: headline, private payrolls, unemployment, wages, hours, participation, revisions.
- CPI: headline, core, shelter, services, goods and volatile components.
- Retail Sales: headline, control group, ex-autos, ex-autos and gas, autos, building materials and restaurants.

### Archive

- search input;
- release-family filter;
- 3M, 6M, 12M and All views;
- initial and revised vintage filters;
- exact release deep links.

Default display is twelve months. Storage should retain longer history.

## Heatmaps

### Required views

- macro state;
- market state;
- breadth;
- historical extremes and divergences.

### Controls

- display window;
- comparison lookback;
- category;
- active Story filter.

### Tile detail

- current value;
- percentile and lookback;
- change;
- source;
- last verified;
- linked Story;
- interpretation;
- stale or insufficient-history warning.

## Positioning

### Alchemy View

Uses official participant categories appropriate to TFF or Disaggregated COT.

### COTSignal-style Legacy View

- weekly extremes band;
- Commercials, Large Specs and Small Specs;
- 52-week percentile heatmap;
- disclosed inverted Commercial display score;
- plain-English weekly insights;
- asset-class and trader-group filters;
- external COTSignal shortcut.

### Detail drawer

- trader group;
- 52-week score;
- weekly change;
- crowded, neutral or washed-out state;
- positioning barometer;
- five-year net position as percentage of open interest;
- positioning beside price;
- linked Story;
- lag and methodology warning.

## Charts

### Default

Active Stories.

### Categories

- Rates
- Macro
- Indices
- Breadth
- FX
- Commodities
- Credit
- Positioning

### Card

- chart title;
- category;
- research question;
- related Story tags;
- source;
- lookback;
- last verified;
- lightweight native preview.

### Expanded stage

Only one expanded chart is mounted at a time.

It shows:

- chart;
- source;
- lookback;
- formula for derived charts;
- component sources;
- linked Stories;
- why the chart exists.

No native 20, 50 or 200 EMA overlays are required.

## History

### Record types

- Story version;
- macro vintage;
- source correction;
- COT vintage;
- article comparison;
- Hybrid snapshot;
- post-catalyst review;
- method change.

### Behaviour

- append-only;
- replayable;
- exact source links;
- superseded-version links;
- searchable by Story, date and record type.

## Hybrid Output

### Required panels

- outgoing snapshot readiness;
- included records;
- excluded records;
- blockers;
- inclusion and exclusion reasons;
- destination mapping;
- quality gates;
- generated version and time;
- exact Original links.

Hybrid must consume the approved snapshot rather than independently recomputing the conclusion.
