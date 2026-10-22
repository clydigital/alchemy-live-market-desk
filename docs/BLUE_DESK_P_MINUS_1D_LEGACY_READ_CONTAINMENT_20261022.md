# Blue Desk P−1d — Legacy read containment, no access cutover

**Date:** 22 October 2026. **Scope:** security containment and privacy-preserving compatibility telemetry only. **Overall P−1 gate: STOP.**

## Changes

1. `/api/market-intelligence-snapshot` keeps the **exact successful `market-intelligence-snapshot/v1` JSON**, contract name, 200 status, existing CORS, and mobile-brief consumer. It sets `revalidate=0` and successful cache header to `private, no-store`; the 503 response stays non-cacheable with its existing shape.
2. `/api/dossier-v2` keeps selection statuses, exact historical IDs, optional enrichment, response headers and successful JSON unchanged. Its 503 `notice.detail` becomes a fixed safe message rather than echoing a runtime/SQL exception.
3. `/api/dossier-v2/history` keeps bounded `dossier-history/1` JSON and successful response unchanged. Its 503 `error` value becomes fixed text rather than raw exception content.
4. The three legacy GET routes now log **coarse privacy-safe caller telemetry** via `legacyReadCallerTelemetry` in the existing telemetry module. It reports only event/version, route, HTTP method, coarse user-agent class, fetch-site class, referrer **hostname only**, and booleans for presence of ID and limit query fields. It never reads/logs cookies, auth tokens, IDs, query values, complete referrers, IPs, user agent raw strings or payloads. Identity classification can be spoofed, so it is not proof of the legitimacy of a caller.
5. Tests cover field-exclusion, successful contract preservation, cache headers and nonleaking failure paths.

## Explicit non-actions

No authorization change, no Vercel env changes, no scheduler execution, no new reasoning engine, no RLS/grant modification, no owner OAuth change, no change to the working authenticated Live → Hybrid Dossier transport, and no new public DTO publication. Existing public CORS is intentionally unchanged here because legacy readers have not been audited for cross-origin use; CORS does not grant auth by itself.

## Current known consumers

| Surface | Known use | Gate |
|---|---|---|
| `/api/dossier-v2` | Historical anonymous legacy route; Hybrid **current** reader has now migrated to bearer-only `/api/internal/dossier-v2` | New protected path proven on /dossier and /journey, but unknown clients remain |
| `/api/dossier-v2/history` | Live Dossier workspace uses direct `getDossierV2HistoryIndex`, not necessarily the API. Anonymous operational-alias callers unknown | 30-day telemetry or equivalent proof, then owner-auth restriction review |
| `/api/market-intelligence-snapshot` | Live mobile-brief uses `fetch('/api/market-intelligence-snapshot')` | Cannot close without a client-compatible migration |
| `/api/intelligence-feed` | Hybrid canonical feed/historical edition replay | Requires separate server bearer/migration if restricted; do not repurpose Dossier token |
| `/api/hybrid-feed[-v2]` | Legacy compat aliases, existing caller telemetry | Retain until observed consumer audit |

## Acceptance before future access restriction

Collect at least 30 days of classified route callers or equivalent independently verified inventory covering production aliases, anonymised request class/host, deployed mobile web clients, older Hybrid variants and any external documented subscribers. Preserve the production runtime-log retention limit and collect evidence centrally if 30-day historical data are otherwise unavailable. A 'zero observed' conclusion from an incomplete log retention window does not prove no users.

After consumer migration/approval, replace old public endpoints with bounded outputs/owner-auth, test denied and allowed OAuth, bearer/cron positive and negative identities, historical as-of fixtures, and rollback. Source redistribution rights, P−1b approval, #834 and Supabase default-privilege #849 still block the general public cutover.

**Verdict:** this patch limits caching and error leakage only. It does not by itself remedy anonymous access to unreviewed research payloads.
