# ChatGPT MCP and deployed research-provider routing

**Status:** Integration runbook and acceptance contract; no newly enabled production providers  
**Checked:** 13 October 2026 (Malaysia time)  
**Owners:** Live Desk is canonical for evidence, Story and Regime reasoning. ChatGPT research is a companion, not a replacement.

## Two distinct execution surfaces

1. **ChatGPT MCP:** Connects tools to an interactive ChatGPT session or an eligible ChatGPT task. An installed MCP plugin does **not** supply API credentials to Vercel or GitHub Actions, prove provider entitlements, or create a new ingestion schedule.
2. **Deployed backend:** Uses its own authorised HTTPS/API adapters, server-only credentials, source-health logic, evidence contracts and existing Vercel schedule. It never calls a ChatGPT-only MCP plugin by implication.

**Do not:** add another reasoning engine, store credentials in the repository, treat a discovery excerpt as a canonical observation, change Hybrid's read-only authority, or activate a new cron solely to support a plugin.

## Provider disposition

| Service | ChatGPT use | Backend disposition | Evidence authority |
| --- | --- | --- | --- |
| Acumen by Talarion | New-development / omission radar; source-linked research questions | **Not integrated** as deployed API. Do not assume its ChatGPT MCP can run in Vercel | Original publisher must be checked |
| FactIQ | Search official statistical and company datasets; verify units, periods, revisions | **No separate FactIQ adapter found**. Prefer existing Treasury, FRED, SEC and other official-data adapters | Underlying official dataset and source metadata |
| RainbowStats | FRED/Treasury comparisons, transformations and statistical checks | **No RainbowStats backend adapter**. Reuse official source feeds; do not replicate its ChatGPT analysis service | Underlying time series with observation period, units and retrieval time |
| Alpha Vantage | Equity market quotes, history and fundamentals on demand | **Defer backend API** until an exact gap in existing market-monitor data is proved and rate limits/terms are assessed | Provider quote/filing, with trading-day and entitlement |
| Exa | Discover primary publications and less obvious source documents | **Existing** `lib/research-discovery-providers.ts` adapter, conditional on `EXA_API_KEY` | Search lead only until underlying publisher is retrieved |
| Notion | Full MacroPulse, ChatGPT Research Gap, company research pages and log | Existing ChatGPT-facing research workflow; **not** an automatically provisioned Vercel Notion reader | Human-readable research context, never canonical Evidence UUID by itself |
| GitHub | Source code, tests, PR and acceptance evidence | Canonical repository; GitHub Actions are not the primary Research Gap cron | Code and CI proof, not market evidence |
| Supabase | Inspect actual case/evidence/Dossier/Motion/Regime identities | Existing persistence and canonical reference boundary | Canonical records with exact IDs and as-of timestamps |
| Vercel | Observe deployment, runtime configuration and error traces | Existing scheduled Live and Research Gap execution | Operational proof only |
| Firecrawl | Read authorised publisher pages where direct retrieval fails | **Existing** `lib/firecrawl.ts` plus scheduled fallback. Optional `FIRECRAWL_API_KEY` | Original page and publisher URL, not Firecrawl |
| Parallel Search | Second retrieval/search view for ChatGPT research | No confirmed deployed adapter; do not wire into Vercel without a demonstrated gap | Search lead only |
| TinyFish | Limited interactive page and UI acceptance checks | No general live ingest adapter; don't use for bulk scraping | Page inspected, source still publisher |
| Finnhub | **Skipped by user** | Existing earnings-calendar adapter stays inactive. Do not configure `FINNHUB_API_KEY` or set business approval without a new decision | Issuer IR authoritative for exact event dates |

### ChatGPT connector smoke tests — point-in-time only

Read-only tests on **13 October 2026**:
- Acumen: returned dated, linked US Treasury research leads.
- FactIQ: listed official-data catalogue and retrieved `treasury/yield_curve.10_yr` with units, dates and source metadata.
- RainbowStats: retrieved FRED series `DGS10`; its returned latest observation was dated 8 October.
- Alpha Vantage: returned an NVDA global quote with trading date 9 October.

**These confirm the ChatGPT connections only.** They do not validate deployed API access, coverage for every instrument, licensing or future freshness. A FactIQ Treasury **par yield** series and FRED `DGS10` **constant-maturity** series are separate series definitions: preserve both identities rather than assuming their values must match.

## Existing backend chain — reuse unchanged

```text
Official API / primary publisher feeds
  -> bounded Brave / Exa / Tavily / GDELT discovery (where configured)
  -> original publisher fetch
  -> Firecrawl targeted fallback only after a supported blocked source
  -> timestamp, URL and source-identity validation + deduplication
  -> existing Live research intake / canonical evidence admission
  -> System 2 adjudication -> Motion / Story / Regime -> Dossier
  -> canonical snapshot -> read-only Hybrid Journey

ChatGPT Acumen / FactIQ / RainbowStats / Alpha Vantage
  -> researcher-only corroboration, hypotheses and missing-evidence questions
  -> existing Research Gap evidence requirements / Live intake gate
  -> NOT direct Story, Motion, Regime, Dossier or Hybrid mutation
```

