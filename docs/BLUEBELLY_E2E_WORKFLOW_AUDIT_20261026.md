# Bluebelly release-readiness and research-workflow audit — 26 October 2026 MYT

**Scope:** draft PR #1030, isolated public visual QA preview and connected production Supabase. **No merger or production app deployment was authorised or performed for this audit.** Scope is an evidence-based release audit, not a new reasoning engine or scheduler.

## Verified outcomes

| Layer | Evidence | Assessment |
| --- | --- | --- |
| Vercel deployed preview | `dpl_GdxAfRCEgDrKWagqShAeHvn5MqN7` READY, isolated `preview/bluebelly-pr1030-db-ready-20261025`; exact public QA alias `alchemy-live-market-desk-git-preview-blue-08219b-rogue-magazine.vercel.app` | PASS: deployment |
| Public routing | Actual HTTP 200 and Bluebelly HTML title for `/`, `/daily-report`, `/markets`, `/key-stories`, `/reports`, `/calendar`; no Live Desk login | PASS: routing/render |
| Public/private host boundary | Public QA alias `/owner/daily-report` and `/api/owner/daily-research` returned 404; separate deployment host `/owner/daily-report` rendered approved-account sign-in | PASS: unauthenticated denial; owner sign-in session NOT tested |
| Supabase | Project `qdtlrfgxpsnxajiptrno` active; publication CHECK accepts `COTD, OB, DAILY_REPORT`; RLS on; public INSERT/UPDATE not granted; private `editorial-pdfs` bucket exists | PASS: additive schema and privilege readback |
| Editorial publications | SQL count in `editorial_publications`: **0** | NOT TESTED: full publish/read/PDF flow |
| Live source motion | `current_market_motion_items` sampled: **0 active VERIFIED**; 3 VERIFIED entries expired; 51 current LEAD entries (not verified). Latest verified event 21 Oct | BLOCKED BY DATA: do not display LEAD as confirmed news |
| Notion in Vercel | Project env list contains GEMINI/Supabase, but no `NOTION_API_TOKEN` or `NOTION_MARKET_RESEARCH_TOKEN` | NOT CONFIGURED: cannot claim real automatic research ingestion |
| Notion records through connected workspace | 25 Oct MacroPulse archive with full 20:00 and 22:00 child posts; PM Gap Gate `Run` title property, `Status/Coverage/Input Health=PARTIAL`; 35 eligible, 8 reviewed, 27 overflow | VERIFIED SOURCE STRUCTURE, NOT app runtime ingestion |
| Owner model | `GEMINI_API_KEY` present in preview but no owner-authorised generate-and-revise run exercised | UNVERIFIED |
| UI | Browser navigation/accessibility tree opened; screenshot/mobile visual QA unavailable | PARTIAL |

No upstream Notion/creator/plugin source automatically becomes canonical evidence. Dossier and immutable thesis-version write ownership is unchanged.

## Confirmed code defect and draft-branch repair

- **Notion Research Gap title discovery:** previous `selectNotionResearchPages` tried only `properties.title` or `properties.Name`; the actual data source uses `Run` (type=`title`). Fixed in PR to select typed title properties, with regression test.
- **Gap PARTIAL status:** previous parser looked for textual markers only; real Gate uses `Status`, `Coverage` and `Input Health` select properties. Fixed to read page properties explicitly; preserve unread-overflow warning.
- **MYT rollover:** before first full Pulse/Gate of a new day, today's-only search returned empty despite prior evening's valid full posts. Added bounded previous-MYT-day fallback with clear previous-date/partial warning, regression-tested against mocked Notion API.
- **Limit:** these tests simulate the official API; real server retrieval cannot pass until a read-only Notion integration is shared and token configured. They are not proof of live ingestion.

## P0 — required before declaring replacement

1. **Source-qualified factual publishing separate from canonical Motion:** current frontend reads only active `VERIFIED` market Motion. All recent Motions are LEAD, including creator hypotheses. Build/reuse one bounded original-source verification handoff from Notion Pulse posts into the **existing** eligible factual News projection (source ID and URL, source kind, event/release/observation/retrieval clocks, exchange/region, status). Keep LEAD/creator items private as research leads. Do not lower `selectVerifiedNewsBriefs` to accept LEAD to cosmetically fill the page. No new System 2 adjudication or scheduled task.
2. **Real Notion authorisation:** create a dedicated read-only Notion integration, share the precise MacroPulse root and Research Gap Runs data source, set `NOTION_API_TOKEN` as server-only Preview/Production Vercel env var (never `NEXT_PUBLIC`), then on approved owner host test latest full Pulse posts and PM/AM Gate, accurate source URLs, PARTIAL 27-unread warning, overnight fallback, and no canonical mutation. The ChatGPT Notion plugin login is not a Vercel runtime token.
3. **Owner end-to-end test:** complete Google OAuth callback on the private preview deployment (including approved callback URL); verify approved account route works; anonymous/unauthorised denied; load Notion/market packet; generate and revise with Gemini; preserve draft after errors.
4. **Publication dry run in isolated environment:** use controlled fixture original source + correctly formed PDF, explicit approval, write to non-production Supabase/bucket or transactional equivalent; confirm immutable row, public HTML and fixed PDF, source links and metadata, denied public writes, idempotency/error cleanup. Do NOT create dummy client publications in production merely to test.
5. **Workflow handoff UX:** Daily Writer copies up to **40** source URL candidates; Publication validator accepts **1–12**. This makes the current writer → publisher handoff fail for comprehensive packets and can prefill unreviewed Notion links as purported originals. Require editor-curated original-source selections (max 12), show provenance/verification per item, and prevent silent truncation; report headline/meta/section completeness; save unfinished owner draft (client local draft or suitable existing workspace, not canonical Story).
6. **Calendar/market freshness:** always show source timestamp/session/unit and distinguish official issuer-confirmed earnings, provider-reported dates and unknown event times. No false current price or event-time reaction.
7. **Mobile/visual:** capture real 360/768/1440 screenshot/accessibility/keyboard states for all six public routes and private writer/publisher, including authenticated mobile. Current checks proved server render, not responsive layout.

