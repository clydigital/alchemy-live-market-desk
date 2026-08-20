# IMF SDMX 3.0 Sensor

Purpose: add a deterministic, free/no-key IMF macro sensor using the current SDMX 3.0 surface rather than the older DataMapper endpoint.

## Source

Official IMF Data API base:

`https://api.imf.org/external/sdmx/3.0`

Data requests use:

`/data/dataflow/{AGENCY}/{DATAFLOW}/{VERSION}/{KEY}`

The adapter requests `text/csv` so IMF rows arrive in a flat, auditable format with source field names preserved.

## Why not DataMapper

The legacy DataMapper path (`www.imf.org/external/datamapper/api/v1`) is useful conceptually, but modern server environments can be blocked by the IMF/Akamai edge. The SDMX 3.0 API is the preferred machine-readable path for this integration.

## Safety contract

The adapter requires:

- explicit agency id;
- explicit dataflow id;
- explicit dimension key;
- explicit start and end periods.

A full-data `*` key is refused. Empty key segments are refused, and only one wildcard dimension is allowed. The response is capped at 5,000 normalized observations by default.

This keeps IMF as a specialist sensor rather than an uncontrolled catalogue download.

## Canonical observation identity

The parser preserves every CSV source field in `fields`, plus normalized accessors for:

- `TIME_PERIOD`;
- numeric `OBS_VALUE` when valid;
- `OBS_STATUS` when present.

Missing values remain null. Status-only observations remain visible rather than being converted to zero or dropped silently.

## Example WEO query

Germany real GDP growth, annual frequency:

```text
agency: IMF.RES
dataflow: WEO
key: DEU.NGDP_RPCH.A
startPeriod: 2020
endPeriod: 2030
```

The exact dimension order belongs to each IMF dataflow. Callers must therefore supply a reviewed dataflow/key mapping; the adapter does not guess dimension order.

## Failure semantics

- invalid/unbounded key -> `unavailable`;
- invalid date range -> `unavailable`;
- non-2xx HTTP -> `unavailable`;
- network/timeout -> `unavailable`;
- CSV schema or row-width drift -> `unavailable`;
- response above the row safety bound -> `unavailable`.

No fallback estimate or substitute country/series is fabricated.

## Runtime role

This change is sensor-only:

```text
IMF SDMX 3.0
→ bounded deterministic CSV snapshot
→ tests
→ append-only persistence/change history next
→ Story Finder only when global-macro/reserve/fiscal context is relevant
```

No cron, Brain, Story Finder, Hybrid or production persistence wiring is added by this sensor.
