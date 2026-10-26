# Bluebelly-only owner access — single-site P1
27 October 2026 · Partition bounded to the existing Presenter, Writing and Reports experiences

## Outcome
`https://bluebelly-desk.vercel.app` offers one public reading interface plus an existing, authenticated `My Desk` entry. Successful Google OAuth returns to the same Bluebelly origin and a safe route, not the retired Live Desk hostname. The owner can use:
- `/my-reports` — one private PDF library, using previously implemented scheduled reporting; no new PDF generator
- `/owner/presenter` — existing native Bluebelly presenter run of show, technical checks and cloud revision storage
- `/owner/editorial` — existing native OB/COTD writing and grounded investigation
- `/api/owner/editorial-generate`, `/api/owner/editorial-investigate`, `/api/presenter/technical-checks` — **only** the exact audited same-origin browser endpoints. All still require per-request Supabase user and active allowlist checks.

No new page, scheduled job, database table, reasoning system or public publication route.

## Authentication
The public host remains public-read-only everywhere outside an explicit, narrow owner enclave. The middleware must still validate `getClaims()` and active `app_access_allowlist` before owner pages, and owner write APIs validate `auth.getUser()`, allowlist, origin and request boundaries separately. All other `/owner/**`, `/api/**`, `/auth/**` variants remain blocked. `DASHBOARD_AUTH_REQUIRED=false` cannot bypass owner PAGE auth; per-handler checks defend API auth.

Default owner OAuth return has been changed to `/my-reports`; session-bound deep links `/owner/presenter` and `/owner/editorial` remain valid. Google redirectTo uses `/auth/callback` on the request origin. **External acceptance gate:** Verify `https://bluebelly-desk.vercel.app/auth/callback` appears as an explicitly allowed redirect in Supabase Auth URL Configuration before declaring login verified. Check a real sign-in on Bluebelly and on an old host, and test fresh browser without cookies. Do not weaken this by using a broad wildcard.

## Navigation
Four original public pages remain Today, Key Stories, Markets and Calendar; the fifth small `My Desk` action is a route into authenticated existing functionality, not a new public reading destination. The owner nav uses the same `/my-reports` library instead of an overlapping Daily Report Studio path. The presenter technical checklist stays inline, with its former self-link removed.

Previously broken private links to old Live owner tools were replaced with exact existing Bluebelly public/private links. Notion, Machine feeds, research crons, existing canonical Dossier/Story APIs and provider secrets were not changed.

## Parallel authoring boundary
The linked parallel `Continue PR Fix` conversation is unreadable through the connected browser; GitHub commits in `main` have been audited. Other work already merged private PDFs `#1048`, private slate kinds `#1050`, and input health `#1051`. This partition leaves **all** automatic PDF worker, table/RLS, `/my-reports` component, dossier cron, research-backend and Hybrid repo code untouched. Only `lib/blue-desk-host.ts` is a shared seam; this branch was created from latest main and limits the edit to five exact private paths.

## Tests and acceptance
1. CI unit tests + database contracts + TypeScript + production build.
2. Unauthenticated `/owner/presenter`, `/owner/editorial` and `/my-reports` return login instead of rendering; exact model and checklist API requests reject missing session; unrelated routes remain 404.
3. Approved owner signs in on Bluebelly; creating a draft and grounded investigation returns private bounded draft (never public publish). Technical checklist GET/PUT persists revision after reload.
4. `/my-reports` displays only accepted private PDF editions and their real input health; a report isn't assumed ready because the route exists.
5. Do **not** retire Legacy Live/Hybrid machine infrastructure or revoke old credentials until the report-quality gate and dependent consumer audit pass.

## Unresolved
Real Google OAuth sign-in has not been exercised in this PR. Supabase Auth approved redirect URLs are not available from the current tools. A real authenticated browser test is mandatory before treating the new owner routes as operational. The actual PDF generation system has not been altered here.
