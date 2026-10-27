# Bluebelly: Converged Newsroom, Regime Watches and Single Daily Brief

**Decision:** 28 October 2026. **Status:** P1 private read-model prototype added on this branch; adapter/UI not yet wired. Does not deploy.

## Product priority

Bluebelly should be a **living market desk**, not a daily stack of PDFs, HTML reports and creator essays. The reader wants the most important *new event or attributable rumour* immediately, a short explanation of what is at stake, and a clear route into an ongoing regime thesis only when relevant. A story can be interesting without being regime-relevant; the existing five-task research stack should supply **one** selective evening Daily Market Report rather than multiple repetitive editions.

Keep Bluebelly as the only new user-facing destination. The September Live/Hybrid Dossier reset is historical context; the newer Bluebelly-only routing and Dossier-light source-verified read contracts govern this work. Retain immutable canonical Story and Regime versions and legacy API/history until independently audited; no new reasoning engine or scheduler.

## Core experiences

| Surface | Reader need | Data contract |
|---|---|---|
| **Today** | What is happening now? | Top verified original-source developments, real publication/event/observation clocks, newest important corrections, observed market tape where independently available. Developing rumours belong in **owner-only** research triage, not the source-verified public feed. |
| **Newsroom** | Show me my market topic | AI/Tech; US Rates/Bonds/Central Banks; Oil/Geopolitics; Equities/Earnings; Other/Emerging. An event may be tagged into several categories with the **same** identity. Original link never lost. |
| **Regimes** | What changed in the big picture? | Persistent AI bubble, US rates/Treasury/funding, energy/inflation and risk-market watches; previous versus current *verified* state, supportive/contradictory evidence, pending challenger, next decisive test, exact vintage. |
| **Daily Brief** | What is worth reading today? | One source-backed private 1,500–2,000-word synthesis on material days, 3–5 genuinely distinct developments, pitch → numbers → catch → alternative → next test, linked back to event IDs and regime state. |
| **Manual research** | Go deeper on a thesis | Creator deep dives, three-angle commissioning packs and 3,000–4,000-word special reports available by request, not automatic daily output. |

Existing 09:00 OB/COTD slate remains internal, **exactly three ideas**, with source readback. Creator transcript collection continues at 07:00 but *routine creator HTML writing* is disabled. Normal MacroPulse and Research Gap keep their schedule and Notion publications. The AI 16-company hub continues as a narrow fundamentals/financing surveillance tracker. The current five scheduled automation instructions have been changed accordingly; this PR changes no schedules.

## Actual existing data — no parallel data structures

- `research_intake_items`: original and reported news, transcript caches, source/impact scores and transcript Motion candidate leads.
- `x_wire_posts`: attributed X leads, most not originally verified. Use **owner only**.
- `market_motion_items`: may contain creator commentary; a numerical materiality score is **not** verified truth or a measured market reaction.
- `market_regime_current`, `market_regime_versions`, `market_regime_story_links`, existing immutable Story thesis snapshots: already persist the canonical regime side.
- `lib/market-brief-news.ts`: existing verified `NewsBriefV1` public contract (48h).
- `lib/blue-desk-newsroom-lenses.ts` and `NewsroomLensExplorer`: merged read-only lens UI; reuse rather than creating three new newsrooms.
- Existing Notion AI parent hub and existing Research Gap/Registry should surface regime deltas. Do not create a second AI-financing tracker or a sixth bond-watch automation.

The source record counts from 28 Oct inspection (e.g. 99 X posts, 272 ready transcripts, 5 regime-current rows) are **not proof** that Bluebelly's pages currently join these sources or that a provider is current.

## Two independent judgements per event

1. **Attention priority**: BREAKING / HIGH / WATCH / ARCHIVE. Score uses upstream materiality, urgency, genuine news age, source status and novelty; it is an *editorial sort*, **not** a regime confidence, truth score or price prediction. A significant attributed rumour may be high-interest but remains explicitly unverified.
2. **Potential regime influence**: possible route hint and a separate sourced analyst candidate SUPPORT / CHALLENGE / NEUTRAL / TO_VERIFY, with what original evidence could adjudicate it. Topic matching alone never changes a canonical Regime or Story. Some news remains `OTHER` with no regime.

