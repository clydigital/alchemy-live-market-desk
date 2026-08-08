# Live Desk V8 PR 1 Implementation Record

## Status

- Branch: `feat/live-desk-v8-shell-pr1`
- Base: `main`
- Pull request: #4
- Production: unchanged
- Supabase: unchanged
- Merge state: draft and unmerged

## Implemented

### Shared V8 shell

The route shell provides two persistent navigation rows:

**Desk**

- Overview
- What’s New
- Stories
- Articles
- Hybrid Output

**Data and tools**

- Macro Data
- Heatmaps
- Positioning
- Charts
- History

### Route ownership

The following destinations now have stable route ownership:

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
- `/legacy`

Legacy `?tab=` URLs are redirected to the corresponding V8 route where a direct mapping exists. The original workspace remains available at `/legacy`.

### Charts

The Charts route retains a visible working chart experience rather than reducing charts to summary cards. It includes:

- live market series from the existing market loader;
- a visible SVG chart canvas;
- 7D, 30D, 90D and 1Y controls;
- series selection;
- last value and 5D/21D change context;
- source links;
- existing research chart requests.

### Heatmaps

The Heatmaps route uses the existing functional `MarketStateBoard` with current market series, breadth, Story and update records. Missing persisted state cells do not replace the working board with a product-facing schema warning.

### Positioning

The Positioning route includes:

- an Alchemy raw-position view;
- a COTSignal-style 52-week view;
- official CFTC Legacy Futures Only data;
- Commercial, Large Spec and Small Spec classifications;
- Commercial raw and inverted scores;
- percentages of open interest;
- weekly percentile changes;
- stale-report labelling;
- Story links;
- an official source link.

No positioning values are inferred from price action or copied from the static prototype.

### Product copy

Normal product routes no longer display implementation-specific language such as:

- pull request or phase numbers;
- internal relation names;
- audit-process notes;
- statements that a feed is not exposed to a route.

Limitations remain visible in neutral product language where they materially affect interpretation.

## Validation

- Vercel preview deployment completed successfully.
- Next.js 15.5.18 production build passed.
- Compilation completed successfully.
- TypeScript validation passed through the Next.js build.
- Lint validation passed through the Next.js build.
- Route generation completed successfully.
- Charts, Heatmaps and Positioning routes returned successfully in preview checks.
- The Positioning route returned official CFTC records rather than illustrative values.
- The original workspace remains available at `/legacy`.

## Database changes

None.

No Supabase migrations, RLS changes, table changes or data writes are included in this pull request.

## Remaining limitations

- Story thesis fields remain mutable.
- Complete macro-vintage reconstruction is not installed.
- Complete point-in-time Story reconstruction is not installed.
- Hybrid editions are not immutable snapshots.
- CFTC history is fetched from the official runtime feed rather than persisted as an internal historical dataset.
- Global search and complete historical replay remain later work.

## Rollback

Before merge, closing the pull request leaves production, `main` and Supabase unchanged.

After a future authorised merge, revert the merge commit. The legacy workspace remains available throughout the transition.
