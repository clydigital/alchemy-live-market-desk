# Statistics Canada WDS change sensor

## Purpose

Use Statistics Canada's free, keyless Web Data Service (WDS) as a deterministic Canada macro change sensor. The first boundary is sensor-only: identify changed vectors, retrieve exact metadata and changed datapoints, and preserve release/reference-period identity before any persistence or Story Finder wiring.

## Official endpoints

Base:

`https://www150.statcan.gc.ca/t1/wds/rest`

Methods used:

- `GET /getChangedSeriesList` — series updated in the current Statistics Canada release window.
- `POST /getSeriesInfoFromVector` — metadata for explicit vector IDs.
- `POST /getChangedSeriesDataFromVector` — changed datapoints for explicit vector IDs.

No API key is required.

Statistics Canada documents that updates are available each business day at 08:30 Eastern time. Some methods can be unavailable while tables are locked; HTTP 409 is therefore an explicit temporary-unavailability state, not an empty release. WDS also documents an individual-IP ceiling of 25 requests per second, so this adapter uses bounded vector batches rather than per-vector fan-out.

## Canonical identity

Changed-series identity preserves:

```text
vectorId
+ productId
+ coordinate
+ releaseTime
```

Changed datapoints preserve:

```text
vectorId
+ refPer / refPer2
+ refPerRaw / refPerRaw2
+ releaseTime
+ value
+ decimals
+ scalarFactorCode
+ symbolCode
+ statusCode
+ securityLevelCode
```

Series metadata preserves frequency, scale, unit-of-measure code, termination state, and English/French series titles.

## Failure semantics

- HTTP/network/malformed JSON → `unavailable`.
- HTTP 409 while Statistics Canada locks tables → `unavailable`, explicitly labelled as a temporary lock.
- If one vector-detail method succeeds and the other fails → `partial` rather than fabricating the missing half.
- A legitimate successful change-list response with zero vectors remains `ready` with an explicit note.
- Requests above 50 vector IDs are refused rather than silently truncated; callers must batch deliberately.

## Integration boundary

```text
Statistics Canada WDS
→ deterministic changed-series list
→ bounded vector metadata + changed datapoints
→ persistence/change history next
→ CAD/Canada Story activation only after review
```

No StatCan call is added to cron, Brain, Story Finder or Hybrid by this change.
