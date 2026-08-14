# Firecrawl acquisition fallback

Firecrawl is an optional acquisition fallback for the Live Market Desk. It is not a research, ranking, deduplication or publication system.

## Architecture

The canonical order is:

1. first-party API / structured provider where available;
2. publisher RSS / Atom or normal direct HTTP acquisition;
3. Firecrawl only when a supported public direct source is blocked or unusable;
4. the existing research intake ledger;
5. canonical evidence normalisation;
6. the existing intelligence, deduplication, lifecycle and publication path.

Hybrid remains a read-only consumer of the canonical Live output.

## Configuration

Set the server-side environment variable:

```text
FIRECRAWL_API_KEY=...
```

The key is never returned to clients or persisted in research evidence.

The integration uses Firecrawl's `POST https://api.firecrawl.dev/v2/scrape` endpoint with Bearer authentication, `rawHtml` output and `proxy: auto`. Requests are bounded for serverless execution.

## When it runs

Firecrawl is deliberately credit-conservative. It is not called when direct acquisition is healthy.

The initial supported fallback set is:

- ZeroHedge public feed;
- Axios public feed;
- Investing.com public feed;
- FXStreet public feeds;
- Alchemy Market Insights public feed.

Video discovery/transcripts are not routed through Firecrawl. TranscriptAPI or YouTube provider unavailability remains explicit research debt rather than being silently replaced.

## Provenance

Firecrawl is a transport/provider fallback only. The canonical evidence source remains the original publisher and original article URL.

A recovered feed item therefore keeps:

- original publisher;
- original publication timestamp;
- original article URL;
- the same deterministic feed item-key format used by direct acquisition.

This prevents Firecrawl from becoming a duplicate evidence source or a second Story path.

## Safety and failure behaviour

- only public HTTPS URLs without embedded credentials are accepted;
- the integration must not be used to bypass authentication or paywalls;
- a Firecrawl failure does not fabricate content;
- unresolved sources remain `blocked` with the Firecrawl failure appended to diagnostics;
- missing `FIRECRAWL_API_KEY` leaves existing direct-provider behaviour unchanged;
- downstream research state remains descriptive under the post-#44 architecture.

## Tests

`tests/firecrawl-fallback.test.ts` covers:

- no API key;
- healthy direct acquisition making no Firecrawl call;
- blocked direct acquisition recovered through Firecrawl;
- original provenance preservation and tracking-parameter removal;
- Firecrawl failure remaining blocked without fabricated evidence.
