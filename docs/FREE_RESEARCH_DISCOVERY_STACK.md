# Free Research Discovery Stack

## Purpose

Live Desk remains the only canonical research and Story owner. The providers in this document expand discovery only; they do not create parallel Stories, write Hybrid state, or count provider overlap as independent corroboration.

The scheduled path is:

1. first-party/direct API and publisher RSS/Atom acquisition,
2. Firecrawl recovery for supported direct sources when deterministic acquisition is blocked,
3. bounded discovery enrichment,
4. URL/provenance deduplication,
5. existing Live research intake persistence,
6. existing market-intelligence / Challenger / Story pipeline,
7. canonical Live snapshot,
8. Hybrid read-only consumption.

## Providers

### Brave Search

Role: broad current-web radar. One bounded query per scheduled desk run, up to six leads and four retained unique items.

Configuration: `BRAVE_SEARCH_API_KEY` (or legacy `BRAVE_API_KEY`).

### Exa

Role: semantic discovery and overlooked/adjacent-source hunting. One bounded query per scheduled desk run, restricted to the 36-hour research window.

Configuration: `EXA_API_KEY`.

### Tavily

Role: agent-oriented targeted news research. Live explicitly uses `search_depth=basic`, one query per run, so the recurring free allowance is not burned by automatic advanced searches.

Configuration: `TAVILY_API_KEY`.

### GDELT

Role: free global event/news discovery, especially useful for geopolitics, energy, sanctions, central banks and narrative acceleration.

Configuration: none. GDELT is enabled by default and may be disabled with `RESEARCH_GDELT_ENABLED=false`.

### Apify

Role: specialist hard-source extraction only. Live does **not** choose arbitrary Actors or assume a scraper-specific input schema. Configure a narrow Apify Task in the Apify console and Live runs that saved task with its existing input.

Configuration: `APIFY_API_TOKEN` and `APIFY_RESEARCH_TASK_ID`.

### YouTube transcripts

No second implementation was added. Live already has a dedicated YouTube discovery/transcript subsystem using the YouTube Data API + TranscriptAPI, with separate scheduling, persistence, reliability diagnostics and handoff into the canonical desk run. Adding another caption scraper would create a competing transcript path.

### Firecrawl

Firecrawl remains a fallback, not a general discovery engine. It is invoked only after supported deterministic direct acquisition fails. Discovery providers run after that fallback stage.

## Provider switches

Each keyed provider is enabled when its credentials exist unless explicitly disabled:

- `RESEARCH_BRAVE_SEARCH_ENABLED=false`
- `RESEARCH_EXA_ENABLED=false`
- `RESEARCH_TAVILY_ENABLED=false`
- `RESEARCH_GDELT_ENABLED=false`
- `RESEARCH_APIFY_ENABLED=false`

Missing credentials cause a keyed provider not to be attempted. This prevents empty API accounts from generating recurring warnings.

## Evidence rules

Search providers are not evidence authorities. The returned article URL is normalized and the underlying hostname is retained as the publisher identity. Provider snippets are only retained when the result has a usable recent timestamp or the underlying source page can be read directly to recover publication metadata.

A result outside the 36-hour window, without verifiable publication time, without a usable summary, using a non-HTTPS/local URL, or duplicating an article already collected by a higher-priority path is discarded.

Cross-provider duplicates count once. For example, if Brave, Exa and GDELT all discover the same Reuters URL, that is one evidence item, not three confirmations.

## Budget controls

The scheduled research cadence is two desk runs per day. Each enabled general discovery provider receives one bounded query per run. Tavily is pinned to the one-credit `basic` search path. Results are capped before they enter the existing 250-item research-run ceiling.

Apify is intentionally task-based and narrow because platform usage depends on the selected Actor/task. It should be reserved for sources where direct HTTP/RSS/API and Firecrawl do not already solve the acquisition problem.

## Deliberate exclusions

The broader research-tool survey also considered Jina Reader, Crawl4AI, Neo4j Aura and Alpha Vantage. They are not added to this runtime change:

- Jina's signup token allowance is not treated as a guaranteed recurring free budget.
- Crawl4AI would duplicate the already-installed Firecrawl extraction layer unless a future self-hosted fallback requirement is explicit.
- Neo4j would create another persistence system. Causal/relationship state should remain canonical in Supabase first; a graph database may later be a derived read/query layer.
- Alpha Vantage's free request ceiling is better reserved for a specific deterministic data gap rather than overlapping current canonical market-data adapters.

These exclusions prevent tool count from becoming architectural duplication.
