# P1.4 Presenter Historical Dossier Context Boundary

## Decision

Historical Presenter replay is currently limited to the immutable Story-reasoning layer.

A selected historical Journey edition can replay the exact Story reasoning version frozen in its `canonicalStoryManifest`, but the edition does not persist the exact `market_dossiers_v2.id` that supplied the Presenter investigation.

Therefore Presenter must not claim that the following fields are historical when only an old Journey edition is selected:

- pre-tape expectation
- observed/measured reaction
- divergence
- missing-evidence context
- investigation identity/history

Those fields continue to come from the currently selected Dossier presentation.

## Why no automatic edition → Dossier join exists

`market_dossiers_v2` is immutable and individually addressable, but the current schema has no `research_run_id` column and canonical Journey base editions do not persist a Dossier ID.

Without an exact persisted identity, an edition cannot safely recover a Dossier by:

- nearest timestamp
- matching `as_of`
- current/latest Dossier
- Story linkage
- Dossier thesis-ledger linkage
- prose similarity

Any such rule would create a fuzzy historical reconstruction and could mix reasoning from different vintages.

## P1.4 contract

`presenter-historical-context-boundary/1` exposes two scopes:

- `CURRENT_CASE`
- `HISTORICAL_STORY_REASONING_ONLY`

When historical Story reasoning is selected:

- Story explanation/mechanisms remain pinned to the selected immutable Journey edition.
- Dossier investigation context remains explicitly current.
- `historicalDossierReplayAvailable` is always `false`.
- UI labels the case `STORY REASONING ONLY`.

Invalid edition requests fall back to the current immutable edition and never trigger a Dossier-history lookup.

## P1.5 publication identity

P1.5 now freezes the exact Dossier presentation identity into newly published Journey base editions as `presenterDossierContext`.

The frozen contract records:
- selected immutable Dossier ID
- selected Dossier `as_of`
- latest Dossier ID / `as_of` at capture time
- selection status
- whether Hybrid had selected a prior healthy fallback
- publication-boundary capture time

The selected Dossier is also included in immutable `source_record_refs`.

Composed editions inherit the frozen context from their immutable base edition.

This is intentionally **not yet consumed for historical Dossier replay**. P1.4's UI boundary remains active until the replay reader validates and loads that exact ID. Older editions that predate P1.5 also remain Story-reasoning-only.

## What is still required for full historical-case replay

A subsequent replay partition may use `getDossierV2PresentationSelectionById` only when a selected historical edition contains a valid frozen `presenterDossierContext` with an exact Dossier ID.

It must fail closed for:
- older editions without the context
- malformed context
- unavailable referenced Dossier rows
- mismatched Dossier identity

It must never derive the Dossier from timestamp proximity or mutable current state.
