# Bluebelly Branch 05 — private Studio audit and Master Control handoff
**As of:** 2026-10-27 MYT · **Target:** `00 — Bluebelly Master Control & Rollout` · **Repo:** `clydigital/alchemy-live-market-desk`
**Production baseline observed:** Vercel READY at `67a9599c73d9abc6b2214b1fe1c925d53b0babc4`; merged owner access PR [#1053](https://github.com/clydigital/alchemy-live-market-desk/pull/1053).
**Branch 05 draft implementation:** [PR #1064](https://github.com/clydigital/alchemy-live-market-desk/pull/1064), from the observed main baseline. **No merge or production deployment by Branch 05.**

## 1. Exact Bluebelly private route inventory
| Bluebelly hostname path | Source of function | 27 October conclusion |
|---|---|---|
| `/login`, `/auth/google`, `/auth/callback` | Existing Supabase OAuth and allowlist | Implemented; real approved-owner sign-in and callback allowlist NOT exercised |
| `/my-reports` | `OwnerAutomaticReportReader`, `OwnerEditorialSlatePdfReader`, `OwnerPrivatePdfInputHealth` | Implemented owner-only library; automated morning/evening and slate PDFs are different report families, not publication proof |
| `/owner/presenter` | `EditorialWorkbench mode="presenter"`, `PresenterTechnicalChecks` | Implemented private page; run-of-show notes + technical checklist; 14-key accessibility defect fixed in draft PR #1064 |
| `/owner/editorial` | `EditorialWorkbench mode="editorial"`, saved `getLatestEditorialSlate`, observed-price cards | Implemented writing page; OB/COTD prompts, investigation, generate/revise via existing owner API; final owner acceptance pending |
| `/api/presenter/technical-checks` | Existing `technical-checks/3` GET/PUT per-user cloud revision | Implemented; auth + allowlist + revision guard present; owner persistence readback not exercised |
| `/api/owner/editorial-generate`, `/api/owner/editorial-investigate` | Existing per-request owner-authenticated model tools | Implemented; bounded private drafts, not canonical publication |
| `/editorial-lab` | Existing synthetic no-login lab | PUBLIC DEMO, not private Studio or real source verification |
| `/owner/research` | Open [PR #1041](https://github.com/clydigital/alchemy-live-market-desk/pull/1041) | Not in merged Bluebelly owner allowlist; do not call delivered |
| `/blue-desk/presenter` and `/blue-desk/presenter/full-prep` | Open [PR #1011](https://github.com/clydigital/alchemy-live-market-desk/pull/1011) | Unmerged alternative route plan; requires reconciliation with merged `/owner/presenter` and current host allowlist |
| `/hybrid-output/prepare?edition=...` | Existing exact-edition Presenter Prep legacy reader | Exists on legacy/private infrastructure, BLOCKED on Bluebelly hostname; migration, not a new destination |
| Creator Intelligence / Creator Summary | Proposed editorial spec, pending [PR #1059](https://github.com/clydigital/alchemy-live-market-desk/pull/1059) | No working owner view/route established in current production |
| Private historical notes/reports | Browser-local notes, read-only archived edition contracts | Only partly available; do not claim complete historical Studio |

Other owner operations, unapproved `/owner/**`, unapproved `/api/**`, cron and machine endpoints must remain inaccessible at the Bluebelly hostname.

## 2. Working journey versus outstanding gaps
| Priority | Requirement | Confirmed repository capability | Gap / acceptance |
|---|---|---|---|
| P0 | All 14 technical checks visible | `technical-checks/3`: seven core + seven additional, cloud-save revision, original-link input | Existing Bluebelly Presenter used `compact` and hid extra seven. PR #1064 renders full interface; verify owner preview |
| P0 | Owner auth boundary | PR #1053 exact host/path allowlist, middleware claims + active allowlist, per-handler `auth.getUser()` | Real owner, denied user, expired session and OAuth redirect acceptance remain Branch 01 gates |
| P0 | Writing Studio | Three-idea saved slate, editable OB/COTD, investigation and generation, 1/3/5 completed-session price context | Draft state is browser-local (`localStorage`), not durable cross-device My Reports; full owner generation/restore acceptance pending |
| P1 | Technical × Fundamentals | Presenter stores `observedOn`, `updatedAt`, `alignment`, manual `evidenceUrl`, technical and talk notes | **No verified Dossier-to-14-monitor reconciliation adapter in the merged private page.** Manual URL/alignment does not prove canonical agreement. Need latest verified Dossier/Story IDs, conflicting evidence, confirm/invalidate and talk output |
| P1 | Today's Talk | Five-beat `RUN` rundown and manually editable notes; saved slate ideas | No guaranteed source-grounded, priority-ranked automatic talking points by Story/Regime change in the private page |
| P1 | Exact historical editions | `presenter-prep-source-projection`, pinned edition + exact frozen Dossier logic in legacy implementation | Bluebelly native history flow not merged; must fail closed on bad/old ID; PR #1011 conflicts architecturally with existing owner route and needs Master Control arbitration |
| P1 | Research Library & Q&A | Existing private research/evidence readers plus proposed PR #1041 | Searchable owner source-first research UI still an unmerged PR; no evidence of end-to-end investigation persistence |
| P2 | Creator Story / Video Sources / Thesis Changes | Attached editorial contract, one creator at a time, transcript and independent-verification segregation | Read-model and navigation not implemented on current merged Bluebelly; depends on Branch 02 transcript ingestion and Branch 03 narrative records |
| P2 | My Reports / PDF variants | Private library with automatic report + slate PDF and source input health | Owner acceptance and PDF input quality gate outstanding. Presenter/Regime bespoke PDFs explicitly not implemented |
| P2 | Navigation and expanded view | My Desk and owner workspace crosslinks via #1053 | Do not introduce duplicate destinations or public routes from unmerged older PRs |

## 3. Technical reconciliation acceptance contract (next independent slice)
For each of the existing **exact fourteen** keys, return:
- **Technical observation:** owner's latest saved `technical`, `lastBreak`, `observedOn` (date of chart), `updatedAt` (save timestamp), cloud revision and freshness. Empty defaults are **not** market measurements.
- **Canonical fundamentals:** selected current **or exact immutable historical** Dossier/Story version, evidence UUID/source link, measurement period and as-of. No fuzzy citation or later-history retrojection.
- **Comparison:** `AGREEMENT`, `DISAGREEMENT` or `UNAVAILABLE` derived ONLY if both datasets support a meaningful comparison. Separate the owner's self-selected `alignment` field from derived verification.
- **Presenter speech:** plain-English chart observation, supporting or conflicting market mechanism, conditional confirmation, invalidation and what to check next.
- **Boundaries:** read-only join; no Regime/Story mutation, no new evidence writer, no new scheduler or research engine; never silently upgrade an owner note to canonical evidence.
- **Tests:** stale/missing timestamp, missing Dossier, contradictory source, mismatched edition ID, old-vintage evidence, 14-key parity, anonymous+unauthorised access, saved checklist GET/PUT/reload.

Reuse `lib/presenter-prep-source-projection.ts`, exact-Dossier selection readers and the existing checklist; inspect actual type/data shape before committing a second PR.

## 4. Security and deployment evidence
- **Read-only SQL metadata:** `presenter_technical_checklists` and `app_access_allowlist` have RLS enabled; `anon` lacks SELECT; `authenticated` has row-level SELECT with identity/active-allowlist restrictions. `blue_desk_editorial_slates` is RLS enabled with no `anon` SELECT.
- **Fresh anonymous browser:** `/owner/presenter`, `/owner/editorial`, `/my-reports` gated to login; `/api/presenter/technical-checks` returned `Authentication required`. No sampled private data rendered anonymously.
- **Vercel exact path read:** `/owner/live` on Bluebelly returned 404 with `private, no-store`. Owner pages returned the login HTML in an unauthenticated request.
- **Not established:** approved-owner OAuth completion, non-allowlisted signed-in account, expired-session handling, per-handler write and cross-device persistence, production authenticated screenshots.
- **CI:** PR #1064 must pass full GitHub `validate`, `database-contracts`, and browser review before merge. The branch alone does not prove runtime.

## 5. Master Control dependencies and decisions
1. **Branch 01:** Verify real owner OAuth callback redirect configuration and full owner/denied/expired access matrix. Own merges/security and choose **one** route namespace; review open PR #1011 for duplicate Presenter paths and its shared host/middleware/header changes.
2. **Branch 02:** Supply authenticated read-only creator transcript/version contract and source-linked research index rather than a second ingestion path.
3. **Branch 03:** Continue client-facing OB/COTD and story-led generation; agree durable draft/publication contract; do not let a saved browser draft masquerade as My Reports or a verified article.
4. **Branch 04:** Maintain public home, Key Stories, Markets, Calendar and navigation; preserve owner isolation. No independent public route work by Branch 05.
5. **Branch 05:** After #1064 and owner proof, implement the read-only evidence reconciliation first, then a source-ranked Today's Talk, and only then integrate historical Prep/Research/Creator into the existing owner experience.

**Handoff rule:** do not merge or deploy #1064 from Branch 05. Review it in 00 alongside #1053, #1011, #1041, #1059 and #1060. Keep legacy backend/archive/history and exact edition identities until native Bluebelly parity is proven.
