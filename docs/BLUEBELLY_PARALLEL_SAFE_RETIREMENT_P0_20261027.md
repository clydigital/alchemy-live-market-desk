# Bluebelly P0 / Parallel-safe retirement handoff
Date: 27 October 2026 — bounded alongside ongoing PDF/PR-fix work

## Single product contract
- The only user-facing website will be `https://bluebelly-desk.vercel.app`.
- Live Desk remains the existing canonical research service, NOT a second human website.
- Hybrid's deployable website is retired only after a proven replacement and consumer audit.
- Old human links redirect **into** Bluebelly; machine APIs must NOT be redirected.
- No new page, service, database, scheduled job or reasoning authority is authorised.

## Parallel-work ownership / collision avoidance
The linked ChatGPT tab `6ade7455-097c-83ec-b244-810374ef28d6` was discovered in Opera, titled **Continue PR Fix**. Its contents could not be read through the connected browser (timeout), so this branch **does not claim coordination with that chat's exact instructions**. We independently checked GitHub's recent `main` commits. Parallel work touched:
- `app/my-reports/page.tsx`, `components/blue-desk/OwnerPrivatePdfInputHealth.tsx`.
- `app/api/cron/research/morning-dossier/route.ts`, `app/api/owner/automated-report-pdf/route.ts`.
- `lib/blue-desk-automated-report-job.ts`, `lib/blue-desk-private-slate-*.ts`, `lib/blue-desk-automated-report-reader.ts`.
- `lib/blue-desk-host.ts`, `app/blue-desk/daily-report/page.tsx`, and corresponding tests/migrations.

**This partition does not edit any of those paths**, nor authentication middleware, database schemas, PDF generation, public report routes, or existing canonical publication APIs. Review again before any merge. This is an intentionally independent one-way human UX migration.

## Phase P0 shipped here
1. Remove external **Hybrid Journey** and `/hybrid-output` from the leftover legacy Live shell's primary actions.
2. Replace the legacy shell's "Blue Desk preview" with a single external `https://bluebelly-desk.vercel.app/` destination.
3. Remove `/hybrid-output` as a first-class old Live navigation entry while retaining the underlying route for historical callers.
4. Add pure `resolveLegacyBluebellyHumanLink()` route inventory as an unused compatibility helper, with explicit missing historical/owner permissions and API refusal.
5. Add unit tests for one-way entry, history fail-close and untouched machine URLs.

## Cutover matrix — staged, NOT activated by this partition
| Existing human path | Future Bluebelly path | Gate |
| --- | --- | --- |
| Live `/`, `/owner/live` | `/` | public reader health |
| Live `/markets`, `/owner/markets` | `/markets` | numeric/source parity |
| Live `/stories`, `/regimes` | `/key-stories` | living Story integrity |
| Live `/dossier`, `/articles`, `/hybrid-output` | `/daily-report` | report quality; dated context |
| Hybrid `/journey`, `/dossier` | `/daily-report` | dated report quality |
| Hybrid `/tracking`, `/investigations` | `/key-stories` | historical traceability |
| Hybrid `/markets` | `/markets` | observed values and clock parity |
| Live `/owner/daily-report`, `/owner/presenter`, `/owner/editorial` | signed-in Bluebelly owner view | actual Bluebelly OAuth/session gate first |
| Exact `?edition=`, deep-linked Story/Event/Regime | *No generic redirect* | exact immutable replay required |
| Any `/api/**`, cron, auth callback or machine handler | *No public redirect* | update authenticated clients separately |

## P1 dependency priorities (do not overlap active PRs)
- Establish end-to-end owner Google OAuth on Bluebelly, including callback and return path, five authentication roles, and direct PDF iframe denial to unauthorised users. Preserve exact allowlist for browser and machine routes, never broad `/owner/*` or `/api/*` exposure.
- Make `/my-reports` and native Presenter/Writer one coherent private destination (reuse existing routes, no clone).
- Validate **two real independently source-qualified** automatic PDFs from existing schedules, actual downloadable bytes and evidence-citation accuracy. A database-ready status alone is not evidence of a good report.
- After the above: activate verified human redirects (including historic semantics), inspect Hybrid and Live API caller telemetry, preserve unique user data, stop Hybrid Vercel then retire old Live human hostname. Do not remove the Vercel project driving canonical research jobs.

## Merge safety
This PR is path-disjoint from the recent PDF/auth hot path. It does not activate the redirect helper, delete any API or legacy page, alter model/prompt, grant permission, move Notion files or change schedules. Re-run full CI after any update to main and check staging/real-domain boundaries before releasing.
