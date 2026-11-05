# Bluebelly R2 — Supabase OAuth activation checklist (6 Nov 2026)

**State:** The SQL in `docs/sql/bluebelly_r2_oauth_scoped_hook.sql` has been installed in the connected Supabase project. The SQL function is inert because it is **not** selected in Authentication > Hooks. The allowlist contains **zero** clients. Bluebelly's Vercel `BLUEBELLY_MCP_ENABLED` flag is still **unset**, so the MCP route and OAuth discovery return HTTP 404. This is **not** a completed ChatGPT connection.

## Confirmed non-destructive checks (6 Nov)

- Actual project schema: `auth.oauth_clients` and `auth.oauth_authorizations` exist. Both contain **zero records**; no ChatGPT OAuth client is registered.
- The private `bluebelly_oauth.approved_mcp_clients` table exists with RLS enabled. Only `supabase_auth_admin` has schema usage, table SELECT and hook EXECUTE privileges; `anon` and `authenticated` have none.
- A no-approved-client function invocation preserved `aud=authenticated` for normal dashboard and unknown-client tokens.
- A temporary test UUID in a transaction allowed the hook to produce `aud=https://bluebelly-desk.vercel.app/api/mcp`, `scope=email`, and the correct `client_id` while preserving `sub`, `role` and expiry; an unknown client was unchanged. The transaction was rolled back, leaving the table **empty**.
- Supabase security advisors did not identify a new finding targeting `bluebelly_oauth`. Other unrelated project advisories remain and are not hidden.
- The Supabase SQL connector could not `SET ROLE supabase_auth_admin` (permission denied). Its ACL and RLS policy were inspected, but the hook has **not** been tested during real Supabase Auth token issuance or with an actual `supabase_auth_admin` session.

## Administrator actions — do not skip

1. Open <https://supabase.com/dashboard/project/qdtlrfgxpsnxajiptrno/auth/oauth-server>. Under **Authentication > OAuth Server**, confirm if the OAuth 2.1 server is already enabled, then configure the authorization UI path to `/oauth/consent`. **Do not enable anonymous dynamic client registration** unless there is an explicit review reason. If Supabase's Site URL is used to resolve the consent URL, preserve the existing login callback/redirect behaviour.
2. Register one dedicated **public** ChatGPT OAuth client in **Authentication > OAuth Apps**, with PKCE `S256`, token-endpoint method `none`, and the **exact callback URI provided in ChatGPT's plugin connection screen**. Avoid relying on guessed callback IDs. Verify the registration creates one non-deleted `auth.oauth_clients` record with the expected redirect and method. If a custom client metadata document is supported instead, verify it against the actual provider metadata first.
3. Record the issued client **UUID**, and separately inspect its registered callback, approval mode and effective scopes. An administrator should explicitly add that UUID to `bluebelly_oauth.approved_mcp_clients(client_id,enabled)` after review. This is a privileged SQL write; do not use a user-supplied arbitrary client string.
4. Confirm asymmetric **RS256/ES256** signing keys and public JWKS endpoint in **Authentication > Signing Keys** before enabling a hook; existing dashboard logins must remain functional.
5. In **Authentication > Hooks**, select SQL Custom Access Token Hook `bluebelly_oauth.mcp_client_token_hook`. It changes `aud` only for the specifically approved client; all other clients return their original event. This is a **global JWT issuance hook**, so recheck ordinary dashboard sign-in and refresh immediately.
6. Supabase OAuth Authorization Server metadata should be visible at `https://qdtlrfgxpsnxajiptrno.supabase.co/.well-known/oauth-authorization-server/auth/v1`. Verify its issuer, PKCE `S256`, discovery and token endpoint. The protected resource metadata lives on Bluebelly's site and is still disabled until activation.
7. Run a **real** ChatGPT authorization-code + PKCE + consent flow. Inspect the issued token claims on the server without logging the token itself: audience must equal `https://bluebelly-desk.vercel.app/api/mcp`; client ID must match approved UUID; issuer, scope, expiry, sub, role and session all valid. Check Supabase `auth.getUser(token)` and active-owner RLS lookup with this nonstandard audience. These may fail and require a separate secure design correction.
8. Test other-user, unapproved-client, dashboard-token, wrong-audience, missing-scope, expired/revoked-token and anonymous requests before setting `BLUEBELLY_MCP_ALLOWED_CLIENT_IDS` and `BLUEBELLY_MCP_ENABLED=true` **in Vercel Production**, redeploying, and making the ChatGPT plugin connection.
9. In ChatGPT, validate `get_market_snapshot`, `get_verified_events` and `get_source_health` against source-dated public website records; ensure read-only and unknown market responses remain explicitly null.
10. Rollback: unset `BLUEBELLY_MCP_ENABLED` and redeploy, or remove the approved client UUID; disable the hook from Supabase **Authentication > Hooks** if needed. Existing Markets, Newsroom, five scheduled research tasks and public site must continue functioning.

## Resource binding caveat

Supabase Auth [issue #2610](https://github.com/supabase/auth/issues/2610) remains open concerning RFC 8707 resource-indicator handling. A **client-bound** hook can stamp a fixed Bluebelly `aud` and is suitable for a dedicated pilot, but that is **not evidence** that Supabase echoed the `resource` parameter through the OAuth authorization and token exchange. The MCP authorization specification requires that parameter to be bound correctly. Do not advertise full standards compliance or enable the MCP gateway until real token issuance and ChatGPT handshake are demonstrated.

The connected Supabase database plugin cannot configure the project's OAuth Server toggle, OAuth Apps registration, Authentication Hooks selection, or signing-key rotation. These are administrator control-plane actions, not SQL table inserts. Do not manipulate `auth.oauth_clients` directly as a substitute for the official registration API.

**Source references:** Supabase Auth OAuth 2.1 Server Getting Started, Token Security & RLS, Custom Access Token Hook (2026 versions); OpenAI plugin MCP authentication and custom MCP server connection documentation. See also R2 code in PR #1361 and tracking issue #1357.
