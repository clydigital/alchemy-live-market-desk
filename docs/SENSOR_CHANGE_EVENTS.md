# Deterministic Sensor Change Events

## Purpose

Specialist sensors must answer **what changed?** before any model sees the data.
This layer is deterministic and sits immediately after append-only sensor memory.
It does not perform Story selection, materiality judgement or narrative synthesis.

## Canonical event types

The first contract deliberately has only three event types:

- `NEW_SERIES` — the first stored observation for a stable series identity.
- `NEW_PERIOD` — a newly stored source period for a series that already exists.
- `REVISION` — a changed version of the same source period and methodology.

An equivalent retry emits no event.

Provider-specific signals such as threshold crossings, acceleration, persistence or
outliers are **not** generic events. They require a reviewed deterministic rule for
the specific observation family and should be layered later.

## Identity

Change classification uses the existing normalized-observation identity:

```text
observation_type
subject_type
subject_key
observed_at
methodology_version
```

A change to the same identity is a revision and points to the prior observation
through the existing `supersedes_observation_id` lineage.

A different `observed_at` for an existing series is a new period.

## Numeric deltas

The generic layer calculates `absoluteChange` and `relativeChange` only when:

1. both the current and comparison values are finite scalar numbers; and
2. the units are identical.

It never guesses a number out of an object payload and never converts units.
Relative change is omitted when the previous value is zero.

A backfilled period can be classified as `NEW_PERIOD` because the series exists,
but it is not compared numerically against a later/future observation.

## Replay and concurrency semantics

- unchanged observation -> no event;
- changed raw provenance with unchanged normalized value -> no event;
- duplicate concurrent insert that loses the database unique-index race -> no event;
- revision -> one event linked to the prior same-period observation;
- new period -> one event, optionally compared with the latest earlier period.

This prevents a replay from becoming false research evidence.

## Persistence boundary

This PR does **not** add a `sensor_change_events` table.

The events are returned by the canonical sensor-memory write operation using the
already-persisted observation lineage. That keeps this PR focused on semantics and
avoids introducing another persistence architecture before the evidence bridge is
reviewed.

If durable event persistence becomes necessary for restart recovery, it must be an
append-only/idempotent layer keyed to `normalised_observations.id`, not a parallel
copy of the underlying source data.

## Intelligence boundary

Change events are not yet canonical Intelligence Evidence and do not reach:

- Story Finder;
- Scenario / Synthesis;
- Hybrid;
- publication.

The later evidence bridge should decide which deterministic events are material
enough to promote while retaining `rawRecordId`, `observationId` and source lineage.
