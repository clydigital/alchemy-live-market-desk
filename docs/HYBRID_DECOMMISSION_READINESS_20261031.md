# Hybrid Vercel project — pre-deletion readiness record

Date: **31 October 2026 (MYT)**. Status: **HOLD — prepared for later deletion, but not yet safe to remove**.

This supersedes only the *readiness measurements* in the 27 October decision; its architecture, authorization gates, and immutable-history protections remain binding. See [full retirement decision](./BLUEBELLY_HYBRID_FULL_RETIREMENT_DECISION_20261027.md) and [parallel-safe retirement plan](./BLUEBELLY_PARALLEL_SAFE_RETIREMENT_P0_20261027.md).

## Exact target — and explicit exclusions

- Retirement target: **Vercel project** `prj_RZCeWS8eXJODPLmTeljRquGIDpu3` (`alchemy-hybrid-market-desk`) and, later, archival of `clydigital/alchemy-hybrid-market-desk`.
- **Never delete** the Live backend Vercel project `prj_mHZ3Tosmi2iHCFthG4Eok8BLnWlq`: it runs Bluebelly plus canonical research, authentication, publishing and source ingestion.
- **Never delete** production Supabase project `qdtlrfgxpsnxajiptrno`, its original evidence, Dossier, Story versions, 1,392 `hybrid_publication_snapshots`, publication archives or private owner checklist.
- Do not remove `/api/hybrid-feed`, `/api/hybrid-feed-v2`, `/api/intelligence-feed`, `/api/internal/canonical-feed`, `/api/internal/legacy-evidence`, old SSO callbacks or their secrets until real consumers and auth modes are independently checked.
- **User direction: cron untouched for now.** No Vercel cron, GitHub Actions schedule, Work task or research engine change under this preparation.

## Observed state (read-only, 31 October)

| Area | Observation | Implication |
| --- | --- | --- |
| Hybrid Vercel | Production deployment READY after PR #135; root redirects to Bluebelly after existing auth middleware | Root UI is retired, but deletion will remove the redirect host itself |
| Domains | `alchemy-hybrid-market-desk.vercel.app` is attached to the Hybrid project | Old bookmarks and third-party links will fail after project deletion unless redirect/domain handling is separately proven |
| Browser traffic | No Hybrid request paths observed in a 30-minute runtime-log window | **Not** evidence of zero traffic: Hobby retention is short; Web Analytics/Observability queries returned not-found |
| Scheduled work | Hybrid `.github/workflows/live-hybrid-integration-watch.yml` retains an hourly schedule | Independent GitHub workload persists if the Vercel project is deleted; keep untouched until a later approved cron decision |
| Shared Supabase | `hybrid_publication_snapshots` = **1,392** (1,156 story + 236 daily_brief; 19 in latest 24h at observation) | These are **live canonical publication records** — not disposable Hybrid runtime storage |
| User-owned review state | `research_journeys`, `journey_step_states`, `evidence_reviews`, `catalyst_reviews` = **0 rows each** in inspected production project | No rows in these four shared tables need export, but browser-local state and any other databases/storage are not excluded by this count |
| Private owner state | `presenter_technical_checklists` = **1 row** | Retain in Supabase; confirm Bluebelly can read and update it |
| Bluebelly archive | `bluebelly_publication_archive` = **9 rows** | Retain |
| Automatic report production | `blue_desk_automated_reports`: 7 ready HTML records, 3 failed PDF records, **0 ready PDFs**, no structured `source_receipts` on these rows | Prior PDF replacement acceptance gate **not passed**; do not call reports production-proven PDFs |
| Hybrid credentials | Hybrid Vercel still lists private canonical/Dossier bearer tokens, SSO origin, and Supabase environment variables; only key **names**, not values, were inspected | Schedule credential revocation **after** endpoint consumer audit, never as part of this preparation |
| Direct owner historical view | Live/Bluebelly implements `/owner/presenter/editions?edition=<uuid>` and fails closed on invalid or unverified frozen Dossier | Code supports exact identity, **not proven** full parity with Hybrid `/journey?edition=`, `?dossier=`, or evidence UI |
| Presenter route | Existing `/owner/presenter` currently redirects to `/my-reports` | Supersedes stale draft PR #1121 targeting the old Presenter Studio; use `/my-reports` for ordinary owner navigation |

