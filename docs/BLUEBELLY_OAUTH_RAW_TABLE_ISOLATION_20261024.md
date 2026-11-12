# Bluebelly remote-OAuth direct-PostgREST isolation gate

**Status:** Draft migration and CI contract only. Do not deploy or register ChatGPT OAuth yet.

## Root cause, observed 24 October 2026

A production read-only Supabase catalogue audit showed multiple private raw tables grant `SELECT` to `authenticated` and apply email/user-based RLS; access was meant for the existing signed-in presenter. Supabase OAuth 2.1 server access tokens also carry `role:authenticated` and an issuer-signed `client_id`. **OIDC scopes control identity claims, not database table access.** Reusing the user session with an external OAuth client can therefore satisfy existing owner RLS and reach raw data directly.

Source: [Supabase OAuth server — Token Security and Row Level Security](https://supabase.com/docs/guides/auth/oauth-server/token-security).

## Proposed independent release patch

Migration `20261024012000_bluebelly_external_oauth_private_rls_fence.sql` adds the same restrictive `FOR ALL TO authenticated` policy on exactly 12 owner-private base tables: `app_access_allowlist`, `catalyst_reviews`, `decision_snapshots`, `evidence_reviews`, `hybrid_publication_snapshots`, `journey_step_states`, `market_motion_items`, `presenter_technical_checklists`, `record_revisions`, `research_journeys`, `story_events`, `story_thesis_versions`.

Policy expression: `(auth.jwt() ->> 'client_id') IS NULL` as both `USING` and `WITH CHECK`. Restrictive RLS is combined with any pre-existing policy: this **cannot grant** a new user access to data, and blocks any external OAuth client from reading or writing those raw tables. A direct owner browser session with no `client_id` continues through the existing allowlist/user RLS. Service-role readers bypass RLS as before. The migration asserts each table exists and has RLS enabled, and is idempotent.

Views: production `current_story_thesis_versions`, `current_market_motion_items`, `current_causal_edges`, `current_asset_impacts` and `story_evidence_coverage` were inspected and use `security_invoker=true`. Their underlying table policy still determines access. Broadly public source/market views were not reclassified in this targeted private-table patch. **Additional tables/functions/extensions exposed to `authenticated` must be audited before enabling OAuth.**

## Verification

The CI `database-contracts` Postgres 17 job boots 12 table shells **in CI only**, runs the real migration twice and reads each `pg_policies` guard to check `RESTRICTIVE`, `FOR ALL`, `USING` and `WITH CHECK`. An independently created one-row test table uses the actual policy expression fetched from `pg_policy` and checks: direct authenticated session sees its own permissible row; OAuth token with `client_id` sees none; even a present-but-empty `client_id` sees none. This does **not** replace a positive live owner browser test or live scoped OAuth token tests.

## Deployment gates — explicit

1. Confirm private owner web logins and writing/presenter page reads still work with direct-session JWTs, before and after migration. Inspect whether any first-party session unexpectedly has `client_id`. If so, revise the strategy rather than shipping this policy.
2. Verify audited tables, policies, grants, views, GraphQL, functions, RPC endpoints and any exposed schemas in the actual release environment. Record what is intentionally public.
3. Run actual OAuth token through direct Supabase PostgREST, including the raw `story_thesis_versions`, `hybrid_publication_snapshots` and `market_motion_items`; demand an empty/denied read despite approved owner identity.
4. Only then build/activate a separate, allowlisted server endpoint for OAuth-protected `bluebelly-*/1` DTO reads. Validate issuer/signature, audience, token expiry, allowed client ID, owning user and revocation. Use neither `CRON_SECRET` nor `SUPABASE_SERVICE_ROLE_KEY` as a client credential.
5. Exercise unauthenticated, wrong client, expired/revoked, approved owner and wrong Story-version ID paths. Do not claim ChatGPT ingestion until a real tool invocation and exact Supabase ID/evidence readback succeed.

## Rollback

In case the private owner flow unexpectedly breaks, each policy can be removed with `DROP POLICY IF EXISTS oauth_external_client_deny_private ON public.<table>` after review. **Never roll it back while an external OAuth client is active**: revoke/disable the client and tokens first, then follow an approved rollback process. Do not change existing permissive owner policies to compensate for failures.

## Non-overlap

Independent security PR based on `main`. Does not merge or modify #1001, #1002, #1003, V6/V7 frontend, provider ingestion, Dossier System 2, Story thesis writer, or scheduled tasks. The proposed migration requires review under #834, coordinated through #936.
