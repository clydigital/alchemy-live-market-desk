# Specialist Sensor Memory Foundation

## Why this exists

The Live Desk already has durable Macro Indicators snapshots in `macro_source_snapshots`, but the new specialist sensors (SEC, FINRA, JODI, Japan MoF, Statistics Canada, ONS, Eurostat and IMF) need a provider-neutral historical ledger before they are allowed to influence Story Finder.

A production schema check on 2026-08-20 confirmed that the older V8 migration file described `raw_source_records` and `normalised_observations`, but those two tables were never applied to the production database. The current intelligence schema already contains optional bridge columns (`intelligence_evidence.raw_source_record_id` and `story_events.observation_id`) with no foreign keys because the target tables are absent.

This change implements only that missing narrow memory layer. It does **not** apply the entire old V8 migration.

## Data flow

```text
specialist API / official file
        ↓
immutable raw payload
        ↓
raw_source_records
        ↓
deterministic normalizer
        ↓
normalised_observations
        ↓
change / revision detection
        ↓
Story Finder later
```

No LLM is involved in the persistence or comparison path.

## Raw-source semantics

`raw_source_records` is append-only.

Identity/deduplication uses:

```text
provider + source_url + SHA-256(content)
```

Therefore:

- the exact same provider payload fetched again is reused rather than duplicated;
- a changed payload appends a new raw record;
- the prior raw record is never rewritten;
- an optional `ingestion_key` can give a caller a stricter idempotency identity;
- the raw payload remains server-side research memory, not a Hybrid/public-feed table.

Provider failures should continue to use the existing acquisition-failure/research-run diagnostics rather than being represented as successful empty raw data.

## Observation semantics

A normalized observation has a stable series/entity identity:

```text
observation_type
+ subject_type
+ subject_key
+ observed_at
+ methodology_version
```

`subject_key` excludes time. `observed_at` carries the source observation period/event timestamp.

If a later payload contains the same value and normalized metadata, no false change row is created. If the reading changes, a new row is appended and `supersedes_observation_id` links it to the previous version.

This means a revision looks like:

```text
100.1 preliminary
   ↓ superseded by
100.4 final
```

not:

```text
100.1 → overwritten → lost
```

## Existing schema reuse

This deliberately reuses names and field semantics already proposed by the dormant `20260807010000_live_desk_v8_persistence.sql` rather than introducing a second competing raw-data architecture.

Once the two tables exist, the migration also installs the previously intended bridges:

- `intelligence_evidence.raw_source_record_id → raw_source_records.id`
- `story_events.observation_id → normalised_observations.id`

No existing Evidence or Story row is changed by installing those foreign keys because both bridge columns are currently nullable.

## Security

Both tables:

- have RLS enabled;
- expose no privileges to `anon` or `authenticated`;
- are writable/readable by `service_role` only;
- reject UPDATE and DELETE with an append-only trigger.

Curated evidence and published Story state remain separate layers.

## Activation boundary

This PR only adds the schema migration file, generic persistence helper and tests. It does not invoke the helper from any sensor and does not apply the migration to production.

Required sequence:

```text
1. merge code/migration file
2. explicit approval to apply production migration
3. verify tables/FKs/RLS in production
4. wire one sensor at a time into the memory helper
5. prove revision/no-change behaviour with real payloads
6. only then expose changed observations to Story Finder
```