## P1 — product architecture, without inventing a second reasoning engine

- **News (fast):** source-linked, dated observations and actual matched market reaction where measured. One primary region Asia/Europe/US/Other plus affected-region tags, no duplicated records.
- **Motion (context):** source/novelty/reaction/provisional source status, verification confidence, expectation-before-actual, one next test. Creator/video leads remain marked *views to verify*.
- **Persistent Story (slow):** long-lived question, evidence supporting and challenging it, contradictory older developments, causal mechanism, technical/catalyst implications, recent version date and falsifier. The current 48-hour regex topic buckets are **not** substitutes. Reuse actual Story identities when canonical; otherwise clearly display non-canonical research theme.
- **Regime (market mindset):** what markets currently reward/ignore, expectations versus tape, signal that would change behaviour. Only existing Dossier System 2 may amend canonical interpretation after admitted original Evidence. Reading the current Regime requires exact identity/vintage.
- **Daily Report (curated):** verified top changes; measured price reaction and expectation; step-by-step cross-asset transmission; strongest contradiction; scenario conditional next trigger; dated economic/earnings agenda; Gate source coverage health. Editorial work is *manual* on analyst request, with human approval before any public release.
- **Presenter Prep (private):** technical checklist DXY/JXY, US yield curve 2/5/10/20/30Y, EURGBP and USDJPY band/timeframe tests where chart supplied; live event clock; quick script, source caveat, countercase and possible viewer questions. Do not conflate source observation with chart validation.
- **AI issuer/earnings lane:** separate announced capex vs cash PP&E, FCF/CFO, leases/finance, power/HBM/GPU constraints, payers and actual utilisation; issuer original filings and fiscal quarters before claiming the AI capex/credit Regime changed. Use the installed Alchemy Equity Research adapter only on material issuer questions.

## P2 — operating workflow: reuse existing schedules and providers

1. Existing **2-hour MacroPulse** discovers, dedupes, saves full Post + Log; feed factual candidates/links to one bounded source-verification queue (no new heartbeat or third scheduled pipeline).
2. Existing **AM/PM Research Gap Gate** investigates *material contradictions* with strongest rival and smallest deciding metric. Honor Gate PARTIAL and 27 unread overflow; do not call eight reviewed posts complete coverage or imply Dossier A2 from Gate label.
3. Bluebelly public **News** reads only newly independently verified factual receipts. No Dossier approval necessary for a source-checked news item. A Gate may enrich the analyst packet but does not automatically publish research judgements.
4. Existing canonical Evidence/Motion/Story/Regime stays owned by Dossier System 2. Bluebelly public Story displays read-only verified identity or **research hypothesis** explicitly, never writes accepted thesis.
5. Owner **Writing Brain** consumes the bounded dated packet, selectively uses Alchemy LY COTD/OB workflow and source-measurement audit on decisive claims, prepares full explanation, then Alchemy publication QC (facts → voice → figures/charts → mobile/document) before owner approval. All editorial writes remain manual.
6. **Status/health instrumentation** displayed to owner: most recent Pulse full post, Gate slot and completeness, unread backlog, number/source of verified news vs LEAD, last verified market observation, Notion auth state, last editorial approval, publication PDF health, provider staleness. Avoid extra cron; inspect on read/existing cadence.

## Specific acceptance demonstrations

- A real **26 Oct** eligible original-source fact passes verification and appears on public News/appropriate region/topic with event and observation times; an unrelated creator LEAD stays off the verified page.
- The 25 Oct PM Gate source `404519b67a948115afdbc66b8082561d` and 22:00 Pulse `404519b67a9481a38404d07a9db4a459` are readable after authorising Notion, with **27 unread** and prior-day warnings in a 26 Oct 00:xx MYT handoff.
- One approved user session generates and revises an unverified Daily Report without publishing; an unauthorised visitor cannot call any model/owner API.
- One explicitly approved test report in **isolated staging** yields immutable article, original-source refs and valid fixed PDF; no public edit, storage leaks or fake production publication.
- Public user can answer: *What changed? How did markets actually respond? Which Story did it challenge? What would prove us wrong? What comes next?* from readable mobile output, or explicitly sees which evidence is missing.
- Regression and security checks green; production and preview response snapshots reviewed before any release. **Do not merge PR #1030 while P0 unverified.**
