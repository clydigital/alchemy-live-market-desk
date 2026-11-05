# Blue Desk P0 — Frozen AI / rates / oil read-model baseline

**Recorded:** 20 October 2026. **Status:** PARTIAL / STOP. **Method:** read-only production Supabase rows + current main-branch reader contracts + anonymous live HTML/Story fetch. IDs below are **identities**, not proof of admission, causal interpretation or association to an edition.

## Immutable publication and Dossier anchors

| Object | Exact identity | Timestamp | Notes |
| --- | --- | --- | --- |
| Newest daily-brief edition | `fcea17ef-f575-4283-a363-7d5fa9c918c7` | 2026-10-19 16:19:19.317 UTC | Frozen `daily_brief`, edition phase `base`; top-level `stories` length **0**, `canonicalStoryManifest` length **0**; homepage renders six Dossier-derived article lessons |
| Prior daily-brief edition | `777a734a-ee14-45e5-a468-3137994e600b` | 2026-10-19 14:41:01.893 UTC | `stories` length **0**, manifest length **0** |
| Older than Presenter latest-24 window | `ce3b4df7-298e-4281-853a-14ce7853a1e7` | 2026-10-13 14:41:05.250 UTC | Returned using chronological offset 25; exact-edition lookup should support this ID regardless of presenter picker |
| Latest Dossier record | `cf977394-ca7c-49da-93cc-4f3da98d873b` | `as_of` 2026-10-19 20:12:21.646 UTC | **Later than newest daily-brief edition**; must never be silently attached to the 16:19 frozen edition |

Database cardinalities observed: **191** `daily_brief` snapshots, **38** Stories, **210** thesis versions and **93** Dossiers. Counts reflect observation time, not archive health.

## Three canonical Story identity fixtures

| Theme | Story ID | Thesis version ID | Version / effective-at | Existing Story title / status |
| --- | --- | --- | --- | --- |
| AI capex and cash conversion | `6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e` | `861cb4cb-f23f-4747-b105-39e363c71a8d` | v12, 2026-10-19 14:01:47.998 UTC | AI orders/backlog real; near-term cash conversion uncertain / `monitor` |
| US rates and funding | `93c3e32f-9168-49ec-aaa3-9ce678511c9b` | `ab4a40e4-2940-4920-8181-ad96b0fc40da` | v16, 2026-10-18 04:04:46.893 UTC | Real yields and funding pressure keep rates restrictive / `monitor` |
| Oil, refined-product supply | `1cf9ad1d-c350-48c4-b06e-d544771919d3` | `d2d66876-7ef0-4f4b-82a8-4ae2ce59b60e` | v23, 2026-10-19 14:01:43.019 UTC | Distillate scarcity persists despite crude-flow recovery / `monitor` |

These are valid database identities at inspection time, **not fully validated StoryViewV1 fixtures**: the latest edition's Story and canonical manifest arrays were empty. Even though these thesis versions predate the edition, temporal ordering is insufficient to prove an edition-specific Story join. Do not splice latest mutable thesis state into immutable history.

## Browser and projection acceptance baselines

- Public Bluebelly homepage: live at `https://bluebelly-desk.vercel.app/`, edition `fcea17ef-f575-4283-a363-7d5fa9c918c7`.
- A public article for the AI capex Story *does* resolve with an exact frozen ID pair:
  `https://bluebelly-desk.vercel.app/stories/article%3Afcea17ef-f575-4283-a363-7d5fa9c918c7%3A6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e?edition=fcea17ef-f575-4283-a363-7d5fa9c918c7`
- Changing only the query to `edition=00000000-0000-4000-8000-000000000000` returns **404**, not the current Story.
- A valid rendered AI Story page exposes at least one issuer-sourced observation, but an issuer statistic is **not itself proof** of AI backlog cash conversion or a contemporaneous traded-market response.
- All six live homepage cards display `Market development awaiting verified headline` despite their decks being question-form research hypotheses. Do not rewrite those into asserted facts without a verified declarative market observation.
- The homepage feature currently leads with a primary-source factual TSMC observation, explicitly labelled **FACT ONLY · NOT A STORY VERDICT**. This is correctly distinct from canonical System 2 Story authority.
- Public homepage links to `/markets`, `/articles`, `/dossier` (and header more private paths). Those destinations yield 404 on the public hostname and need a scoped public-nav fix as the surface expands.
- The current owner `/api/market-intelligence-snapshot` output reported a Dossier status of degraded-latest and points to latest Dossier `cf977394-ca7c-49da-93cc-4f3da98d873b`; it is **not** an edition-bound source for the earlier brief.

