# Office for National Statistics sensor contract

The ONS adapter (`lib/providers/ons.ts`) is a deterministic specialist sensor for UK/GBP-relevant Stories.

## Source

- Base API: `https://api.beta.ons.gov.uk/v1`
- Authentication: none; the ONS API is open and unrestricted.
- Status: ONS marks the API as Beta, so schema/endpoint drift must be treated explicitly rather than silently tolerated.

## Acquisition contract

The sensor first fetches `/datasets/{id}` and preserves dataset identity, title, last-updated timestamp, release frequency, unit, state, national-statistic flag, publication links and the official latest-version link.

Observation acquisition is **opt-in and bounded**. The adapter never wildcard-downloads a dataset merely because metadata exists. A caller must supply an explicit observation dimension query. When no edition/version is supplied, the adapter resolves both from the official `latest_version` link.

For CMD datasets the observation path is:

```text
/datasets/{datasetId}/editions/{edition}/versions/{version}/observations?...dimensions
```

The parser preserves observation values, dimension option IDs, observation metadata and the source unit. Missing or non-numeric observations are not fabricated.

## Failure semantics

- dataset metadata failure → `unavailable`;
- dataset available but version/observation request fails → `partial`;
- metadata and requested observations available → `ready`.

The first implementation remains sensor-only:

```text
ONS official API
→ deterministic normalized snapshot
→ persistence/change contract next
→ Story Finder activation only for UK/GBP-relevant Stories
```

No ONS call is currently added to cron, Brain, Story Finder or Hybrid by this change.