At minimum retain: source record ID, externally reconciled event identity, original URL, publisher/handle/video, published_at, event/observed/verified times where available, correction status, affected tickers/themes and verification outcome. Do not falsely infer that two textually similar sources describe the same event. A corrected or denied item must preserve history and update its displayed state rather than being silently forgotten.

## P1 — Contract added in this PR

`lib/bluebelly-converged-newswire.ts` contains a **pure private** `ResearchLead → RankedEvent` attention/topic/regime-hint projection. `tests/bluebelly-converged-newswire.test.ts` tests breaking ranking, original URL, unattributed/unverified safety, X rumour owner-only behaviour, transcript-only challenger, genuine unrelated OTHER, explicit-event deduplication, time expiry, secure URLs and no manufactured price reaction or canonical mutation. This is NOT connected to public pages yet, and the public admission gate remains `NewsBriefV1`.

## P2 — Source adapter and authentication (next work)

Implement a bounded **owner-authenticated** read-only adapter over existing original-source news, research intake, X Wire, transcript candidates and verification receipts. Carry actual original records and content age. Reuse `NewsBriefV1` for all public factual output; owner source interpretation must never leak to public hostname, anonymous path or cached server response. No new database or write path. Test real original/creator/X provider samples and data-unavailable statuses.

## P3 — UI and genuine urgency (next work)

Extend the merged Newsroom reader on an existing Bluebelly page with newest verified headlines and source-clock sorting; give owner viewers separate Developing / Verified / By Topic / Other facets. One event identity may span multiple topic tabs, while source status stays visible. Put the top 1–3 urgent developments on Today, not a fixed featured article from an older date. Display as-of, publisher, event and last-checked age. Test public/owner permissions, 320/390px and desktop, accessible keyboard controls, and the precise original URL.

**Important:** Two-hour MacroPulse polling is NOT real-time breaking news. Audit existing official-press retrieval and cache before claiming “LIVE”. Later use permitted original-publisher feeds, guarded bounded server caching or manual refresh *within existing ownership*, no new cron or paid API; show actual check age on every developing item.

## P4 — Regime overlays (next work)

- **AI bubble**: capex-to-revenue/FCF conversion, financing terms, credit and semis, hyperscaler issuer results. Read the existing Notion 16-company hub; date every financial metric and carry prior verification.
- **US rates/bonds**: Fed path; US 2Y/5Y/10Y/20Y/30Y; curve and real yields; auctions/refunding and term premium only if independently estimated; repo, credit/refinancing and cross-asset effects. Maintain a rolling *Bonds/Rates watch delta* in the existing Notion Research Gap/Registry **and the dedicated private, internal [US Rates & Bonds — Regime Watch](https://app.notion.com/p/406519b67a94812fbd88f6f975ab3396)** beneath the existing Financial Research hub. This page is initialised as EVIDENCE REFRESH PENDING, not live/canonical; existing Research Gap automation now points to the exact page. No sixth task.
- **Oil/inflation, cross-asset**: related current observed evidence, countercases and next test. X/transcripts can propose a challenger, never prove it.

Show `NO MATERIAL CHANGE`, `PENDING VERIFICATION`, `STALE` or `CHANGED WITH CANONICAL RECEIPT` explicitly. Do not conflate source collection with canonical evidence acceptance.

## P5 — One useful Daily Brief (next work)

Use the existing authenticated editorial writer and Research Gap verified packets to build one 1,500–2,000 word selective daily owner edition. For each important story: what happened, what had been priced/expected (if measurable), actual economics and stakes, opposing explanation, observed market reaction *or UNKNOWN*, and conditional future test. Explain why the event did or did not affect a tracked Regime. Register HTML in private Drive/My Desk only with actual upload MIME/folder/private permission and independent registry readback. Do not call manual example HTML a successful scheduled pipeline.

## Acceptance before release

Prove one real source-verified news item, one high-attention X rumour **isolated owner-only**, one transcript lead with original video evidence, one genuinely novel Other event, one correction, an AI regime candidate that does not mutate state, a changing/unchanged bond tracker and an evening brief that does not replicate the whole Newsroom. Preserve exact source clocks, stale/unavailable markers, links and deduplication across sections. Run unit, typecheck, full build, authenticated/public host and actual ingestion checks. Until those gates pass, P1 is a **prototype**, not delivered frontend functionality.
