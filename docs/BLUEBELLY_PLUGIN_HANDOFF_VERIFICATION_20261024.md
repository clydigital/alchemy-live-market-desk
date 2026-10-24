# Bluebelly Plugin Handoff — Verification and Retirement Gate

Status: draft integration gate, 24 October 2026. No public cutover, extra scheduler, provider subscription, plugin authorization, or database mutation is authorised by this document.

## Principles
Bluebelly replaces the public and private Live/Hybrid *interface*. Keep Dossier V2/System 2, existing canonical Story thesis versions, source intake, Market Motion, Research Gap, MacroPulse schedules, immutable editions, API routes, provider adapters, auth, and historical replay. Third-party ChatGPT plugins are research *tools* and are not automatically server-side ingestion adapters.

## Measured integration status
| Lane | Verified now | Required next proof |
|---|---|---|
| Dossier/source | Production Supabase contains recent canonical Dossier and raw-source rows dated 23 October; homepage uses canonical publications/market monitors | Same frozen edition, canonical IDs, clocks, source receipts and absent states across API, Bluebelly, ChatGPT |
| Editorial Writing Brain | A 23 October dated editorial slate exists, marked PARTIAL; slate table RLS is enabled, anonymous and authenticated SELECT denied, service-role SELECT granted | Real task-to-row receipt and owner-page readback; next natural run |
| MacroPulse/Research Gap | Connected Notion search resolves dated 23 October MacroPulse and Research Gap Gate pages | Match original source receipts and Notion IDs to a canonical research run, not page existence alone |
| Financial data | Native FRED/FMP/SEC adapters exist and tool specialists available in ChatGPT | Production authenticated provider values, units, timestamps, licensing and canonical admission |
| Oil/Hormuz | Protected server route, cached monitor, and Bluebelly Markets component exist | Real provider response, observation vs retrieval clocks, stale state and trends |
| X Wire and creators | Private source-recovery/checkpoint modules and creator research path exist | Runtime intake receipts and independent source verification before canonical claims |
| Presenter | Original owner Studio and editorial UI shipped; native V6/V7 routes are draft PRs #997/#999 | Approved/unapproved/expired owner browser tests, no remaining visible Hybrid links |
| ChatGPT reader bridge | New owner-authenticated overview read endpoint on this branch, field-allowlisted | Remote scoped connector, fresh ChatGPT tool invocation, exact UI/API/DB parity |

## First code slice: authenticated private overview
GET /api/owner/bluebelly/v1/overview has version bluebelly-private-overview/1. It reads getDossierV2PresentationSelection and reveals only selected/latest Dossier IDs, as-of times, source selection status and fallback flag. It is owner-session authenticated with active app_access_allowlist. Public Bluebelly host returns 404, missing owner 401, disallowed user 403, unavailable Dossier 503. No wildcard CORS, no public caching, no raw Dossier, provider credentials, or new evidence writes. This is NOT an operating ChatGPT remote plugin yet.

## Sequential gates
1. Run focused and full tests, TypeScript/build, negative host checks and positive owner signed-in readback; crosscheck exact Dossier ID/as-of against production DB.
2. Reuse existing immutable Story/edition reader, define narrowly allowlisted exact current and archived Story contracts and evidence lineage, without latest fallback.
3. Configure a separate revocable OAuth/scoped read-only connector identity. Do NOT hand service-role credentials, generic production research tokens or raw DB access to ChatGPT.
4. Expose get_desk_overview, get_story, get_evidence_lineage and get_provider_health in a tested connector; add releases, issuer, research gaps and presenter context only when vetted.
5. Call the new tool from a fresh ChatGPT session. Prove schema version, exact IDs, source clocks, historical values, missing-data semantics and corresponding Bluebelly/DB readbacks.
6. Retire obsolete Live/Hybrid frontend only after public/private parity, historical URLs, 360/768/1440 QA, owner/machine auth, real ingestion observability, redirects, caller telemetry and rollback. Preserve API, data, cron, immutable editions.

