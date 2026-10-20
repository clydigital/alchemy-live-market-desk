# Blue Desk P−1 / P1b acceptance sweep — 20 October 2026

**Decision:** **STOP P2 public V6 Story cutover** pending confirmed P−1 private/public and machine access acceptance. Existing Bluebelly and historical Story remain live. P1b partially passes: AI issuer facts are sourced, but there is no recent independently source-verified News Brief. Do not manufacture a report or call an unresolved AI interpretation an accepted Story.

## Verified runtime and immutable baseline

- Live production before this News Brief patch: latest READY commit `63d49df84c9b2520f7ccb433a5b9d1bbc7d62665` from #856, with Bluebelly homepage and current AI immutable Story reachable; private Bluebelly Presenter Prep 404; private Live Dossier login-required. `#859` is a separate candidate and must have CI and production READY validation.
- P1a immutable edition `fcea17ef-f575-4283-a363-7d5fa9c918c7`, published `2026-10-19T16:19:19.317Z`; AI Story `6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e`. Exact archive links do not fall back to current.
- Six frozen Dossier lessons have respectively **8/8, 6/6, 3/3, 2/2, 7/7 and 3/3** evidence UUIDs resolved and dated before this edition. **Primary source with direct URL** counts by lesson: **4, 0, 1, 0, 1, 1**. Rates (post-CPI yield reversal) and crude backwardation therefore cannot yet be rendered as complete primary-supported causal Stories; absence is a real source gap.
- AI issuer source records: TSMC Q3 2026 operating margin **58.7%** and revenue **US$46.72 billion**, <https://pr.tsmc.com/english/news/3346>; CoreWeave Q2 2026 cash PP&E **US$6.422 billion** and operating cash flow **US$0.679 billion**, <https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx>. These are exact edition-admitted claims, not independent proof of supplier demand or funding causality.
- The edition's Dossier UUID is absent and AI interpretation is `UNRESOLVED`. Therefore no canonical `TOP STORY` label is justified. #855 provides a correctly labelled `PRIMARY-SOURCE OBSERVATION` fallback only.

## P1b independent factual News Brief — issue reproduced, fix in #859

- The current Motion view has **64** non-expired records; **1** is `VERIFIED` and ranks **59** by occurrence. The homepage previously requested only the first **24**, hence saw zero verified items.
- The surviving verified item is **September CPI**, original occurrence `2026-10-14T12:00:00Z`, observed on 19 October, with expiry extended into 21 October. Its official source is <https://www.bls.gov/news.release/archives/cpi_10142026.htm>. Later observation is not a newer economic release.
- #859 adds a separate server-only, bounded (`limit<=24`) verified Motion reader; NewsBrief/1 requires occurrence within the last 48 hours and deduplicates multiple versions of the same original report. The existing main Motion list and publication/Story reasoning contracts remain unchanged.
- **Expected result today:** zero independently eligible fresh News Briefs. This is a correct `unavailable` state, not a publication failure. The release acceptance requires a genuinely recent independent verified item before calling P1b complete.

## P−1 access checks

