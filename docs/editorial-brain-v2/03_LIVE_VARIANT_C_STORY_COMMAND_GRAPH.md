# Live Market Desk Variant C: Story Command Graph

## Design intent

This version treats the Live Market Desk as a living network of market stories, catalysts, evidence and transmission channels.

Its primary job is to show how one development changes a broader narrative and how that narrative reaches different assets.

The desk must answer:

1. What is the active story?
2. What new event changed it?
3. Which evidence supports or challenges it?
4. How does the mechanism travel through markets?
5. Which catalysts are next?
6. Which editorial angle is strongest?
7. How has the story evolved over time?

This design preserves all existing release analysis, source hierarchy, evidence rooms, chart methods and historical memory. It makes the story object the main organising unit.

## Visual style

- JPMorgan-style research cockpit
- Large centrepiece story card
- Causal graph and timeline
- Evidence columns for support, contradiction and unknowns
- Compact side rail for catalysts and article opportunities
- High information density with progressive disclosure
- Story-specific charts rather than a generic dashboard

Reference mood:

- Institutional thematic research
- Investigative newsroom
- Interactive causal map

## Reader promise

Within 90 seconds, the analyst should understand:

- the exact new development;
- the market belief it created;
- the strongest evidence for that belief;
- the strongest evidence against it;
- the missing variable;
- the causal chain;
- the next test;
- the most useful editorial angle.

## Core homepage flow

### 1. Story Radar

The homepage opens with active story clusters rather than a flat list.

Buckets:

- Priority Stories
- Developing Stories
- Background Monitors
- Cooling Stories
- Resolved Stories

Each card shows:

- latest meaningful event;
- last meaningful update time;
- current state;
- main contradiction;
- next catalyst;
- affected assets;
- editorial status.

### 2. Priority Story

The highest-priority story becomes the centrepiece.

Visible sections:

- What happened
- What changed
- What the market appears to believe
- Why the market may be right
- What does not fit
- Missing variable
- Next test
- Editorial recommendation

### 3. Story Command Graph

The graph displays:

- event nodes;
- evidence nodes;
- contradiction nodes;
- causal links;
- asset nodes;
- catalyst nodes;
- publication nodes.

The graph should not be decorative.

Each link must have:

- relationship type;
- strength;
- evidence status;
- lag expectation;
- source count;
- last verified time.

### 4. Story Timeline

A chronological sequence of meaningful updates.

Each timeline entry records:

- event time;
- source time;
- what changed;
- effect on thesis;
- market reaction;
- evidence quality;
- linked article or chart.

Repeated reporting of the same claim is grouped into one event cluster.

### 5. Evidence Room

Four columns:

- Confirmed facts
- Reported claims
- Contradictions
- Unknowns

Every item includes:

- source tier;
- publication time;
- observation time;
- verification status;
- relationship to the thesis.

### 6. Transmission Map

The transmission map uses a left-to-right causal sequence:

`Catalyst -> Operational effect -> Inflation, earnings or liquidity effect -> Market sensitivity -> Asset implication`

Every arrow must be labelled:

- observed;
- strongly supported;
- inferred;
- speculative.

### 7. Catalyst Queue

The queue orders upcoming events by their ability to resolve the story.

Each catalyst shows:

- date and time;
- expected information;
- what outcome supports the thesis;
- what outcome weakens it;
- affected assets;
- preparation status.

### 8. Editorial Angle Board

The story can generate several possible angles.

Examples:

- Breaking update
- Market pricing versus reality
- Expectations versus outcome
- Physical versus financial evidence
- Cross-asset divergence
- Policy consequence
- Historical comparison

Each angle is scored internally for:

- timeliness;
- evidence quality;
- originality;
- chartability;
- reader relevance;
- overlap with recent Alchemy work.

The visible output is:

- Recommended OB
- Recommended COTD
- Recommended monitor
- Reject as weak or repetitive

## Update model

### Story event stream

Every meaningful new item is attached to a story as a candidate event.

The system must determine:

- new event;
- duplicate report;
- confirmation;
- contradiction;
- context only;
- catalyst resolution;
- physical confirmation;
- market reaction.

### Scheduled cycles

- 00:40: commentary and video lead extraction
- 08:30: full story reprioritisation
- 11:30: new-event refresh
- 22:00: evening delta and overnight catalyst preparation

### Event-driven cycles

Stories refresh when:

- a government or company makes a direct statement;
- a high-impact release changes a linked macro state;
- a physical indicator changes;
- a tracked market move confirms or challenges the thesis;
- a catalyst date arrives;
- a contradiction is published;
- an evidence room becomes complete enough for promotion.

### Story freshness

- Breaking: material event under 3 hours
- Fresh: material event under 12 hours
- Active: thesis remains live with a known next test
- Waiting: no new evidence before a scheduled catalyst
- Stale: no meaningful update and no justified waiting state
- Cooling: impact declining
- Resolved: catalyst outcome and lesson recorded

## Story data model

### `story`

