-- Bluebelly private-owner OAuth isolation, draft for security gate #834.
-- OAuth clients receiving a Supabase Auth access token also receive
-- role=authenticated, so existing signed-in owner allowlist RLS alone does NOT
-- prevent access to full canonical Story and publication payloads over REST.
-- Supabase official OAuth token docs: token-security; client_id is issuer-signed.
--
-- This adds RESTRICTIVE policies, combining by AND with existing permissive
-- owner RLS policies, never replacing the user/owner predicates.
-- Direct Supabase user sessions (absent client_id) retain their old privileges.
-- Every third-party OAuth client (client_id present) is denied SELECT and
-- data writes to these private tables, irrespective of owner identity.
-- service_role behaviour is unchanged (BYPASSRLS).
--
-- Before applying in production, complete raw PostgREST denied-token,
-- approved owner browser regression, views/RPC checks, and rollback review.
-- No OAuth client is created or enabled by this migration.

DO $oauth_private_guard$
DECLARE
  protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'app_access_allowlist',
    'catalyst_reviews',
    'decision_snapshots',
    'evidence_reviews',
    'hybrid_publication_snapshots',
    'journey_step_states',
    'market_motion_items',
    'presenter_technical_checklists',
    'record_revisions',
    'research_journeys',
    'story_events',
    'story_thesis_versions'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
        AND c.relname=protected_table
        AND c.relkind IN ('r', 'p')
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Missing RLS private table: public.%', protected_table;
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS oauth_external_client_deny_private ON public.%I',
      protected_table
    );
    EXECUTE format(
      'CREATE POLICY oauth_external_client_deny_private ON public.%I '
      || 'AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING ((auth.jwt() ->> ''client_id'') IS NULL) '
      || 'WITH CHECK ((auth.jwt() ->> ''client_id'') IS NULL)',
      protected_table
    );
  END LOOP;
END
$oauth_private_guard$;
