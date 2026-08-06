# Final Live Market Desk Mockup Audit

## Verdict

The V8 mockup is close enough to become the implementation reference for adapting the Vercel Live Market Desk.

The core product split is now coherent:

- The Live Desk is the persistent evidence, data and research-memory engine.
- Hybrid is the interpretative Journey and reader experience.
- The Live Desk remains dense and operational rather than becoming another editorial front page.

## Navigation decision

Use a simple two-row navigation. Do not hide core destinations behind dropdowns.

### Row 1: Desk

- Overview
- What's New
- Stories
- Articles
- Hybrid Output

### Row 2: Data and tools

- Macro Data
- Heatmaps
- Positioning
- Charts
- History

Both rows remain visible. On smaller screens each row scrolls horizontally rather than collapsing into a menu.

## Existing Live functions that must remain in production

The current application includes additional operational modules. They should not all return as top-level tabs.

### Retain inside grouped destinations

- Market State: surface through Overview and Heatmaps.
- Research Layer and Evidence Rooms: place under a Research or system workspace.
- Economic Calendar: place inside Data and link releases to Stories.
- Oil System: retain as a specialised market workspace.
- Breadth: keep inside Charts and Market State.
- Statements: retain as the raw statement and social-source monitor.
- Earnings and Guidance: combine into one company-research workspace.
- AI News: use What's New and Story filters rather than a permanent top-level tab.
- Signals: absorb into What's New, Heatmaps, Positioning and Story ranking.
- Ledger: preserve through History Cabinet and system audit logs.

## Still required before production implementation is complete

### 1. Source health and freshness

Every data panel needs:

- last successful refresh;
- observation timestamp;
- publication timestamp;
- source;
- stale status;
- failed-source state;
- next expected update.

### 2. Candidate intake

What's New should distinguish:

- raw intake;
- duplicate;
- awaiting verification;
- merged into a Story;
- rejected as low relevance.

### 3. Exact Story linkage

Macro releases, chart cards, COT cells, statements and articles must link to the exact persistent Story record.

### 4. Persistent release storage

Keep:

- initial values;
- revisions;
- component observations;
- interpretations by vintage;
- at least twelve months in the default browser;
- longer history in storage.

### 5. Calendar consequences

The economic calendar should show:

- expectation;
- decisive component;
- affected Story;
- relevant assets;
- release time in Kuala Lumpur;
- post-release review.

### 6. Evidence Rooms

Priority Stories need:

- Tier 1 source;
- corroboration;
- supporting evidence;
- contradiction;
- unresolved question;
- confirmation;
- invalidation;
- chart;
- next catalyst.

### 7. Statements and social intake

Retain the raw monitor and group repeated posts.

Record:

- author;
- platform;
- publication time;
- claim;
- verification state;
- linked Story;
- whether it changed the Story;
- whether Hybrid used it.

### 8. Earnings and guidance

Combine these into a single company-research area covering:

- expectations;
- reported figures;
- margins;
- cash flow;
- capex;
- guidance;
- wording changes;
- market reaction;
- linked persistent AI or sector Story.

### 9. Search

Production should add a global search or command palette covering:

- Stories;
- releases;
- components;
- articles;
- statements;
- charts;
- History Cabinet.

### 10. Hybrid Output audit

The bridge should show:

- included records;
- excluded records;
- reason for inclusion or exclusion;
- stale or blocked fields;
- exact Hybrid destination;
- generated time.

## Features that should not be reintroduced

- A flat sixteen-tab navigation strip.
- Large walls of embedded TradingView charts.
- Native EMA calculations without a validated common OHLC source.
- COT scores presented as directional signals.
- Recent-window buttons without historical comparison.
- Broad Stories promoted repeatedly without a material event.
- Separate pages for overlapping signals when filtering and grouping solve the problem.

## Production acceptance test

The implementation is ready when the user can:

1. Open Overview and verify that the desk is current.
2. Open What's New and see only genuine deltas.
3. Open a Story and replay at least one to two months of major events.
4. Compare the Story against existing Articles.
5. Search twelve months of macro releases and revisions.
6. Inspect release components and their interpretation.
7. Scan macro and positioning extremes with a visible lookback.
8. Open a lightweight chart linked to the Story.
9. Trace every important claim to its source and History record.
10. See exactly what was sent to Hybrid and why.
