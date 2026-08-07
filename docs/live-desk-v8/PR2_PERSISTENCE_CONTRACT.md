# Live Desk V8 PR 2: Persistence Contract

## Purpose

PR 2 separates source material, structured observations, Story interpretation and derived calculations so the desk can reconstruct what was known, what changed and why.

This pull request is additive. It does not remove the existing `stories`, `story_updates`, `sources`, `evidence`, `macro_releases`, `macro_series_observations` or `market_series_observations` tables.

It now also defines the persistence boundary for the verified creator-video pipeline, four canonical research slots, Fiscal Supply and Treasury Liquidity, causal edges, asset impacts and the redacted Live-to-Hybrid handoff. See `PR2_VERIFIED_RESEARCH_AND_FISCAL_MODULE.md` for the extended contract.

## Current database state inspected

The connected Supabase project currently contains:

- 10 Stories;
- 35 Story updates;
- 76 sources;
- 101 evidence records;
- 5 macro release records;
- 88 macro series observations;
- 288 market series observations.

Existing Story thesis fields are stored directly on `stories` and can currently be overwritten. `story_updates` provides dated notes but does not preserve a complete thesis snapshot. Macro release values are also stored as a current row rather than an immutable sequence of vintages.

## New persistence layers

### 1. `raw_source_records`

Immutable source payloads captured at ingestion time.

Each record preserves:

- provider and URL;
- source and content type;
- content hash;
- raw text and structured payload;
- publication, observation and retrieval timestamps;
- linked source, intake item and research run;
- optional pointer to the record it supersedes.

Raw records are not publicly readable. They may contain full transcripts, source payloads or licensed material. Server-side research processes retain write access through the service role.

### 2. `normalised_observations`

Structured facts derived from raw records.

Each observation records:

- its raw parent;
- subject type and stable subject key;
- observation and effective timestamps;
- structured value and unit;
- confidence and preliminary status;
- methodology version;
- optional Story and source links;
- optional superseded observation.

This separates what a source said from later interpretation or calculation.

### 3. `story_events`

Append-only material Story history.

Supported event types are:

- headline update;
- evidence update;
- contradiction;
- confirmation;
- invalidation;
- catalyst;
- thesis revision;
- archive;
- reopen;
- correction;
- source update.

The migration backfills existing `story_updates` into `story_events` while retaining the original update ID.

### 4. `story_thesis_versions`

Complete immutable Story snapshots.

A version preserves the thesis-bearing fields that would otherwise be overwritten, including:

- title and thesis;
- status and confidence;
- market question and dominant narrative;
- best explanation;
- strongest support and contradiction;
- priced assessment;
- confirmation and invalidation conditions;
- next catalyst;
- article angle and verdict;
- linked assets;
- a full JSON snapshot of the Story row.

The migration creates version 1 for every existing Story. A trigger then records a new version whenever a thesis-bearing Story field changes. Ranking and derived score movements do not create a thesis version merely because presentation order changed.

`stories.current_thesis_version_id` is a mutable convenience pointer. The immutable version rows remain canonical.

### 5. `derived_metric_versions`

Versioned calculations separate from raw and normalised facts.

Each metric records:

- metric and subject keys;
- methodology version;
- as-of timestamp;
- scalar or structured value;
- unit;
- exact observation IDs used as inputs;
- calculation description;
- source-freshness state;
- stale status.

This is the intended home for breadth scores, pulse values, positioning percentiles and other calculations once their writers are migrated.

### 6. `macro_release_vintages`

Append-only macro release values.

Initial values and later revisions become separate rows. A revision points to the vintage it supersedes rather than overwriting it.

### 7. `record_revisions`

Generic correction and override ledger.

Every correction, supersession, invalidation, restoration or manual override can retain:

- actor and timestamp;
- reason;
- prior and replacement record references;
- previous and new structured values;
- supporting metadata.

### 8. Verified research and fiscal pipeline

The second PR 2 migration adds:

- `research_schedule_slots`;
- `research_slot_runs`;
- `research_slot_events`;
- `creator_claims`;
- `claim_verifications`;
- `causal_edges`;
- `asset_impacts`;
- `fiscal_supply_snapshots`;
- `treasury_auction_results`;
- `hybrid_publication_snapshots`.

These records support the full detect-to-Hybrid chain without allowing creator transcripts to bypass primary-source verification.

## Immutability

The following tables reject `UPDATE` and `DELETE` operations:

- `raw_source_records`;
- `normalised_observations`;
- `story_events`;
- `story_thesis_versions`;
- `derived_metric_versions`;
- `macro_release_vintages`;
- `record_revisions`;
- `research_slot_events`;
- `creator_claims`;
- `claim_verifications`;
- `causal_edges`;
- `asset_impacts`;
- `fiscal_supply_snapshots`;
- `treasury_auction_results`;
- `hybrid_publication_snapshots`.

Corrections must append a superseding record and, where appropriate, a revision-ledger entry.

`research_schedule_slots` and `research_slot_runs` remain mutable operational state because schedules, heartbeats and stage health must update while a run is active.

## Read access

Presentation-safe tables retain public read access so the existing desk can consume them after the loaders are migrated:

- normalised observations;
- Story events;
- Story thesis versions;
- derived metric versions;
- macro release vintages;
- causal edges;
- asset impacts;
- fiscal supply snapshots;
- Treasury auction results;
- redacted Hybrid publication snapshots;
- canonical schedule definitions.

Raw source material remains private. Creator claims, claim verifications, run health and stage-level execution events are authenticated-only. The revision ledger is also authenticated-only.

## Migration behaviour

The migration set is designed to:

1. create new objects without dropping or renaming current ones;
2. backfill existing Story updates into Story events;
3. create a baseline thesis version for every existing Story;
4. set each Story's current-version pointer;
5. install future automatic thesis capture;
6. install indexes, RLS and append-only protection;
7. seed the four canonical Asia/Kuala_Lumpur research slots;
8. define creator claim, verification, causal-edge and asset-impact records;
9. define fiscal-supply and Treasury-auction records;
10. define a redacted Live-to-Hybrid publication boundary.

The current application continues reading its existing tables until later pull requests intentionally adopt the new contract.

## Validation

`supabase/tests/pr2_persistence_contract.sql` is a read-only post-migration check. It verifies:

- all required tables and current-state views exist;
- the current-version column and triggers exist;
- every Story has a baseline version and valid pointer;
- every legacy Story update was backfilled;
- immutable claim and Hybrid publication triggers exist;
- all four canonical research slots use the expected times;
- verification and Hybrid health states are first-class columns;
- creator claims are not publicly readable;
- redacted Hybrid snapshots have a read policy.

The migrations have not been executed against the connected Supabase project in this pull request.

## Rollout sequence

1. Review the schema and trigger behaviour.
2. Apply both migrations in order in a disposable or staging database.
3. Run the read-only contract checks.
4. Exercise Story insert and thesis-update flows.
5. Exercise one complete slot run from transcript save through redacted Hybrid publication.
6. Confirm service-role ingestion can write while public clients cannot mutate or read private records.
7. Review query plans for Story history, claim verification, fiscal snapshots and current-state views.
8. Apply to production only after explicit approval.

## Known boundaries

- Existing source and evidence rows are not duplicated into raw/normalised layers automatically because their original payloads are not recoverable from the current tables alone.
- Existing Story updates are backfilled as events, but they cannot reconstruct historical full-thesis snapshots that were never stored.
- Derived-metric writers remain on their current implementation until later PRs.
- The pipeline contract does not itself run transcription, verification or fiscal ingestion workers.
- Hybrid consumption, the Fiscal Supply interface, global search and the complete History Cabinet remain later phases.
- Raw source retention, payload-size limits and archival policy still require an operational decision before high-volume transcript ingestion is moved to this table.