| Boundary | Evidence | Verdict |
|---|---|---|
| Public home, pinned AI Story | Live anonymous response and issuer citation links | PASS |
| Public Bluebelly /hybrid-output/prepare | 404 | PASS |
| Private Live /dossier without session | Redirect to /login, functional Google sign-in link | PASS (negative only) |
| Protected research queue without machine token | 401 | PASS (negative only) |
| Authenticated owner raw publication/Story RLS | Synthetic allowlisted JWT sees 1,257 snapshots, 257 Story events and 210 thesis versions; synthetic unallowlisted sees 0 | PASS (role policy only) |
| Real approved Google OAuth, unauthorised account, expired session | Browser reached /login with Google link; no completed approved login | **NOT VERIFIED** |
| Positive machine/cron request with existing bearer | A 20 Oct morning research run was observed as running and updating; no authenticated HTTP request/response proof | **NOT VERIFIED** |
| Raw archive, Story ledger, Motion, private research views and privileged RPC grants | Separate production RLS/permission queries and Supabase advisor checks passed (#835, #842, #845, #852, #854) | PASS scoped |
| `supabase_admin` future default table, sequence and function grants | Remain broad; `postgres` not privileged to revoke another owner's defaults | **BLOCKED** — #849 |
| Public `GET /api/market-intelligence-snapshot` and `/api/dossier-v2` | Current public API contracts include Dossier, Regime, Stories, Watch, Research Gaps, Creator Verification, source pointers; Hybrid Journey fetches `/api/dossier-v2`, Live mobile uses market snapshot. Not field-classified as approved public vs owner-only. | **NOT APPROVED** — #834 |

Do not revoke legacy Hybrid read APIs, change Google/OAuth settings, invoke privileged Supabase-admin operations, or fake positive machine verification. CORS is not authentication.

## Proposed public read-field classification (not authorisation to publish)

- **Candidate public, requires source/licensing approval:** immutable edition ID, publication timestamp, redacted Story headline, individual reported measurements, direct licensed citations, calendar events, public price/yield monitor, explicit `UNRESOLVED` status.
- **Owner-only until reviewed:** internal research gaps and decision queues, source/creator verification packets, operational diagnostics/guardrails, unrestricted Dossier payload, private technical interpretations, history of raw thesis revisions, raw citation provenance metadata.
- **Needs per-field audit:** `market-intelligence-snapshot/v1` exposes `dossier`, `regime`, `dollarLiquidity`, `policyLiquidityInteraction`, `monetarySignals`, `marketState`, `stories`, `investigations`, `stockRadar`, `creatorVerification`, `marketMotion`, `sourceHealth`, `contradictions`, `researchGaps`, `guardrails`. The current DTO is already designed for third-party callers; classification must consider its nested fields, real consumers and licensing, not merely the 200 status.

## P2 StoryViewV1 first slice — HOLD until security GO

Permitted evidence-grounded fixtures for a bounded read-only design contract (not permission to ship V6 UI):

1. **AI:** pinned Story/edition as above; reported TSMC/CoreWeave facts (4 directly cited primary claims). Two or more original issuer URLs; inferred causal links explicitly unavailable or labelled. No `SUPPORTED` thesis, no observed price-reaction claim without timed price evidence.
2. **Rates:** the CPI/yield reversal lesson (6 canonical refs, zero first-tier direct URLs) is usable as an **unresolved question**, not a proven observed market-reaction panel.
3. **Oil:** prompt crude backwardation lesson (2 canonical refs, zero first-tier direct URLs) is a **research question**, not a proven physical-tightness mechanism.

Build `StoryViewV1` on canonical read-only inputs using `editionId`, `storyId`, `dossierId|null`, `interpretationStatus`, evidence claim IDs, claim-level source URLs, measurement period, `causalLinks[]` (with supported/inferred state), missing market reaction, confirmation/invalidation tests, `asOf` and explicit `unavailableReason`. V6 mockup's sample measurements and technical readings are **not** live evidence. No new database reasoning table, writing path, engine or public exposure of private technical overlays.

## Remaining action order

1. Verify positive owner Google login and denied unapproved/expired sessions with authorised test accounts; verify genuine machine token request and non-login response without exposing key.
2. Field-classify and license-check `/api/dossier-v2`, `/api/market-intelligence-snapshot`, and remaining Live/Hybrid read consumers; implement sanctioned public DTO before denying legacy direct APIs.
3. Resolve or document compensating security controls for `supabase_admin` defaults (#849).
4. Wait for **genuinely new verified market news** and assert NewsBrief/1 runtime provenance; do not republish six-day-old CPI as today's report.
5. Then begin P2 AI Story vertical slice, using the exact IDs and honest missing-data fixtures above; keep existing public site online until V6 parity.

**Source authority:** live Supabase read-only database queries, connected GitHub repository and PRs, existing Vercel production deployment and Bluebelly/Live anonymous runtime probes on 20 October 2026; supplied revised execution plan and V6 mockup design notes. This is an acceptance report, not confirmation of full release readiness.
