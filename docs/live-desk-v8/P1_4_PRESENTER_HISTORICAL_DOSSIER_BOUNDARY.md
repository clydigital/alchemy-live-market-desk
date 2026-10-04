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

## What would be required for full historical-case replay

A future publisher would need to freeze an exact immutable Dossier identity into the Journey edition at publication time, or freeze the full bounded Presenter investigation context directly.

Only after that exact identity is persisted should Presenter load the historical Dossier with `getDossierV2PresentationSelectionById`.

That future change must not derive the Dossier from timestamp proximity or mutable current state.