## Source/change ownership
Existing Bluebelly V7 surface data contract belongs to PR #999. That branch does not implement direct third-party plugin-to-Next ingestion, and neither does this overview-only branch. Follow the consolidated issue #936 and security issue #834 rather than creating competing migration trackers. Never merge preview-only vercel.json exceptions from the V6/V7 branches.

## Second code slice — exact archived published editorial article

Draft stacked on the overview reader (#1001), without merging either branch:

- GET /api/owner/bluebelly/v1/published-story?edition=UUID&article=article:UUID:UUID
- Version: bluebelly-private-published-story/1.
- Existing exact archive lookup only: getHybridExactDailyBriefEdition -> projectMarketBriefArticles -> loadEditorialMarketBrief -> buildBlueDeskPublicStoryEvidenceV1.
- Owner auth matches the active Supabase allowlist on the private host. Public Bluebelly host blocks this API. No wildcard CORS or externally scoped bearer credential.
- Reject malformed/mismatched IDs and duplicate query params; never search Story titles or fall back to the latest 24 editions.
- Only source-linked original evidence facts admitted as of the frozen edition are returned. Retain explicit NOT_ADJUDICATED Story state, NOT_VERIFIED market reaction and causal attribution. These records are published editorial articles, **not** immutable canonical Story thesis versions.
- HTTP 404 on unknown edition or no eligible source-linked article; HTTP 503 on query failure, HTTP 401/403 for unauthorized sessions.
- This is not a remote ChatGPT plugin. Add canonical persistent Story-version lookup only after exact-id/version lineage review.

Acceptance: run full suite, database contracts, TypeScript and production build; test positive user readback against the 19 October frozen AI edition and denied owner/public cases. Production remains untouched until audited deployment approval.


## Third code slice — exact canonical Story thesis version (owner-only)

- Route: GET /api/owner/bluebelly/v1/story-version?story=UUID&version=UUID.
- Contract: bluebelly-canonical-story-version/1; this is a persistent canonical thesis version, unlike the published editorial-article reader in slice two.
- Existing read authority: public.story_thesis_versions by exact story_id and id, with bounded select and 5-second abort; no mutation and no fallback to latest version.
- Version-scoped evidence candidates: only canonical-story-reasoning/v1 claim.evidenceIds from the immutable snapshot; cap 48 unique UUIDs. The candidate references are not proof.
- Verified source facts: bounded separate join to intelligence_evidence and intelligence_evidence_sources by the exact candidate UUIDs, original first/second-tier source URL, company filing/statistic/official record evidence class, and both created_at and available_at at or before version.effective_at. Neither the reasoning claim nor its implied causal market reaction is upgraded from this join.
- Projection allowlist: immutable Story/version/event IDs, version number and as-of, authored thesis and limited triggers, raw status/confidence, source facts and explicit UNKNOWN/NOT_VERIFIED gates. It never spreads snapshot, metadata, provider tokens, model prompts, service credentials, raw payloads or arbitrary source records into the API.
- Auth: approved Supabase owner session only, private-origin route, no browser-public API and no wildcard CORS. A remote ChatGPT connector has **not** been activated. A subsequent standards-based scoped OAuth client with owner consent and revocation is preferred to issuing another generic permanent token.
- Fail closed: unknown exact version 404, malformed/multiple IDs 400, unavailable version/evidence backend 503; no latest version lookup or fabricated evidence.
- Required for merging: GitHub tests/build/DB contracts plus independent real owner-session positive and negative checks; source claims/vintage audit; private scope approval under security #834.

## Remote tool connector gate

Do not describe this Next.js route as already connected to ChatGPT. Before remote activation establish an identity issuer, registered OAuth client, narrowly scoped read access, consent, revocation/expiry and audit controls. Current Supabase documentation describes OAuth 2.1 Server and MCP-compatible dynamic registration, but enabling/configuring it in the Supabase project is a separate operator action and the active project's OAuth configuration has **not** been verified. The ChatGPT plugin manifest/tool definition must point to a deployed, stable, authenticated HTTPS endpoint and pass a real fresh-session invocation test. Never use existing CRON_SECRET, service-role or RESEARCH_UPDATE_TOKEN as a generic GPT bearer secret.
