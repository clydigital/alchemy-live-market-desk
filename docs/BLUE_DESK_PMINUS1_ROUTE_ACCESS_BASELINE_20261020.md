# Blue Desk P−1 — Public/private route and data-access baseline

**Observed:** 20 October 2026 (Asia/Kuala_Lumpur). **Audit scope:** read-only Vercel configuration, main-branch Next middleware, live anonymous TinyFish fetch, Supabase catalog/grants/policies. **Verdict: HOLD for full Blue Desk cutover.** This is a factual audit, **not** proof of an exploitable private-record leak and not authorisation to change authentication.

## Deployment / middleware evidence

- The Vercel project `alchemy-live-market-desk` has project-level password protection, Vercel SSO protection and trusted-IP restrictions **disabled**. This is not itself the application authentication setting.
- Environment key listing (`decrypt=false`) returned 38 environment entries, zero hidden production entries and **no `DASHBOARD_AUTH_REQUIRED` key**. Effective behaviour is independently tested below.
- `lib/blue-desk-host.ts`: `bluebelly-desk.vercel.app` exposes only homepage, calendar, and exact-format published Story routes; `alchemy-blue-desk.vercel.app` is blocked. All other hosts are classified private.
- `middleware.ts`: owner-facing HTML requires verified Supabase claims plus active `app_access_allowlist`; public Bluebelly paths bypass owner auth. Machine paths and `/api/cron/**` bypass interactive Google login and rely on the endpoint's own checks.
- **Important:** on operational hostnames, `/api/**` bypasses the page login when `DASHBOARD_AUTH_REQUIRED` is false. This is an intentional compatibility path and must be classified endpoint-by-endpoint before being changed.
- `app/api/presenter/technical-checks/route.ts` independently requires a signed-in and allowlisted user for both GET and PUT.
- `lib/hybrid-publication.ts` reads immutable archive and thesis versions with server-side service credentials, never in browser JS.

## Anonymous HTTP observations

Fetches made with an unauthenticated TinyFish `fetch_content` session; no logged-in profile or OAuth credentials supplied.

| Host and path | Result | Interpretation |
| --- | --- | --- |
| `bluebelly-desk.vercel.app/` | Success; rendered market brief | Intended public reading is accessible |
| `bluebelly-desk.vercel.app/api/market-intelligence-snapshot` | 404 | Operational endpoint not published at the Bluebelly hostname |
| `bluebelly-desk.vercel.app/presenter/technical-checks` | 404 | Private technical UI blocked |
| `alchemy-live-market-desk.vercel.app/` | `login_required` | Owner page gated |
| `alchemy-live-market-desk.vercel.app/api/market-intelligence-snapshot` | Success; about 59,667 characters of JSON | **Live owner-origin API is anonymous-readable**; payload field classification required before deciding whether this is an intentionally public read model |
| Public valid `/stories/article%3A<edition>%3A<story>?edition=<edition>` | Success | Exact published article route resolves |
| Same article, deliberately mismatched edition UUID | 404 | Historical link fails closed |
| Public `/markets`, `/articles`, `/dossier` | 404 each | Current header/homepage advertises broken links |

The exact live route response and successful fetch prove an API reachability fact; they do **not** prove that a restricted personal record is in the response. Review response classification without redistributing raw payloads, and add source-identity and private-field deny tests before cutover.

## Supabase read-only permission audit

Project: `qdtlrfgxpsnxajiptrno`. Catalog query inspected public-schema tables, materialised views and views for `anon` grants, RLS, and policy visibility.

- `hybrid_publication_snapshots`, `story_thesis_versions`, `story_events`, `presenter_technical_checklists` and `app_access_allowlist`: RLS enabled, `anon` SELECT not granted in current catalog.
- `current_asset_impacts`, `current_causal_edges`, `current_story_thesis_versions`, `story_evidence_coverage`: views have `anon` SELECT grants and `security_invoker=true`; consequently grants/policies on underlying tables still matter.
- `asset_impacts`, `causal_edges`, `stories`, `evidence` have RLS public-read SELECT policies with `USING (true)`. Treat this as an existing publication policy requiring a licensing/content review, not automatically an exposure defect.
- `story_thesis_versions` has allowlisted `authenticated` SELECT policy, not `anon` SELECT. This restricts its invoker view even where the view has an `anon` grant.
- `story_evidence_coverage` joins `intelligence_story_evidence` and `intelligence_evidence`, which had no anonymous SELECT entitlement in the catalog. A successful anonymous row read was **not** demonstrated.
- Supabase security advisor reports many `rls_enabled_no_policy` informational notices, often matching intentionally owner/service-only intelligence tables. These are **not** reasons to add permissive RLS policies.

## Route permission matrix (observed or code-proven)

| Area | Intended caller | Current evidence | Before cutover |
| --- | --- | --- | --- |
| Bluebelly home/calendar/published Story | Public reader | Live anonymous home + Story success, host allowlist in code | Verify payload is redacted/licensed, including history |
| Bluebelly operational URLs | Nobody on public host | Direct API, presenter route 404 | Keep deny-by-default, add automated HTTP smoke |
| Live Desk / Hybrid HTML | Approved owner | Anonymous `/` login; allowlist middleware | Test approved, disallowed, expired sessions on production/preview |
| `/api/presenter/technical-checks` | Approved owner only | Route-level auth and allowlist | Direct unauthenticated HTTP 401 and mutation denial tests |
| `/api/market-intelligence-snapshot` | **UNDECIDED**: existing integrations vs public display | Anonymous JSON read confirmed | Identify all consumers and all fields; define public-safe projection vs owner scope |
| `/api/dossier-v2`, `/api/hybrid-feed-v2` | Existing consumers; publication scope to verify | Middleware compatibility bypass when flag absent, route code reviewed | Direct payload and auth-contract checks; do not assume CORS is auth |
| Machine `/api/research-update`, `/api/research-gap/**`, `/api/cron/**` | Credentialed automation | Middleware bypasses Google and delegates auth to handlers | Token-accept/deny tests, replay/health checks; preserve production jobs |
| Raw Supabase archive / presenter | Server or owner | RLS/grants restrict anon; service credentials server-side | Verify role-level direct REST reads and account scoping |

## Blockers and narrowly scoped next step

1. **High / contract blocker:** classify actual fields exposed by the anonymous `market-intelligence-snapshot/v1` response. It includes Dossier/regime information and research gaps; decide whether this *entire response* is public-approved. If not, create an **independent public-safe projection** while retaining a properly authorised operational/owner path and existing machine callers. Do not blindly flip `DASHBOARD_AUTH_REQUIRED`.
2. **Medium / UX blocker:** public homepage and header advertise routes that the Bluebelly host deliberately blocks. Define public destination parity or conditionally omit only unavailable navigation; do not expose private owner UI to fix 404s.
3. **Medium / verification blocker:** anonymous reader checks pass, but approved owner, disallowed owner, expired owner session, machine credential negatives, preview origin and Supabase direct REST requests remain unexecuted.

**Stop/go:** P−1 is **PARTIAL / HOLD**, not accepted. No auth policy, RLS grant, API contract, machine scheduling or deployment was changed during this audit. Security remediation and later interface migration should be separate, reviewed PRs with CI and runtime proof.

Related source files: `middleware.ts`, `lib/blue-desk-host.ts`, `lib/supabase/config.ts`, `app/api/market-intelligence-snapshot/route.ts`, `lib/market-intelligence-snapshot.ts`, `app/api/presenter/technical-checks/route.ts`, `lib/hybrid-publication.ts`, `components/blue-desk/BlueDeskHeader.tsx`.
