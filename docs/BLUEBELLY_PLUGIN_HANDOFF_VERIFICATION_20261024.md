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
