# Two legacy URLs — safe front-end retirement audit (31 October 2026)

## Decision

**Canonical user-facing website:** `https://bluebelly-desk.vercel.app/`.

**Keep the Live Vercel project** `prj_mHZ3Tosmi2iHCFthG4Eok8BLnWlq` — its research jobs, authenticated owner tools, machine/publication APIs, source ingestion and original domain are still required. **Do not delete the Live Vercel project or remove its domain.**

**Retire its old public interface:** issue a **307 no-store** redirect on `alchemy-live-market-desk.vercel.app` for exactly allowlisted public presentation routes into the matching Bluebelly route; leave old machine, auth, cron, private owner and historical-selector routes untouched. 307 is intentional for easy rollback; do not use a persistent 308 before tested parity.

**Hybrid Vercel deletion:** still **HOLD**, project `prj_RZCeWS8eXJODPLmTeljRquGIDpu3`, until exact edition history, auth and old-domain consumers have an accepted resolution. Do not assume its `vercel.app` name can be moved after deletion.

## Route outcomes

| Old human route | New behaviour |
| --- | --- |
| Live `/`, `/blue-desk`, `/owner/live` | 307 to Bluebelly `/` |
| Live `/markets`, `/blue-desk/markets`, `/owner/markets` | 307 to Bluebelly `/markets` |
| Live `/calendar`, `/key-stories`, `/daily-report`, `/newsroom`, `/hormuz`, `/regime-watch`, `/learn`, feature/lens/article pages | 307 to corresponding Bluebelly page |
| Live `/?tab=markets`, `/?tab=bonds`, etc. | Existing short allowlist of legacy tab locations mapped to equivalent Bluebelly public route/anchor, without echoing untrusted tab value |
| Live public `?edition=`, `?dossier=`, `?story=` and focused deep-link identifiers | **Do not auto-redirect.** Remain subject to existing route and auth: current page must not silently replace an exact historical edition |
| Live `/api/**`, `/auth/**`, `/api/cron/**`, `/owner/editorial`, `/owner/research`, `/dossier`, `/hybrid-output` | No redirect and no access-rule changes |
| Other Live deployment aliases and Bluebelly canonical domain | No redirect |

Approved public query state: `/markets?group=`, `/calendar?window=`, `/key-stories?feature=` with bounded simple values only. No arbitrary referrer, bearer, API token or caller-supplied destination is forwarded.

## Verified dependencies / potential issues

1. **Machine consumers:** Repository scripts and scheduled integrity checks call `https://alchemy-live-market-desk.vercel.app/api/...` directly, including the `/api/rates/source-integrity` endpoint and research update submission. **Removing the Live domain or redirecting APIs would break them.** Only redirect public *human* pages.
2. **Public bookmarks and SEO:** The old website URL changes to a temporary 307. This may affect bookmarks which expect the old address in the browser, URL-based analytics and search indexing. Bluebelly should be declared canonical in page metadata; consolidate links incrementally. A 307, unlike a 308, is deliberately reversible.
3. **Owner browsing:** Some private Live paths are still needed. Users may continue to authenticate on the operator hostname; do not overwrite `/auth/**` or `/owner/**` wholesale. Only `/owner/live` and `/owner/markets` have explicit public replacements.
4. **Hybrid exact replay:** Production shared `hybrid_publication_snapshots` held **236** daily-brief rows in the preceding readback, of which **203** carried a `dossier` payload field and **33** did not. Presence of that field alone does not prove complete Bluebelly exact-replay parity. Hybrid's `/journey?edition=` and `?dossier=` URLs must not be blindly mapped to `/daily-report`.
5. **Hybrid authentication:** The 31 Oct Vercel production environment-key inventory did not list `DASHBOARD_AUTH_REQUIRED`, while Hybrid middleware contains `if (!dashboardAuthRequired()) return NextResponse.next();`. **Potential access-control bypass for the retired Hybrid UI**; production HTTP and expected audience must be verified before keeping an archived private reader exposed. Do not publish owner evidence or loosen any permissions.
6. **Consumer absence is unproven:** Hybrid's runtime log query showed no recent paths in a short, retained window; Hobby plan rejected longer lookbacks. This cannot certify no bookmarks, bots, apps or external consumers.
7. **Research data:** Hybrid and Live were verified to share Supabase production project `qdtlrfgxpsnxajiptrno`. Keep 1,392 shared publication snapshots and all historical, evidence and owner rows even if the Hybrid UI is retired.
8. **Report parity:** Original automatic PDF acceptance remains incomplete. Current HTML-first reports must be assessed separately from a successful frozen Journey replay. Do not silently change the replacement promise.
9. **Cron:** User explicitly requested **no schedule changes**. The hourly Hybrid GitHub Actions watch and all Live research schedules stay as-is.

## Acceptance and rollback

- On the newly deployed Live commit, independently probe the old public hostname `/`, `/markets?group=rates`, `/calendar`, `/owner/live`, `/owner/markets`, `/api/hybrid-feed`, `/api/cron/research/morning` (without invoking a real cron action!), owner auth and an exact edition. Confirm temporary 307 only on old *human* paths and correct source/date on Bluebelly.
- Do not actively GET research cron endpoints or protected ingestion endpoints during smoke checks. Inspect routing logic, tests and existing runtime logs instead.
- Verify Bluebelly direct `/`, `/markets`, `/key-stories`, `/daily-report`, `/my-reports` auth, and historical owner `/owner/presenter/editions?edition=<uuid>` with a source-bound UUID.
- CI: full tests, TypeScript, production build and Vercel production READY. A deployed build is not evidence all remote HTTP flows passed; record remaining remote tests honestly.
- If 307 damages an essential workflow, revert this small middleware and routing-helper change; **no** API, auth, data, env or schedule rollback should be necessary.
- Before final Hybrid deletion, complete the [separate deletion-readiness gates](./HYBRID_DECOMMISSION_READINESS_20261031.md). Do not delete either GitHub repo or Supabase project.

## Implementation scope

This change only touches `middleware.ts`, `lib/blue-desk-host.ts`, this assessment and regression tests. No Vercel settings, environment variables, Supabase records, cron definitions, publication worker or proprietary historical data is modified.