- title;
- central question;
- accepted market view;
- current thesis;
- priority state;
- freshness state;
- linked assets;
- linked macro states;
- last meaningful update;
- next catalyst.

### `story_event`

- event type;
- event time;
- publication time;
- exact claim;
- source;
- source tier;
- novelty status;
- market reaction;
- thesis effect.

### `evidence_item`

- evidence class;
- claim supported;
- source record;
- verification status;
- confidence;
- valid from;
- superseded by.

### `causal_link`

- from node;
- to node;
- mechanism;
- evidence level;
- expected lag;
- confirmation test;
- invalidation test.

### `catalyst`

- time;
- expected information;
- support outcome;
- challenge outcome;
- preparation checklist;
- resolution record.

### `editorial_angle`

- format;
- working title;
- unresolved question;
- strongest evidence;
- strongest contradiction;
- chart request;
- recommendation state.

## Data release integration

Releases remain first-class objects but enter the Story Command Graph through their story effects.

A release page still contains:

- actual;
- forecast;
- previous;
- revisions;
- components;
- inflation check;
- Fed check;
- relevant assets;
- market reaction;
- historical vintage.

The story layer adds:

- which active stories changed;
- which causal links strengthened or weakened;
- which catalysts were resolved;
- whether a new editorial angle became available.

## ISM handling

The full ISM component breakdown remains mandatory:

- Headline PMI
- New Orders
- Production
- Employment
- Supplier Deliveries
- Inventories
- Prices
- Backlog of Orders
- New Export Orders
- Imports

In this design, each component can connect to story nodes.

Examples:

- New Orders -> manufacturing demand story
- Prices -> goods inflation and Fed story
- Supplier Deliveries -> oil, shipping or disruption story
- Employment -> labour cooling story
- Exports -> global growth or China demand story

The final ISM interpretation must still state:

- headline driver;
- demand direction;
- output direction;
- labour direction;
- supply condition;
- inflation meaning;
- policy meaning;
- relevant assets;
- linked stories changed.

## Oman and oil example

A well-formed Oman negotiation story would contain:

### Event nodes

- report of upcoming Oman framework;
- US official optimism;
- Rubio caution;
- Iranian response;
- IRGC position;
- mediator statement;
- vessel and insurance changes.

### Evidence groups

- confirmed statements;
- single-source reporting;
- counterclaims;
- physical implementation evidence;
- unknown agreement terms.

### Transmission chain

`Reported framework -> lower perceived disruption risk -> lower oil risk premium -> softer inflation expectations -> lower yields -> support for equities and pressure on defensive USD demand`

Each arrow is tested separately.

### Main contradiction

Financial markets may price agreement progress before physical flows and implementation confirm it.

### Next catalyst

The next scheduled mediation milestone, official confirmation or measurable change in shipping.

### Editorial recommendation

Use Market Pricing Versus Physical Reality if evidence is mixed but timely.

## History Cabinet

The History Cabinet is story-oriented.

It stores:

- every meaningful event;
- every thesis version;
- every contradiction;
- every causal-link revision;
- every catalyst expectation and outcome;
- market reaction snapshots;
- articles and charts;
- later confirmation or invalidation;
- analyst lessons.

The user can replay the story as it evolved.

## Code architecture

### Graph storage

Use relational canonical tables with graph-style view models.

Do not introduce a separate graph database unless scale proves it necessary.

Recommended approach:

- relational tables for canonical facts;
- edge table for causal relationships;
- materialised story graph view;
- server-side graph selector;
- client rendering only for visible nodes.

### Shared components

- `StoryRadar`
- `PriorityStoryHero`
- `StoryTimeline`
- `EvidenceColumns`
- `CausalGraph`
- `CatalystQueue`
- `EditorialAngleBoard`
- `ReleaseImpactPanel`
- `HistoryReplay`

### Performance strategy

- Load the centrepiece story first
- Limit graph nodes by relevance and viewport
- Lazy-load source documents
- Cache stable story history
- Invalidate only affected story graphs
- Group duplicate reports before rendering
- Keep raw evidence separate from presentation nodes

## Maintenance model

The main maintenance tasks are:

- merging duplicate events;
- validating causal links;
- resolving evidence status;
- updating catalysts;
- reviewing story priority;
- selecting editorial angles.

The same event can update the homepage, story page, calendar, World map and Hybrid without manual rewriting.

## Strengths

- Strongest narrative research
- Best contradiction and mechanism display
- Excellent for geopolitical and cross-asset stories
- Strong support for OB and long-form development
- Preserves detailed history
- Makes Evidence Rooms genuinely useful

## Weaknesses

- Highest interface complexity
- Graphs can become cluttered
- More demanding data modelling
- Slower than Variant A for a simple daily scan
- Requires disciplined deduplication and evidence labelling

## Acceptance test

The design passes only if the analyst can open one story and see the exact event, evidence, counter-evidence, mechanism, next catalyst, relevant assets, article angle and full evolution without navigating across several disconnected modules.
