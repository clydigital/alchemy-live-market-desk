# P−1c — Live → Hybrid private Dossier reader: operational handoff

**As of 22 October 2026.** Draft-only. No production credentials, environment, routing, DNS, RLS, cron, or public-API modifications.

## Exact design

- The **new** Live `GET /api/internal/dossier-v2` is not a public reader. Its handler requires `Authorization: Bearer <dedicated-token>` with a configured >=32-character `LIVE_HYBRID_DOSSIER_READ_TOKEN` at Live. It compares tokens with the existing constant-time authorization helper and rejects absent/invalid token **before** reading any Dossier.
- On success the route calls the **same existing** `GET /api/dossier-v2` handler. That preserves the *current*, *degraded*, *fallback*, and *exact immutable historical* payload/status shape. The wrapper removes wildcard CORS and enforces `Cache-Control: private, no-store`, `Vary: Authorization`, and `revalidate = 0`. No new model, database table, Story writer or copy of the Dossier selector.
- The machine-auth middleware exception is scoped to `/api/internal/dossier-v2`. Dedicated public Bluebelly host still blocks the path before the machine guard. The endpoint is only usable with a valid server bearer.
- The Hybrid companion PR adds `LIVE_DESK_DOSSIER_TRANSPORT=authenticated` opt-in and a fixed `https://alchemy-live-market-desk.vercel.app/api/internal/dossier-v2` origin. It forwards the same private token **server-side only**. When switched on, a 401/404/503, missing/short secret, timeout or malformed payload yields `null`; **it must not retry the legacy anonymous Dossier endpoint**. An explicit canonical `unavailable` remains authoritative. Default unset flag is legacy mode to avoid breaking existing Hybrid.

## Required two-repository rollout (NOT executed)

1. Review green CI for Live P−1c and Hybrid P−1c draft PRs, in addition to P−1a #958 and P−1b #959. Resolve any build/contract conflicts before review.
2. Deploy the private Live reader *only after* approved production change management. Use a **new dedicated randomly generated 32+ character token**; never reuse `CRON_SECRET`, `RESEARCH_UPDATE_TOKEN`, Supabase keys, OAuth secrets or user credentials.
3. Configure the same `LIVE_HYBRID_DOSSIER_READ_TOKEN` as a server-only secret in both approved environments, with strict target/environment scoping. Store neither value in GitHub, logs, docs nor NEXT_PUBLIC_ variables. Rotate/revoke together when necessary.
4. With owner-approved test identity, prove anonymous/no bearer/incorrect bearer/wrong-host 401 or 404, valid bearer 200/404 as expected, unchanged payload and selection statuses, successful Hybrid current Dossier/Journey reads, and old/historical replay. Confirm no CORS origin and private no-store headers.
5. **Only after** that, set `LIVE_DESK_DOSSIER_TRANSPORT=authenticated` at Hybrid. Prove real positive and negative production smoke checks and safe rollback, then conduct separate consumer scans (market-intelligence-snapshot, intelligence-feed, other readers) before restriction of the broad public legacy Dossier endpoint.
6. Issue #834 (public Dossier/Motion/Story classification and raw grants) and issue #849 (future supabase_admin defaults) are separate open blockers. This transport alone does not solve those. Keep P−1 STOP/NO GO.

## Explicit non-actions

Do **not** yet block `/api/dossier-v2` on operational alias, switch `DASHBOARD_AUTH_REQUIRED`, alter Supabase RLS, merge draft PRs, force-cutover, create scheduled jobs, modify Hybrid historical edition routing, or publish unreviewed source claims.

**Assessment:** P−1c code may pass offline tests; authenticated runtime handshake remains **UNVERIFIED** until two-side credentials + host-level positive/negative probes are completed.
