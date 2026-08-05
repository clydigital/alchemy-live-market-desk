# Live Market Desk Variant A: Editorial Triage Grid

## Design intent

This version treats the Live Market Desk as a real-time editorial newsroom.

Its primary job is to reduce the time between a market development and a defensible editorial decision.

The desk must answer, in this order:

1. What changed since the last visit?
2. What matters most now?
3. What is coming next?
4. What has enough evidence to write?
5. What should remain in research, monitoring or background?

This design does not remove any existing research method. It changes the order in which the information is surfaced.

## Visual style

- Compact institutional newsroom
- Dense but readable information hierarchy
- Dark command-centre interface
- One primary story, three secondary stories, and a small background queue
- Strong use of time labels, source status and editorial action chips
- Limited decorative scoring
- Minimal navigation depth for daily use

Reference mood:

- Reuters terminal for urgency
- Bloomberg newsroom for density
- Alchemy chart-led research for final judgement

## Reader promise

Within 60 seconds, the analyst should know:

- the most important new event;
- why it matters now;
- what the market appears to be pricing;
- what remains unconfirmed;
- the next catalyst and its time;
- whether the story is suitable for Opening Bell, Chart of the Day, long-form or monitoring.

## Core homepage flow

### 1. Since Last Visit

A strict delta feed.

Only material changes appear.

Each item shows:

- timestamp;
- exact development;
- source class;
- affected story;
- affected assets;
- whether the change strengthened, weakened or complicated the current thesis.

No repeated background summaries.

### 2. What Matters Now

One centrepiece story.

Required fields:

- What happened
- What changed today
- Market reaction
- What investors expected
- Why the move may be rational
- What does not fit
- Main contradiction
- Next catalyst
- Confirmation
- Invalidation
- Editorial decision
- Best chart request

The centrepiece must be event-first, not hypothesis-first.

### 3. Today, Tonight and Later This Week

A consequence-led calendar.

Each event shows:

- event time in Asia/Kuala_Lumpur;
- consensus;
- previous value;
- likely market sensitivity;
- linked active stories;
- relevant assets only;
- surprise thresholds;
- required preparation status.

The calendar should not display every release with equal weight.

### 4. Editorial Queue

Four states:

- Write now
- Develop today
- Wait for confirmation
- Monitor only

Each card contains one sentence explaining why it is in that state.

### 5. Latest Data Releases

A compact release strip.

The strip shows the latest important macro and earnings releases, not every release.

Each release can open a full Release Breakdown page.

### 6. Background Monitors

Persistent themes remain visible but clearly separated from live stories.

Examples:

- AI capex return threshold
- Oil physical normalisation
- Yen carry economics
- Consumer slowdown
- China AI adoption

Background Monitors do not compete with live events unless a new catalyst promotes them.

## Update model

### Scheduled cycles

- 00:40: video and commentary intake
- 08:30: full editorial desk
- 11:30: late-morning refresh
- 22:00: evening delta

### Event-driven refreshes

A refresh is triggered when:

- a high-impact release lands;
- a tracked government or central-bank source publishes;
- a priority company reports earnings;
- a priority asset crosses a predefined material move threshold;
- a source contradicts a promoted story;
- a dated catalyst resolves;
- a physical-market indicator materially changes.

### Freshness labels

- Breaking: under 3 hours
- Fresh: under 12 hours
- Active: current thesis still valid
- Waiting: no new evidence, next catalyst known
- Stale: expected update missing or story unchanged too long
- Resolved: catalyst completed and outcome logged

A story cannot remain in What Matters Now if it is Stale.

## Relevance engine

The internal score can use numbers, but the visible interface uses editorial labels.

Inputs:

- market impact;
- surprise versus expectations;
- source quality;
- catalyst proximity;
- cross-asset confirmation;
- breadth of affected assets;
- contradiction strength;
- physical or operational confirmation;
- originality versus recent Alchemy coverage;
- freshness;
- confidence penalty for duplicated reporting;
- staleness penalty.

The score selects the queue position. It does not appear as false precision such as 96/100 unless used in an admin panel.

## Research processing flow

### Stage 1: Intake

Every source becomes an Intake Item.

Required fields:

- source URL;
- publication time;
- observation time;
- source tier;
- named speaker or organisation;
- exact claim;
- associated assets;
- possible story link;
- verification status.

### Stage 2: Candidate creation

The system asks:

