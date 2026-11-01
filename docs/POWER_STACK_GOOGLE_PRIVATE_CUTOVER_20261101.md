# Power Stack private Google access — gated cutover

**Issue:** #1254 · **Implementation branch:** `feat/power-stack-owner-google-enclave-1254` · **Status:** pre-cutover; do not merge until public data retirement is proven.

## Implemented in this branch

- `/power-stack` is an exact owner-only route on the canonical `bluebelly-desk.vercel.app` hostname. The original Bluebelly Supabase/Google session is reused. There is no new OAuth provider configuration, account-picker prompt or separate client-side login.
- The page verifies the user via `auth.getUser()` and checks the active `app_access_allowlist` itself, even where an alias or preview has a weaker middleware configuration.
- Versioned private data is intended to come exclusively from `power_stack_owner_snapshots`, protected by user-ID RLS. No public GitHub Pages JSON, `raw.githubusercontent.com`, portfolio data in browser bundles or service-role key is used.
- `legacy_source_retired` defaults to false. The page refuses to display holdings unless both an owner snapshot and a verified legacy-source-retirement flag exist.
- Private navigation links to this page. The public Markets and public user journeys do not need Google login.

## Remaining *release blockers*

1. **Retire the current public data origin:** `clydigital/power-stack` is PUBLIC, and the HTML and multiple `data/*.json` assets include personal portfolio quantities, positions, investment plan and account estimates. Removing only the GitHub Pages index or adding client-side login does NOT protect direct GitHub/raw access or history. Decide and execute a repository visibility / clean-public-research-only split; include GitHub Pages, GitHub raw, history, cached bundles and previews in the check. The GitHub connector used here cannot change repository visibility, so this has not been done.
2. **Import source-verified private snapshots** into Supabase from the owner's account, keyed by the actual `auth.users.id`; check quote date, position quantity date and broker reconciliation. No import or broker verification is claimed.
3. **Separate public market search from holdings ownership.** Existing `lib/bluebelly-power-stack-public.ts` reads public holdings and emits `researchRole: holding`. Open Markets PR #1253 also edits this file and creates a Power Stack public category. The PR owner must remove public ownership/position flags and use a non-personal universe only; do not merge #1253 if ownership is still exposed. Keep 1D/3D/5D instrument returns independent of portfolio positions.
4. **Prove access on deployed production and preview:** approved existing session, signed-out first login, refresh, new tab, deep-link, expired account, revoked allowlist, direct endpoint, public-host allowlist, preview aliases, cache-control and direct legacy URLs. Ensure Google account picker is not forced and no bounce loop occurs. No production proof in this branch yet.
5. **Merge/release only when all checks pass**, with a rollback plan for the Pages domain and existing canonical research consumers. No cron, Regime/Dossier or scheduled writer changes.

## Immediate acceptance and rejection

- Tests: `node --test --experimental-strip-types tests/power-stack-private-auth.test.ts tests/owner-oauth-return-path.test.ts tests/blue-desk-host-content.test.ts`
- Full: `npm test`, `npx tsc --noEmit`, `npm run build`
- **Stop if:** any anonymous URL exposes private holdings or the owner is prompted to choose an account on every visit.
- **Do not call this migration complete** just because the private route renders or the checks run green. The public origin and actual private source migration are required.
