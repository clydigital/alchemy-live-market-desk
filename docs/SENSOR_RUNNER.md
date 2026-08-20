# Specialist Sensor Runner

## Purpose

The Live Desk now has multiple deterministic official-data adapters, but only FINRA has completed the full adapter -> append-only sensor-memory production proof. The runner exists to coordinate those sensors without turning each source into its own cron tree or allowing adapter-only sources to write into production prematurely.

This layer is deterministic. It does not call an LLM and it does not decide Story publication.

## Registry states

Every specialist source is declared in one registry with one of two integration states:

- `memory_ready`: the adapter has a reviewed deterministic mapping into `raw_source_records` and `normalised_observations` and may be selected by the runner.
- `adapter_only`: the source adapter exists, but no production memory mapping has been approved. The runner always skips it, even when manually forced.

After PR #91, FINRA is the only `memory_ready` specialist. SEC, JODI, Japan MoF, Statistics Canada, ONS, Eurostat, IMF and EIA remain `adapter_only` until each receives its own bounded memory mapping and proof.

## Planning contract

The planner receives only deterministic context:

```text
now
wake mode
relevance tokens
last successful run timestamps
optional manual force list
```

It returns an explicit decision for every registered sensor:

```text
RUN
or
SKIP + reason
```

Reasons include:

- `forced`
- `due_scheduled`
- `relevance_match`
- `event_match`
- `not_memory_wired`
- `wake_mode_not_allowed`
- `not_relevant`
- `not_due`

No source is silently dropped.

## Execution contract

`runSensorBatch` executes only planner-approved sensors. Execution is deliberately sequential and bounded to at most eight sensors per invocation, with a default bound of four.

This is intentional:

- specialist sources are low-frequency;
- upstream rate limits remain easy to audit;
- append-only writes remain easy to trace;
- one provider failure stays local and does not abort unrelated sensors;
- a missing executor is reported explicitly;
- sensors beyond the batch bound are reported as `bounded_out` rather than disappearing.

## Activation boundary

This PR does not add a new cron, Vercel route or production write path. It does not activate the adapter-only sensors. It also does not route sensor output to canonical Evidence, Story Finder or Hybrid.

The next source may become `memory_ready` only after:

```text
adapter
  ↓
deterministic SensorMemoryInput mapping
  ↓
production append-only proof
  ↓
exact retry / no-duplicate proof
  ↓
registry state changed to memory_ready
```

This keeps sensor acquisition broad while production reasoning remains selective and auditable.