## Component/caller mapping (initial, not complete dependency graph)

| V6 behaviour | Existing reader / authority | P0 state / risk |
| --- | --- | --- |
| Public lead and Story cards | `app/blue-desk/page.tsx` → `getLiveDeskHomepageDailyBrief` → `projectMarketBriefArticles` → `loadEditorialMarketBrief` | Live; fallback titles and incomplete Story manifest remain |
| Exact published article | `app/blue-desk/stories/[articleId]/page.tsx` → `getHybridExactDailyBriefEdition` | Valid current ID works, mismatched ID 404; archived >24 browser test pending |
| Latest-24 Presenter selection | `getHybridPresenterEditionCandidates` → `app/hybrid-output/prepare/page.tsx` | Existing bounded UI reader; NOT general archive authority |
| Calendar | `app/blue-desk/page.tsx` → `getEconomicCalendar`, `getForwardEarningsEvents`, `buildPresenterCalendar` | Live; degradation shown |
| Rates context | `getMarketMonitor` (same homepage) | Live; source timestamps displayed |
| Verified factual Motion | `getCurrentMarketMotion` → `selectVerifiedNewsBriefs` | Independent news path, NOT canonical evidence/adjudication |
| Owner Presenter technicals | `/api/presenter/technical-checks`, `PresenterTechnicalChecks`, `presenterDossierEditionContextFromPayload` | Owner-only; private view remains old shell |
| Hybrid / Dossier | Existing `/api/hybrid-feed-v2`, `/api/dossier-v2` and `lib/edition-replay` | Preserve contracts and immutable publications; API classification outstanding |

**Preserve without deletion:** `app/api/**`, `middleware.ts`, Supabase migrations and publication archives, Dossier/System 2, `story_thesis_versions` canonical writer, provider ingestion, research/machine cron paths and existing shared Live/Hybrid components until caller-safe parity and rollback are demonstrated.

## V6 behavioural parity work still needed

| Component / user action | Next acceptance requirement |
| --- | --- |
| Story selector and feature | Real Story identity and verified headline, source/edition vintage |
| Mechanism steps | Exact evidence-backed edges, confirmation/invalidation; no inferred attribution |
| Motion compact/expanded | Motion shown as context; no hidden promotion into Story change |
| Market impacts, charts, rates rail | Observation value, unit, measurement window and original source, or explicit unavailable |
| Evidence explorer | Exact claim → UUID → original URL; as-of and source licence gates |
| Watch tests, countercase, company panels | Frozen claims only; no unsupported fill |
| Calendar and keyboard/mobile navigation | Complete public navigation, focus and responsive parity |
| Private Presenter / technical reconciliation | Allowlist-based owner access; exact edition/Dossier identity and versioned checklist |

## P0 stop/go and proposed next coding PR

**Verdict: P0 PARTIAL / HOLD**, because exact Story-to-edition and claim-to-original-source fixtures for all three cases are not yet validated, and P−1 anonymous API scope is unclassified.

1. Complete P−1 HTTP auth matrix and public/private JSON field classification; preserve machine service contracts.
2. Make a *separate* narrow **public navigation parity PR** after routes are approved, so the public header no longer points to 404s. Tests must assert every visible nav link is resolvable or intentionally absent.
3. Validate older-than-24 Story replay against `ce3b4df7-298e-4281-853a-14ce7853a1e7` without falling back. Continue content-source contract tests before any V6 Story-tab component.
4. Proposed P1a coding title: `test(blue-desk): pin AI, rates and oil edition/claim lineage before StoryViewV1`. Limit files to fixtures, reader tests and existing source joins; **no new reasoning engine, auth toggle or wholesale frontend cutover**.

No schema, data, authentication, production deployment or scheduler changes were made by this report.
