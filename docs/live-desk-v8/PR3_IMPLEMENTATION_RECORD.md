# Live Desk V8 PR 3: Overview, What’s New and Stories

## Scope

PR 3 turns the V8 shell into a usable Story-centred research surface while remaining compatible with the current database.

It is stacked on PR 2. The proposed persistence migration is not applied by this pull request.

## Overview

The Overview now links each material change to the exact Story event or dated legacy update that produced it.

When the PR 2 Story event tables are available, the page reads append-only `story_events`. Until then, it continues to read the current `story_updates` records and uses stable Story anchors.

The existing PR 1 features remain intact:

- scoring wheel and current-versus-last-week pulse presentation;
- tagged Story map;
- researched article imagery;
- typeface and text-size settings;
- current research-system status.

## What’s New

The delta stream now combines:

- dated Story events or legacy Story updates;
- verified statements;
- news-thread records.

The interface supports:

- Story, Statement and News filters;
- text search across headline, detail, Story and verification state;
- exact links into Story event anchors;
- stable self-links for every delta record;
- visible source and verification context.

The route does not claim immutable history is active when the PR 2 tables are absent.

## Stories registry

The registry now supports:

- title, thesis, asset and catalyst search;
- controlled Story-tag filtering;
- status filtering;
- evidence-room status;
- dated event counts;
- thesis-version counts when the persistence layer exists;
- stable links to full Story records.

No illustrative Stories are inserted when records are unavailable.

## Story detail

Each Story now exposes a record index for:

- current thesis;
- thesis version history;
- event timeline;
- evidence;
- sources.

Events, evidence and sources have stable URL anchors. What’s New and Overview can link directly to the exact record rather than only to the top of the Story page.

When thesis versions exist, the page selects the latest immutable version and displays the full version history. When they do not exist, the page displays the current Story thesis and explicitly states that historical full-thesis versions are unavailable.

## Compatibility strategy

`lib/persistence/read.ts` probes the PR 2 relations and returns a typed availability state.

- Available: use append-only Story events and immutable thesis versions.
- Unavailable: use current Stories and dated Story updates without fabricating earlier versions.

This allows PR 3 to be reviewed before the migration is approved while keeping the same routes and presentation contract after the migration is applied.

## Database changes

None in PR 3.

The PR 2 migration remains proposed and unexecuted.

## Validation

Preview deployment:

- deployment: `dpl_A5e7NWB3WRvtqCB1N4ZeRSL2oQdn`;
- branch alias: `https://alchemy-live-market-desk-git-feat-live-de-cf45e1-rogue-magazine.vercel.app`;
- state: READY.

Validated routes:

- `/`;
- `/whats-new`;
- `/stories`;
- `/stories/ai-capex-cash-conversion`.

The production build completed without errors. Runtime log checks returned no `error` or `fatal` entries after route validation.

## Known boundaries

- Full thesis-version history remains unavailable until the PR 2 migration is applied.
- Existing dated Story updates cannot reconstruct complete historical thesis snapshots that were never stored.
- Existing update-type and status labels retain their source values, including legacy naming conventions.
- Search is client-side over the currently loaded registry and delta window. Global cross-table search remains a later phase.
- The full History Cabinet and approved Hybrid snapshot contract remain later pull requests.

## Production status

Production, `main` and the connected Supabase project remain unchanged. This branch is intended for a draft stacked pull request and must not be merged without explicit approval.
