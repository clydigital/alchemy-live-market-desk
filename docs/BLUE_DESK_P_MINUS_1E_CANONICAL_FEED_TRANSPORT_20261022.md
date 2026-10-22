# Blue Desk P−1e — Canonical feed machine-reader gate

**22 October 2026 — draft only.** This partition does not change production, shut off anonymous consumers, edit canonical records, or authorise Blue Desk replacement.

## Live route

The new `GET /api/internal/canonical-feed` requires `Authorization: Bearer <token>` using the **dedicated** `LIVE_HYBRID_CANONICAL_FEED_READ_TOKEN` (random 32+ characters, no whitespace). It does **not** accept `LIVE_HYBRID_DOSSIER_READ_TOKEN`, cron tokens, a Supabase key or owner OAuth. If unconfigured: 503; absent or wrong token: 401. Middleware's machine exception is limited to this route, and the public Bluebelly host remains blocked before that exception.

For a valid token, call the **existing** `getCanonicalPublicationResponseWithDeskRead(edition)`. This preserves the exact `?edition=` historical selector, persisted canonical Story state, output fields, status and Desk Read. The private response enforces `private, no-store`, `Vary: Authorization`, no permissive CORS or content-length passthrough. Failed assembly returns a fixed 503 without internal errors.

This is a private compatibility reader, **not** the user-facing reviewed public DTO; it does not make source redistribution safe.

## Companion Hybrid migration

The companion Hybrid draft introduces `LIVE_DESK_CANONICAL_FEED_TRANSPORT=authenticated` opt-in and independently configured `LIVE_HYBRID_CANONICAL_FEED_READ_TOKEN`. An absent setting remains **legacy**. When opted in, bad credentials/redirects/timeouts/invalid versioned payloads fail closed; there is no silent retry against `/api/intelligence-feed`. Both current and exact historical `editionId` go to the new read route; the existing canonical presenter projection is preserved. The feed's 8 MiB body cap prevents unbounded reads; verify real production feed size before rollout.

## STOP gates before activation

1. Both PRs green with all contract tests, Next build, and DB checks where applicable.
2. Provision a *new* high-entropy token server-side in both deployment environments; ensure it differs from the Dossier reader secret. Never put it in `NEXT_PUBLIC_*`, a source file, logs, issues or the browser.
3. Approved deployment of Live route **first** while anonymous legacy remains available. Test on canonical and operational aliases: unauthenticated 401; misconfigured 503; correct bearer 200 with exact response fields; wrong bearer 401; Bluebelly 404; source origin fixed; no CORS, shared cache or redirects.
4. Deploy Hybrid code in **legacy mode** and verify current feed, Journey, Wire/Story, and historic `?edition=` (including >24 old edition as available). Switch only for a bounded, observable test; bad auth/timeout remains unavailable, not auto-fallback. Revert mode and redeploy on failure.
5. The mobile-brief `/api/market-intelligence-snapshot` **still has a direct browser client**. Do not switch it to this machine bearer, publish a token or globally require owner auth until a reviewed public DTO and allowed owner workflow have replaced it.
6. Observe feed-compatibility telemetry for all legacy aliases (intelligence-feed, hybrid-feed-v2, hybrid-feed), including undocumented clients. Short Vercel log retention cannot prove no users. P−1b owner/licensing gate, security issues #834/#849, OAuth positive/negative proofs, and historical exact replay proof remain open.

**Verdict: P−1 STOP/NO GO for public/private cutover.** This is a side-by-side read transport candidate only.
