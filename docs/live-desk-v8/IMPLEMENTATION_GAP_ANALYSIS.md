# V8 Implementation Gap Analysis

## Executive conclusion

The production desk already owns most of the underlying research objects required by V8. The primary job is to reorganise and strengthen the interface without discarding the current data engine.

The migration is mainly:

- application-shell work;
- route and component decomposition;
- cross-linking;
- persistent history and search;
- explicit freshness and audit states;
- several missing data relationships.

It is not a reason to rebuild ingestion from scratch.

## 1. Application architecture

### Current

- One server entry page.
- One very large `MarketWorkspace` client component.
- Sixteen client-side tabs.
- Query-parameter navigation.

### V8 target

Introduce a shared Live Desk shell with route-owned pages:

- `/`
- `/whats-new`
- `/stories`
- `/stories/[slug]`
- `/articles`
- `/data/macro`
- `/data/heatmaps`
- `/data/positioning`
- `/tools/charts`
- `/tools/history`
- `/hybrid-output`

Maintain temporary redirects from legacy `?tab=` links during migration.

## 2. Component decomposition

Split `MarketWorkspace.tsx` by domain rather than copying its JSX into pages.

Recommended shared components:

- `LiveDeskShell`
- `LiveDeskNavigation`
- `WorkspaceHeader`
- `SourceFreshnessBadge`
- `StoryTag`
- `StatusBadge`
- `EvidenceDrawer`
- `ReleaseDrawer`
- `ChartStage`
- `HistoryVersionDrawer`
- `GlobalSearch`

Recommended domain modules:

- `OverviewWorkspace`
- `WhatsNewWorkspace`
- `StoriesRegistry`
- `StoryDetail`
- `ArticleMemory`
- `MacroReleaseWorkspace`
- `MacroArchiveSearch`
- `MarketHeatmaps`
- `PositioningWorkspace`
- `ChartLibrary`
- `HistoryCabinet`
- `HybridOutputAudit`

## 3. Navigation and retained-module mapping

The current modules remain available, but their ownership changes.

| Current module | V8 destination |
| --- | --- |
| Overview | Overview |
| Market State | Overview and Heatmaps |
| Research Layer | Overview system status and Story Evidence Rooms |
| Stories | Stories |
| Articles | Articles |
| AI News | What's New with AI filter and linked Stories |
| Oil System | Oil Story workspace, Charts and specialist evidence panels |
| Breadth | Heatmaps and Charts |
| Macro Data | Macro Data |
| Economic Calendar | Macro Data and Story catalyst panels |
| Guidance | Company research and linked Stories |
| Statements | What's New and Story evidence |
| Signals | What's New, Heatmaps, Positioning and Story ranking |
| Earnings | Company research and linked Stories |
| Charts | Charts |
| Ledger | History Cabinet and system audit |

Company research may remain an additional child workspace if earnings and guidance volume justifies it. It should not force the flat sixteen-tab structure back into the main navigation.

## 4. What's New gaps

Existing news threads, statements, research intake and updates can feed this page.

Still required:

- a common candidate-item contract;
- duplicate grouping;
- verification state;
- materiality judgement;
- disposition history;
- exact Story promotion link;
- clear difference between detected time and publication time.

## 5. Stories gaps

Existing Story records and update objects provide a strong base.

Still required:

- reliable opened-at date;
- major-event classification;
- persistent event timeline query;
- exact related-release, statement, article, COT and chart joins;
- versioned thesis history;
- separate confirmation and invalidation records;
- archive and reopening behaviour.

## 6. Articles gaps

The current code already calculates article-to-Story alignment and change scores in the client.

For production V8:

- move durable comparison logic to a tested server or data layer;
- store the comparison result and its evidence;
- preserve article publication state;
- record whether a proposed follow-up was rejected as duplicative;
- link the exact material events since publication.

## 7. Macro Data gaps

Existing macro releases and observations should be retained.

V8 additionally needs:

- release-family definitions;
- component definitions;
- release events;
- initial and revised vintages;
- component observations by vintage;
- release interpretations by version;
- same-day release batches and day synthesis;
- searchable default twelve-month archive;
- longer retained history;
- stable deep links to releases and components.

See `MACRO_STORAGE_MODEL.md`.

## 8. Heatmap gaps

Market State and existing series can seed V8 heatmaps.

Required controls:

- display window;
- historical comparison lookback;
- category filter;
- source and freshness state;
- exact Story linkage;
- detail drawer;
- no percentile calculation when history is insufficient.

## 9. Positioning gaps

The current COT runtime should be reused.

V8 needs the two-view presentation contract:

- Alchemy official participant view;
- COTSignal-style Legacy View.

The Legacy View must disclose:

- 52-week percentile methodology;
- Commercial-score inversion;
- five-year net position as percentage of open interest;
- weekly report lag;
- positioning-is-not-direction caveat.

## 10. Charts gaps

The current market series, breadth, cracks and chart requests provide useful inputs.

V8 requires:

- category catalogue;
- Story tags;
- source and last-verified metadata;
- lightweight preview contract;
- one shared expanded stage;
- formula and component-source disclosure for derived charts;
- native macro history charts;
- no unverified EMA overlays.

## 11. History gaps

The current Ledger and research update records should become the History Cabinet.

Required versioned objects:

- Story thesis;
- macro release vintage;
- source correction;
- COT vintage;
- article comparison;
- Hybrid snapshot;
- post-catalyst review;
- method change.

## 12. Search gaps

V8 needs one global search or command palette across:

- Stories;
- Story events;
- releases and components;
- articles;
- statements;
- charts;
- History records.

Results must open exact records, not only destination pages.

## 13. Hybrid Output gaps

The production bridge needs an auditable snapshot object with:

- included records;
- excluded records;
- inclusion or exclusion reason;
- required-field failures;
- source and freshness status;
- Original record links;
- Hybrid destination;
- generated time and version.

## 14. Non-goals

Do not:

- discard existing ingestion or evidence contracts;
- reintroduce a flat sixteen-tab navigation;
- copy illustrative static values into production;
- add heavy embedded charts across the page;
- add native EMAs without a validated source;
- make COT directional;
- make Hybrid a second research engine.
