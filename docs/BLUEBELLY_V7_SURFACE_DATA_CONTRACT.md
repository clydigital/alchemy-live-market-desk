# Bluebelly V7 — Surface data contract and ownership

Status: implementation map for the Bluebelly V7 preview branch; **not** a claim of operational connector ingestion.

## Source-to-surface ownership

| Origin | Existing adapter / boundary | Destination | Cannot do |
|---|---|---|---|
| Published, immutable daily-brief snapshots | `getLiveDeskHomepageDailyBrief` → `projectMarketBriefArticles` → `loadEditorialMarketBrief`; published Story archive via `getRecentPublishedStoryReadings` | Public Bluebelly lead, Story cards, Story history | Recompute a new thesis from a page refresh or take a private Dossier as an article |
| Verified Market Motion | `getCurrentVerifiedMarketMotion` → `selectVerifiedNewsBriefs` (`news-brief/1`) | Public verified headlines; owner's Today's Talk | Promote Motion text to canonical Evidence or change Story/Regime |
| Dated market monitor (FRED/Treasury/approved sources and available other providers) | `getMarketMonitor` (public-safe) → `publicMarketObservations` | Bluebelly observed rates, market cards, presenter cross-check | Treat monthly series as daily; claim a live intraday move from old observations; publish raw provider histories |
| Earnings + economic calendar | `getEconomicCalendar` and `getForwardEarningsEvents` → `buildPresenterCalendar` → `selectBlueDeskUpcoming` | Public Calendar, upcoming events section | Invent actuals, event times, or Story interpretations |
| Owner technical readings | Supabase approved Google owner → `/api/presenter/technical-checks` (`technical-checks/3` revision) | Private Technical Checks tab, editor and source provenance | Expose in public JSON or mutate published evidence, research, or Regimes |
| Pinned research edition | `resolvePresenterPrepExactSelection` → exact edition and Dossier → `buildPresenterPrepSourceProjection` | Native private `/presenter/full-prep`, COTD/OB editorial | Fall back to today's latest snapshot when historical selection fails |
| Stable learning definitions | `listConcepts` governed concept registry | Public `/learn` glossary, AI / rates / energy explainers | Pretend definitions are live research, plugin messages, or market opinions |
| Third-party ChatGPT plugins / creator transcripts / web or X leads | Research discovery → original publisher corroboration → existing Research Gate, source/measurement audit, canonical verification | Only eligible verified Motion or published Story, through above adapters | **No direct plugin-to-Next.js push is implemented or asserted by this change.** A ChatGPT plugin connection alone is not an authenticated application ingestion route. |

## Security and release conditions

- Exact hostname allowlist: `bluebelly-desk.vercel.app` and branch-bound `bluebelly-v6-review.vercel.app` for read-only public routes; all owner routes are private.
- Owner requests still require Google/Supabase active allowlist; API GET/PUT additionally checks user identity and revision. Never expose private credentials in the client.
- Public selection excludes source-unverified Motions and raw private data. Dashboard service-role/cron routes are never public.
- No new cron, database reasoning table, pricing provider or paid plugin. API/provider authentication and ingestion coverage must be verified independently with real runtime receipts.
- No visible Bluebelly Presenter link should target `/hybrid-output`; immutable archive access remains an underlying data reader only.
- Acceptance: public anonymous Bluebelly home and Learn work, owner paths show login unauthenticated, approved-owner sign-in and GET/PUT checklist loop, valid and invalid pinned editions, mobile 360px/tablet 768px/desktop 1440px, plus Vercel test/build.
