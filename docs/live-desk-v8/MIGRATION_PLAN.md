# V8 Migration Plan

## Guiding rule

Refactor the interface around the existing research engine. Do not combine a visual migration with a wholesale ingestion rewrite.

## Phase 0: Protect the current desk

- Confirm current main branch and production deployment.
- Record the current Supabase schema and data contracts.
- Add route and data-contract tests before extraction.
- Keep the current workspace available during preview development.
- Introduce a feature flag or separate preview deployment for V8.

### Exit gate

Current production remains functional and the same source objects can be loaded in preview.

## Phase 1: Shared shell and navigation

- Build `LiveDeskShell` and final two-row navigation.
- Preserve the existing purple visual identity.
- Add route-level error, loading and stale-data states.
- Add legacy `?tab=` redirects.
- Add keyboard and mobile navigation tests.

### Exit gate

All V8 destinations can load as empty route shells without breaking current production data.

## Phase 2: Core research routes

Implement in this order:

1. Overview
2. What's New
3. Stories and Story detail
4. Articles

Reuse current Story, update, article, source, statement and research-intake objects.

### Exit gate

A new intake item can be promoted into a persistent Story, and the resulting event appears in both the Story and article comparison flow.

## Phase 3: Macro Data

- Implement release definitions and component definitions.
- Store release events and vintages.
- Add multi-release day stack and day synthesis.
- Add Component Laboratory.
- Add twelve-month default search.
- Preserve longer history.
- Connect economic-calendar events.

### Exit gate

A user can open a release, inspect components, compare initial and revised values, and find the same release through search.

## Phase 4: Heatmaps and Positioning

- Refactor Market State into V8 heatmaps.
- Separate display range and comparison lookback.
- Reuse current COT ingestion and calculations.
- Implement Alchemy and COTSignal-style views.
- Add Story relevance and weekly insights.

### Exit gate

Every heatmap or positioning claim displays source, report date, lookback and exact Story linkage.

## Phase 5: Charts and History

- Build the lightweight chart catalogue.
- Add source and verification metadata.
- Add one shared expanded stage.
- Convert Ledger records into History Cabinet versions.
- Add post-catalyst review records.

### Exit gate

A chart can be opened from a Story and its prior interpretation can be replayed from History.

## Phase 6: Hybrid Output

- Define the versioned outgoing snapshot.
- Add inclusion and exclusion ledger.
- Add readiness gates.
- Link each Hybrid item back to the Original record.

### Exit gate

Hybrid can consume one approved snapshot without recomputing the research conclusion.

## Phase 7: Search and cutover

- Add global search.
- Validate route permissions and performance.
- Run production build and automated tests.
- Compare current and V8 feature parity.
- Complete manual review of priority Stories, macro releases, COT and Hybrid Output.
- Promote the V8 preview to production only after acceptance.

## Production acceptance checklist

- Source freshness visible.
- Failed sources fail explicitly.
- What's New dispositions work.
- Stories retain at least one to two months of major events.
- Articles compare against current Stories.
- Macro supports components, revisions and twelve-month search.
- Heatmaps show lookback.
- Positioning shows methodology and lag.
- Charts are lightweight and Story-linked.
- History is append-only.
- Hybrid Output is auditable.
- Legacy tab links redirect correctly.
- No current research method is lost.
