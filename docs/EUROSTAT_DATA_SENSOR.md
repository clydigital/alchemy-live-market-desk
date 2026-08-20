# Eurostat Statistics API Sensor

Purpose: add a deterministic, free/keyless EU macro sensor without turning Eurostat into an always-on bulk-download dependency.

## Source

Official Eurostat Statistics API:

`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{DATASET_CODE}`

The service returns JSON-stat 2.0 and exposes dataset update metadata plus dimension/category identity.

## Safety contract

The adapter intentionally refuses an unfiltered full-dataset request. Every call must provide at least one explicit filter, and the total number of requested filter positions is bounded.

`geo` and `geoLevel` are treated as mutually exclusive, matching the Eurostat Statistics API contract. `lastTimePeriod` is bounded to 1-24 periods.

The parser also refuses a response whose Cartesian cell count exceeds 5,000 by default. This prevents an apparently small URL from silently expanding into a large regional/time cube.

## Canonical identity

Each retained observation preserves:

- dataset code;
- source URL;
- Eurostat dataset label/source/update timestamp when present;
- flat JSON-stat cell index;
- every source dimension code and category code;
- category labels;
- numeric value;
- Eurostat observation status flag when present.

Dense and sparse JSON-stat value/status containers are supported. Missing cells remain missing; they are not converted to zero.

## Failure semantics

- invalid or unbounded query -> `unavailable`;
- non-2xx HTTP -> `unavailable`;
- network/timeout -> `unavailable`;
- malformed JSON-stat dimension/category schema -> `unavailable`;
- response above the configured cell safety bound -> `unavailable`.

The sensor does not substitute another dataset, geography, period or local estimate after failure.

## Runtime role

This change is sensor-only:

```text
Eurostat Statistics API
→ bounded deterministic JSON-stat snapshot
→ tests
→ append-only persistence/change history next
→ Story Finder only for EUR/EU-relevant Stories after review
```

No cron, Brain, Story Finder, Hybrid or production persistence wiring is added by this sensor.
