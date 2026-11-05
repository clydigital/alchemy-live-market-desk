# R2 — Bluebelly private read-only MCP pilot · 6 Nov 2026

This change adds an **opt-in, disabled-by-default** MCP resource server on the existing Bluebelly public hostname. It does **not** create another research engine, a separate auth database, a new scheduled task, a ChatGPT-installed plugin, or new canonical story writes.

## Endpoint and tools

`POST https://bluebelly-desk.vercel.app/api/mcp` — stateless Streamable HTTP JSON-RPC; accepts MCP `initialize`, `ping`, `tools/list`, `tools/call` and initialized notification. GET refuses stream sessions; the server returns JSON results with no persistent session ID.

`GET https://bluebelly-desk.vercel.app/.well-known/oauth-protected-resource` — RFC 9728 metadata, with Supabase Auth as issuer.

Three bounded read-only tools:
1. `get_market_snapshot` — existing public-safe market monitor projection, group and 1–80 rows. Returns exactly source-dated 1/3/5 session changes where available; missing values remain null; no private portfolio or provider raw history.
2. `get_verified_events` — existing source-qualified event projection shared with Newsroom, current 48h or ISO UTC cursor within seven days, at most 18 events. Preserves exact original URL, source record ID, occurred/observed clocks and unverified reaction nulls.
3. `get_source_health` — checks visibility of existing Motion, press and official macro readers; report DEGRADED rather than pretend a quiet market.

## Authentication and privacy requirements (ALL required before enablement)
- [ ] Confirm Supabase OAuth 2.1 Server is enabled and its `/.well-known/oauth-authorization-server/auth/v1` issuer discovery works.
- [ ] Enable/configure OAuth client registration for ChatGPT; set Supabase Auth Site URL to the authorised Bluebelly hostname and Authorization Path to `/oauth/consent`. This PR supplies a disabled-by-default owner-only consent page and decision route, with exact approved client ID, scope, redirect, origin and RLS checks. **Verify this against the live Supabase OAuth server before activation.** Register the exact ChatGPT callback URI, or use documented dynamic client registration; do **not** auto-approve unknown clients.
- [ ] Configure asymmetric Supabase signing keys (RS256 or ES256) with a functional `/auth/v1/.well-known/jwks.json` endpoint.
- [ ] Configure and independently verify a *scoped* Custom Access Token Hook for **OAuth client grants only** that propagates OAuth `resource=https://bluebelly-desk.vercel.app/api/mcp` into the signed `aud`. Ordinary session JWTs with `aud=authenticated` **must not** be accepted. Preserve existing dashboard token and RLS behavior: DO NOT change the global audience indiscriminately.
- [ ] Approve the exact OAuth client ID(s) after registration and set `BLUEBELLY_MCP_ALLOWED_CLIENT_IDS` to a comma-separated list of those client IDs in Vercel **production environment only** (a value is not an API secret). Server never trusts client-supplied email, token query parameters, or raw service-role credentials.
- [ ] Confirm Supabase owner authorization policy: RLS on `app_access_allowlist`; only active owners can check their own email. Verify token comes from the configured issuer, has required `email` scope, is signed, time-valid, has `aud` exactly including the MCP resource but not `authenticated`, and has an approved `client_id`.
- [ ] Enable `BLUEBELLY_MCP_ENABLED=true` **only after** the above are verified. It defaults to 404 with no metadata.
- [ ] Validate HTTP 401 + `WWW-Authenticate` challenge, protected resource discovery, ChatGPT OAuth PKCE sign-in and consent, bearer on each request, source parity, revoked session, expired token, wrong audience, wrong client ID, non-allowlisted user, missing scope, and untrusted requester. Keep URL and exact headers out of public research pages.
- [ ] Test with MCP Inspector and a newly connected private ChatGPT app, using the official read-only tools. Do not claim working plugin before actual OAuth connection and three live example requests pass.
- [ ] Rollback path: disable `BLUEBELLY_MCP_ENABLED` without altering ingestion, readers or schedules. Monitor error volume, bounded data responses and data freshness.

## Security boundaries

`blueDeskHostAccess` allows only **exact** `/api/mcp` and `/.well-known/oauth-protected-resource` paths through the public presentation middleware; both handlers are gated independently. No `/api/owner/*`, `/api/internal/*` or raw Supabase data is exposed. The MCP endpoint is reachable from ChatGPT only after the configured OAuth grants and owner allowlist; the existing browser-cookie API is not used for remote MCP.

Because the Supabase OAuth server's authorization settings and token hook are administrator-managed, this PR intentionally does not silently enable them or modify the project's existing authentication policy. Deploying disabled code and enabling the integration are **separate gates**.

## Verification and cutover

GitHub regression tests, TypeScript, database-contract and Next.js production build; then Vercel READY on exact commit, public `/newsroom` and `/markets` HTTP 200, anonymous `/api/mcp` 404 while disabled, and no change to owner/private routes. OAuth setup after initial deploy, no premature enablement. When enabled, rerun all auth negative cases before connecting ChatGPT.

Reference issue: #1357. Existing T02 ingestion fix: #1359. Shared reader: #1360. No modifications to MacroPulse, Research Gap, AI Regime, Creator Intelligence or existing five ChatGPT schedules.
