# Bluebelly — ChatGPT-first market terminal cutover (7 Nov 2026)

## Authority and purpose
This 7 November decision supersedes the 3 November mandatory Daily Intelligence delivery contract and the earlier Live/Hybrid two-desk research-publishing objective wherever they conflict. It does **not** supersede original-source evidence standards, authentication, legal source restrictions or historical version replay. Bluebelly is a market and research-evidence utility for ChatGPT-first analysis, not another routinely AI-written financial news website.

## Implemented first pass
1. Public primary navigation is **Markets · Calendar · Watch**, with an explicit **My Desk** owner-authenticated masthead entry. Clicking the brand opens the public market overview.
2. The homepage reuses its **existing market monitor, calendar, qualified original sources and historical thesis data**; it makes no new provider call or writing-model request. The prominent panels display the source-dated cross-asset 1D/3D/5D snapshot, upcoming catalysts, dated research watch and verified-source receipts. Null, old or unavailable observations remain visibly unfilled. Percentage versus basis-point units are explicit.
3. The existing **Today** progressive news reader is retained under an expandable *dated editorial context* control rather than a homepage-first product. The qualified Newsroom is retained as **Source Feed** under More for original-source lookup. No publication or auto-report route was created.
4. **Watch** currently reuses the existing `/key-stories` reader: it is historical tracked research, not a new trading-signal engine. Existing deep links and query selectors remain intact. **Research Archive** remains at `/research`, with original editorial dated context. Regime Lenses, Hormuz Data and Learn remain accessible as secondary tools.
5. Owner My Desk, its authentication rules, source-led research and exact archival HTML/PDF retrieval remain unchanged. **Portfolio holdings still lack a verified authenticated live readback** and must not be invented or released from an unrelated public route.

## Product ownership
| Capability | Owner after cutover |
| --- | --- |
| Primary market observations, 1D/3D/5D changes, yield/breadth source date | Markets terminal |
| Upcoming policy/economic/earnings events; frozen pre-release expectations; eventual actuals | Calendar |
| Personal or regime thesis tracking, falsifiers, next catalysts | Watch (existing historical Key Stories until redesigned) |
| Private research, creator notes, portfolio/Power Stack and archival editions | My Desk with normal session/allowlist |
| Original source ingestion, source IDs, verification status, old versions | Existing Supabase/Notion source ledger and collectors |
| Current causal explanation, cross-asset synthesis, named creator comparison, articles | ChatGPT on demand |
| Dated public editorial / historical deep dives | Archived and discoverable; not required for current market coverage |

## Decommissioning boundaries
- **Retired as requirements:** automatically produced Daily Intelligence HTML/PDF, report-parent Writing Brain, daily three-idea slates, public Daily Report and mandatory Today/Newsroom editorial maintenance.
- **Preserved without changes:** original-source intake, actuals, Market Motion, release-calendar identity, MacroPulse Post/Log, Research Gap Run/Registry, creator transcript ledger, issuer evidence, owner-protected archives, editorial deep links, canonical history and privacy boundaries.
- **Not yet safe to delete:** old story/dossier tables, feed adapters, private daily-report API readers, old report components, or old public URL routes until all exact-version consumers and historical citations are audited.
- Existing `BLUEBELLY_DAILY_HTML_FALLBACK_ENABLED` and `BLUEBELLY_ENABLE_LEGACY_PDF` remain opt-in/off by default. Do not switch these flags on to bridge a missing public summary.
- The old `/daily-report` redirects remain unchanged for bookmark compatibility. Historical edition selectors still fail closed rather than rewriting to a recent article.

## Acceptance and phased next work
**Phase 1 — this change:** CI tests, TypeScript and production build pass. Public / shows market-first view, separate Markets/Calendar/Watch links, Source Feed/archives under More, and expandable previous Today reader; responsive 390px and desktop inspection. /newsroom /research and focused /key-stories deep links continue to work. /my-reports still requires owner authentication. The backend source collector is unchanged.

**Phase 2 — no additional schedules:** verify Power Stack holdings/watchlist through actual authorised source and owner readback; make Markets comparisons and 2Y/5Y/10Y/20Y/30Y yield spreads genuinely source dated; improve calendar pre-release expectation versus actual and measured reaction; replace the current historical Watch reader with a bounded mutable thesis/event state **only if** the existing state cannot meet it. Coordinate with outstanding Markets PR #1353 before changing its files.

**Phase 3 — audit before removal:** inventory Vercel cron executions, provider costs, and actual consumers of old dossier/intelligence/report endpoints. Freeze/remove obsolete repeated PDF/HTML and writing triggers **only after proving** research/creator/issuer source evidence and archive replay survive unchanged. Avoid a new research engine, third-party dependencies or a second public article workflow.

## Freshness and privacy tests
- A fetched or database-created timestamp is not the publisher's event timestamp and is not a live market quote.
- `status=accepted` in news intake does not mean independently verified; creators/X/secondary reports remain leads.
- All displayed price/yield differences use source session and unit; market response is UNKNOWN without matched window.
- Search on the header still targets the source-qualified Newsroom; this is a search utility, not a homepage editorial promise.
- Keep owner-only and OAuth routes outside public host allowlist; never expose private Power Stack holdings or receipts publicly.