- Is this new?
- Is it material?
- Is it independently confirmed?
- Does it alter an existing thesis?
- Is there a dated next test?

### Stage 3: Verification

The existing evidence hierarchy remains binding.

No priority story is promoted without:

- primary or strong secondary evidence;
- a fair accepted-view pass;
- a contradiction check;
- a causal transmission chain;
- confirmation and invalidation;
- source-linked timestamps.

### Stage 4: Editorial synthesis

The system writes a Decision Brief, not a generic summary.

### Stage 5: Historical recording

Every material state change creates a new immutable History Cabinet entry.

## Latest Data Release page

Every high-impact release includes:

### Headline

- actual;
- forecast;
- previous;
- revised previous;
- surprise size;
- release time;
- source.

### Breakdown

The relevant components are shown with:

- latest;
- prior;
- three-month trend;
- cycle role;
- inflation meaning;
- Fed meaning;
- asset relevance;
- confidence;
- caveat.

### Required checks

#### Inflation

Classify as:

- Inflationary
- Disinflationary
- Mixed
- Not meaningfully informative

The system must distinguish:

- input from output prices;
- goods from services;
- pipeline from realised inflation;
- broad from narrow pressure;
- persistent from temporary change;
- leading from coincident evidence.

#### Fed

Classify relative to current market pricing:

- Hawkish
- Dovish
- Mixed
- Not decisive alone

State the dominant channel:

- inflation;
- labour;
- growth;
- financial conditions;
- revisions;
- risk management.

#### Other assets

Only include assets with a direct and testable mechanism.

For each asset:

- expected pressure;
- mechanism;
- time horizon;
- current market confirmation;
- reason for inclusion.

## ISM handling

The ISM page must break down:

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

The editorial summary must answer:

- Was the headline driven by demand, production, delivery delays or inventories?
- Do New Orders and Production agree?
- Is Employment confirming or lagging?
- Are Supplier Deliveries signalling demand or disruption?
- Are Prices showing broad inflation or a narrow input shock?
- Does the release change the Fed path?
- Which assets are genuinely sensitive today?

## History Cabinet

The History Cabinet stores:

- original release vintage;
- revisions;
- pre-release expectations;
- component table;
- interpretation at the time;
- market reaction at 5 minutes, 1 hour, session close and 24 hours;
- stories updated;
- articles produced;
- later confirmation or invalidation;
- lesson for the research process.

Nothing is overwritten.

## Code architecture

### Canonical entities

- `intake_item`
- `source_record`
- `story_candidate`
- `story`
- `story_update`
- `evidence_item`
- `contradiction`
- `causal_link`
- `catalyst`
- `release_event`
- `release_component`
- `market_reaction`
- `editorial_decision`
- `history_snapshot`

### Shared view models

- `SinceLastVisitView`
- `PriorityStoryView`
- `CalendarImpactView`
- `EditorialQueueView`
- `ReleaseSummaryView`

The UI should never assemble raw database rows directly.

### Component strategy

Reusable components:

- `DeltaItem`
- `PriorityStoryCard`
- `CatalystCard`
- `ReleaseStrip`
- `EditorialActionChip`
- `EvidenceStatus`
- `FreshnessLabel`
- `AssetMechanismRow`

The same components serve all stories and releases.

### Performance strategy

- Server-render the initial command-centre payload
- Cache stable background modules
- Invalidate only affected story and release keys
- Use append-only event records
- Materialise homepage selectors
- Avoid repeated client-side joins
- Lazy-load deep evidence and charts

## Maintenance model

Daily maintenance should mostly involve:

- approving or rejecting candidates;
- resolving source conflicts;
- checking the priority ranking;
- adding chart interpretation;
- confirming editorial decisions.

The system should not require manual rewriting of the same story across multiple pages.

## Strengths

- Fastest route to a publishable story
- Strongest daily usefulness
- Easy to understand at a glance
- Clear separation between live events and background themes
- Efficient component reuse
- Strong support for OB planning

## Weaknesses

- Can under-emphasise long-range macro structure
- Dense interface may feel utilitarian
- Requires reliable event ingestion to reach full value
- Release analysis is important but secondary to the story queue

## Acceptance test

The design passes only if it can surface an Oman or Iran negotiation development before the analyst opens a separate chat and can show:

- the exact reported development;
- who confirmed it;
- who contradicted it;
- the stage of agreement;
- what oil markets priced;
- whether physical flows agreed;
- the next expected date;
- the OB recommendation;
- the chart required.
