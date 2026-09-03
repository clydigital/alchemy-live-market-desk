# Free Research Discovery Stack

## Purpose

Live Desk remains the only canonical research and Story owner. The providers in this document expand discovery only; they do not create parallel Stories, write Hybrid state, or count provider overlap as independent corroboration.

The scheduled path is:

1. first-party/direct API and publisher RSS/Atom acquisition,
2. bounded normal-web discovery,
3. targeted high-impact macro / FX discovery for release and intervention-sensitive topics,
4. direct retrieval of the underlying publisher page,
5. Firecrawl recovery only for a specific needed page or supported direct source after normal direct access is blocked,
6. URL/provenance deduplication,
7. existing Live research intake persistence,
8. existing market-intelligence / Challenger / Story pipeline,
9. canonical Live snapshot,
10. Hybrid read-only consumption.

Official or first-party sources remain authoritative for the underlying data point when they exist. Reuters, Trading Economics, TradingView, Investing.com and similar current-market sources may supply discovery, corroboration, interpretation or market reaction; they do not replace BLS, ISM, the Federal Reserve, BOJ, MOF or another relevant primary publisher for an official release.

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

GDELT also powers a narrow high-impact search lane for two categories that should not depend on a generic six-result query:

- US macro releases and reactions: CPI, PPI, ISM/PMI, payrolls and JOLTS;
- Japan / yen: USDJPY, BOJ, Ministry of Finance and FX-intervention developments.

The lane retains the underlying publisher URL, not the GDELT index, as canonical provenance. It first tries the publisher page directly. If the page is blocked, at most a small bounded number of top results may use Firecrawl recovery. A result whose article body still cannot be verified is retained as a `monitor` lead only and cannot by itself materially recalibrate a Story.

Configuration: none. GDELT is enabled by default and may be disabled with `RESEARCH_GDELT_ENABLED=false` for the general provider fan-out. The targeted high-impact lane is part of the scheduled research path and remains bounded independently.

### Apify

Role: specialist hard-source extraction only. Live does **not** choose arbitrary Actors or assume a scraper-specific input schema. Configure a narrow Apify Task in the Apify console and Live runs that saved task with its existing input.

Configuration: `APIFY_API_TOKEN` and `APIFY_RESEARCH_TASK_ID`.

### YouTube transcripts

No second implementation was added. Live already has a dedicated YouTube discovery/transcript subsystem using the YouTube Data API + TranscriptAPI, with separate scheduling, persistence, reliability diagnostics and handoff into the canonical desk run. Adding another caption scraper would create a competing transcript path.

### Firecrawl

Firecrawl is a blocked-page recovery transport, not the first search step and not a general discovery engine.

The runtime must first try deterministic direct acquisition and normal web discovery. For a discovered article, it must try the underlying publisher page directly before invoking Firecrawl. Firecrawl may then recover a bounded specific page or a supported direct feed that is still blocked. The recovered publisher/article URL remains the provenance; Firecrawl itself does not become the evidence authority.

### Jina Reader

Jina Reader is **not** part of the general discovery-provider fan-out. It is a validated deterministic extraction transport for sources where a source-specific reader adapter has been tested. Reusable adapters may live in the codebase without being treated as a universal web fallback.

Configuration: server-only `JINA_API_KEY`.

Jina is not treated as a universal Firecrawl replacement. Any future use against other blocked or JavaScript-heavy sources must be tested source-by-source before it is added to a production acquisition path.

## Provider switches

Each keyed provider is enabled when its credentials exist unless explicitly disabled:

- `RESEARCH_BRAVE_SEARCH_ENABLED=false`
- `RESEARCH_EXA_ENABLED=false`
- `RESEARCH_TAVILY_ENABLED=false`
- `RESEARCH_GDELT_ENABLED=false`
- `RESEARCH_APIFY_ENABLED=false`

Missing credentials cause a keyed provider not to be attempted. This prevents empty API accounts from generating recurring warnings.

## Evidence rules

Search providers are not evidence authorities. The returned article URL is normalised and the underlying hostname is retained as the publisher identity. Provider snippets are lead material only. A normal search hit becomes usable article evidence only when the underlying publisher page can be read directly or recovered through the bounded blocked-page fallback.

If the article body remains unavailable, a recent result may be retained as a monitoring lead, but it must not materially recalibrate a Story without stronger evidence.

A result outside the 36-hour window, without verifiable publication time, using a non-HTTPS/local URL, or duplicating an article already collected by a higher-priority path is discarded or downgraded according to the acquisition contract.

Cross-provider duplicates count once. For example, if Brave, Exa and GDELT all discover the same Reuters URL, that is one evidence item, not three confirmations.

For official data, keep the layers distinct:

- **official Actual / component:** primary agency or publisher;
- **consensus / market reaction:** reputable current-market source when needed;
- **interpretation:** Live reasoning over traceable evidence;
- **search provider:** discovery only.

## Budget controls

The scheduled research cadence is two desk runs per day. Each enabled general discovery provider receives one bounded query per run. Tavily is pinned to the one-credit `basic` search path. Results are capped before they enter the existing 250-item research-run ceiling.

The high-impact macro / yen lane runs two narrow GDELT searches, retains at most four unique leads per query, and permits at most two blocked-page Firecrawl recoveries per scheduled run.

Apify is intentionally task-based and narrow because platform usage depends on the selected Actor/task. It should be reserved for sources where direct HTTP/RSS/API and the normal search / blocked-page recovery path do not already solve the acquisition problem.

## Deliberate exclusions

The broader research-tool survey also considered Crawl4AI, Neo4j Aura and Alpha Vantage. They are not added to this runtime change:

- Crawl4AI would duplicate the already-installed Firecrawl extraction layer unless a future self-hosted fallback requirement is explicit.
- Neo4j would create another persistence system. Causal/relationship state should remain canonical in Supabase first; a graph database may later be a derived read/query layer.
- Alpha Vantage's free request ceiling is better reserved for a specific deterministic data gap rather than overlapping current canonical market-data adapters.

These exclusions prevent tool count from becoming architectural duplication.