No plugin shall automatically set `CONFIRMING`, `CONTRADICTING`, `COMPLETED` or a Story thesis verdict. The existing Research Gap evaluator and handoff contract remain authoritative.

## Credential and install sequence — no secrets in Git

**Priority 1 — Exa backend:** Already implemented but needs its own deployment credential. Create/check an API key at [Exa dashboard](https://dashboard.exa.ai/); set server-only `EXA_API_KEY` in [Vercel](https://vercel.com/dashboard), project `alchemy-live-market-desk` -> Settings -> Environment Variables; redeploy as appropriate and run one bounded research acceptance check. A working ChatGPT Exa plugin is not a substitute for this key.

**Priority 2 — Firecrawl recovery:** Only if a *specific* eligible blocked public publisher feed or article proves recovery is needed. [Firecrawl console](https://www.firecrawl.dev/app) -> `FIRECRAWL_API_KEY` in Vercel. Verify the direct-access-healthy path makes **zero** fallback calls. Do not scrape protected or paywalled pages.

**Priority 3 — FRED / official rates:** [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html) if a specific existing official-data adapter requires it. Existing `DGS10`, nominal yield and breakeven measurements need an **exact** source-to-`observed_evidence` UUID proof before claiming the Dossier rate evidence gap is resolved. A key alone is not the fix.

**Hold:** Alpha Vantage backend, Finnhub, Parallel Search backend, any Acumen/FactIQ/RainbowStats production API, extra Vercel cron jobs, and bulk web/browser scraping until explicit data, licensing and cost gaps justify them.

The variable listing from the connected Vercel project was inspected on 13 October 2026. At that point `EXA_API_KEY`, `FIRECRAWL_API_KEY`, `FRED_API_KEY`, `ALPHA_VANTAGE_API_KEY` and `FINNHUB_API_KEY` were **not listed**. Recheck the actual environment and deployment before changing anything; the snapshot is not perpetual proof.

## Research allocation

- **MacroPulse:** fast surveillance; publish full dated records to Notion Financial Research without requiring any backend provider to run. Its independent ChatGPT task cadence is not the Vercel research schedule.
- **ChatGPT Research Gap:** use plugin findings as sourced *leads* with precise missing evidence; preserve the original pulse ID, time, URL, publisher and unresolved contradictions.
- **Backend Research Gap:** reads exact canonical Dossier gaps and uses its existing claim/plan/verdict/handoff path. No scraping Notion prose as machine input; no automatic bridge from ChatGPT plugins.
- **AI Capex / Bubble regime:** issuer SEC filings, capex and cash-flow observations have priority over market summaries; use quote feeds for dated price reaction, not to assert profits or spending. Record issuer/period/currency/unit and whether YoY, QoQ or MoM comparisons are valid.
- **Motion-led Hybrid:** consumes canonical Live Motion/Story/Regime/Dossier snapshots and identity-pinned revisions. Does not re-investigate with plugins or silently upgrade a search lead into a motion.

## Minimum provider acceptance contract

For every proposed integration or activation, record:

1. **Identity:** provider, instrument or economic series, original URL, source class, publisher, endpoint and licence/entitlement.
2. **Clock:** observation period/trading day, publication timestamp where supplied, retrieval time, source vintage/revision and configured freshness threshold; do not substitute webpage generation time.
3. **Exactness:** units, currency, adjustment method, series definition (e.g. par yield vs constant maturity), validation of returned schema and bounded request count.
4. **Ownership:** duplicate URL/underlying release counted once, provisional search leads kept separate from original evidence, stable evidence UUID and frozen Dossier/Gap references.
5. **Safe failure:** missing key, denied entitlement, HTTP error, stale observation or provider outage leave a specific health/degraded/UNRESOLVED record; never fill missing values by inference.
6. **Readback:** prove a sample actual response -> existing intake -> canonical evidence ID -> current Dossier ID/as-of -> downstream read-only Hybrid reference, or report the first observed break.
7. **Budget and tests:** use existing run slots and limits, deterministic fixtures and CI, then deployment readback. No unapproved paid entitlements or new scheduled job.

## Execution and verification

- Existing [discovery code](../lib/research-discovery-providers.ts), [discovery contract](FREE_RESEARCH_DISCOVERY_STACK.md), [Research Gap executor](RESEARCH_GAP_EXECUTION.md) and [Macro research pipeline](MACRO_RESEARCH_PIPELINE.md) are the operative implementations/contracts.
- Once an Exa key is authorised, test a **single existing scheduled path** and verify its source-check ledger plus original publisher URL, duplicate suppression, and canonical readback; if not configured, status remains **not integrated in deployment**.
- Do **not** merge an operational activation or claim it is deployed until CI, production environment and exact runtime evidence support it.

**This document is a routing/install and verification playbook, not a production change.**
