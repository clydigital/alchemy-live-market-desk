# Live Desk V8 PR 1 Implementation Record

## Status

Implementation branch: `feat/live-desk-v8-shell-pr1`

This pull request installs the shared V8 route shell and compatibility layer. It does not modify Supabase, replace the research engine, seed mock values or remove the existing workspace.

## Authorities

- `docs/live-desk-v8-reference`
- open V8 documentation pull request
- attached `alchemy-live-market-desk-new-mockup-v8` static prototype
- current `main` runtime and loaders

The committed documents control product behaviour and data integrity. The mockup controls hierarchy, navigation density and interaction direction only. Its illustrative values are not used.

## Scope

### Added route ownership

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

### Preserved compatibility

The current `MarketWorkspace` remains available at:

- `/legacy`

Legacy `?tab=` links on the root route redirect to the nearest V8 destination. Unknown tab values fall back to `/legacy?tab=...`.

### Explicit failure states

New routes distinguish:

- loaded records;
- genuine empty results;
- unavailable private views;
- missing relations;
- incomplete methodology or persistence contracts.

They do not convert query failure into a healthy zero state.

## No database changes

This PR includes:

- no migrations;
- no RLS changes;
- no table, index, function or view changes;
- no destructive operations;
- no backfill.

## Existing data reused

The route shell reads the current production loaders for:

- Stories;
- Story updates;
- evidence and coverage;
- sources;
- articles;
- public statements;
- news threads;
- macro releases and observations;
- market observations and state records;
- chart requests;
- research runs and intake.

## Known gaps intentionally left visible

- mutable Story thesis fields;
- incomplete macro vintage history;
- missing complete CFTC positioning contract;
- no immutable Hybrid snapshots;
- no global search;
- no complete History Cabinet;
- `market_state_ledger` loader/schema mismatch;
- silent-empty behaviour remains in the shared legacy loader itself;
- no durable article-comparison records.

These belong to later approved PRs.

## Review checklist

- Two navigation rows remain visible on desktop.
- Each row scrolls horizontally on narrow screens.
- Primary destinations do not use dropdown navigation.
- Every route uses real loader output or an explicit unavailable state.
- Story rows have stable detail links.
- Current operational modules remain reachable at `/legacy`.
- No mock data is used.
- No production merge occurs without explicit approval.

## Rollback

The branch can be closed without affecting `main` or Supabase.

After a future merge, the lowest-risk application rollback is to revert the PR merge commit. The legacy workspace remains available throughout, so route-shell rollback does not require a database rollback.