## Already performed

- Hybrid PR #135: root `/` moves to `https://bluebelly-desk.vercel.app/`. The direct Journey and edition URLs remain unmodified.
- Live PR #1228: heavy legacy composite is replaced by tab redirects; canonical data paths remain untouched.
- This readiness branch: replace the **two** remaining Live `/hybrid-output` outbound Journey actions with Bluebelly `/my-reports`, retaining the private Hybrid handoff page and API compatibility. New regression checks prevent reintroduction of the obsolete destination.

## Deletion acceptance gates — each requires evidence, not inference

1. **Preserve unique data and replay.** Establish whether Hybrid stores any user-specific browser-local state, exports or separate Supabase instance beyond the inspected shared project; back it up where applicable. Test representative actual current and old Hybrid `?edition=` and `?dossier=` references against Bluebelly's owner exact reader. Verify identity and frozen Dossier source vintage, failed-ID behavior, historical stories/price context, and owner permission boundaries. Keep direct URL compatibility or document user-approved link breakage before deletion.
2. **Owner/auth parity.** Verify unauthenticated deny, approved-owner grant, denied-account reject, return-path safety, and private historical evidence/technical checklist retrieval on real Bluebelly production. Its `/owner/presenter` route is an alias to `/my-reports` now; do not assume it is a fully equivalent Presenter Studio.
3. **Report replacement quality.** Reconcile the 27 October PDF gate with current HTML-first design. Under the original gate, prove **two** real source-qualified automatic PDFs (actual bytes, citation/source receipts, owner render/download and no duplicate schedules). If HTML is the new approved acceptance instead, record an explicit decision and verify the comparable provenance/edition quality, not just `status='ready'`. **No automatic report cron change** during preparation.
4. **Live consumer evidence.** Identify active users of the Hybrid domain, `/journey` and legacy APIs using longer-term Vercel logs/analytics, client/link inventory and read-only production probes. The 30-minute window is insufficient. Do not delete shared feed endpoints or machine secrets until independent consumers are confirmed absent or migrated.
5. **Old URL and domain plan.** Determine whether Vercel can move/alias the old `vercel.app` hostname after Hybrid removal, or explicitly accept that old bookmarks will stop working. Do not treat an app-level redirect as permanent after its hosting project disappears.
6. **Separate schedule decision.** The Hybrid GitHub hourly Live→Hybrid contract/Jules watch persists. The user has forbidden cron changes for now; obtain a **new explicit instruction** before disabling it. It does not migrate automatically by deleting Vercel.
7. **Final deletion go/no-go.** Recheck all open Hybrid PRs (#132, #131, #129, #124 and others), preserve repository history, record Vercel environment key *names* for later cleanup, verify production Bluebelly routes, then seek explicit approval to delete exactly the Hybrid Vercel project. **Do not delete the GitHub repo or Supabase records.**

## Final sequence once all gates are green and deletion is expressly authorized

1. Capture final Vercel project config/domains, current deployed commit, safely backed-up unique records and representative immutable edition IDs; never export secrets into Markdown.
2. Confirm Bluebelly production public and owner routes, auth deny/allow and exact replay; record links and HTTP statuses.
3. Coordinate the separate **cron/schedule** decision; disable obsolete Hybrid-only hourly check **only after** user authorizes it. Do not disable main Live research.
4. Delete only Hybrid Vercel project `prj_RZCeWS8eXJODPLmTeljRquGIDpu3` through its explicitly authenticated deletion flow after final approval. Verify the Live project still reports READY.
5. Remove/rotate Hybrid-only credentials after verifying no surviving client needs them. Preserve original research, reports, snapshots, owner checklist and Dossier data. Archive the Hybrid GitHub repository separately, not delete.
6. Check Bluebelly public, owner, historical, and original machine API endpoints, and explicitly report former Hybrid bookmark handling.

## Rollback

Before deletion, revert the small compatibility-link PR or the Hybrid root redirect if necessary. After deletion, a Vercel project cannot be assumed restorable by reverting a git commit. Keep the Hybrid GitHub repo, deployment manifest, source commit and data retained until a deletion and recovery procedure is separately verified.
