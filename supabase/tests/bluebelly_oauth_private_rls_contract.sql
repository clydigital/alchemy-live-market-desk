-- Pooled CI role-level check. Runs only against the disposable Postgres
-- fixture, NEVER live Supabase. No owner email or access token is needed.
BEGIN;

DO $verify_definition$
DECLARE
  private_table text;
  guard_predicate text;
  guard_check text;
  guard_count integer;
  policy_mode text;
BEGIN
  FOREACH private_table IN ARRAY ARRAY[
    'app_access_allowlist','catalyst_reviews','decision_snapshots',
    'evidence_reviews','hybrid_publication_snapshots','journey_step_states',
    'market_motion_items','presenter_technical_checklists',
    'record_revisions','research_journeys','story_events',
    'story_thesis_versions'
  ] LOOP
    SELECT count(*), max(permissive), max(qual), max(with_check)
    INTO guard_count, policy_mode, guard_predicate, guard_check
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename=private_table
      AND policyname='oauth_external_client_deny_private'
      AND cmd='ALL'
      AND roles @> ARRAY['authenticated']::name[];

    IF guard_count <> 1
      OR policy_mode <> 'RESTRICTIVE'
      OR guard_predicate NOT LIKE '%client_id%'
      OR guard_predicate NOT LIKE '%IS NULL%'
      OR guard_check NOT LIKE '%client_id%'
      OR guard_check NOT LIKE '%IS NULL%'
    THEN
      RAISE EXCEPTION 'OAuth isolation policy missing or invalid for %', private_table;
    END IF;
  END LOOP;

  -- Use the actual generated guard expression from a protected owner table
  -- on the single-row CI probe, so the runtime check tests the real expression.
  SELECT pg_get_expr(p.polqual,p.polrelid),
         pg_get_expr(p.polwithcheck,p.polrelid)
  INTO guard_predicate,guard_check
  FROM pg_policy p
  JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname='story_thesis_versions'
    AND p.polname='oauth_external_client_deny_private';

  EXECUTE format(
    'CREATE POLICY ci_private_oauth_deny ON public.oauth_private_probe '
    || 'AS RESTRICTIVE FOR ALL TO authenticated '
    || 'USING (%s) WITH CHECK (%s)',
    guard_predicate,guard_check
  );
END
$verify_definition$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';

DO $direct_session$
BEGIN
  IF (SELECT count(*) FROM public.oauth_private_probe) <> 1 THEN
    RAISE EXCEPTION 'Direct browser session unexpectedly denied';
  END IF;
END
$direct_session$;

SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","client_id":"outside-chatgpt-client"}';

DO $oauth_denial$
BEGIN
  IF (SELECT count(*) FROM public.oauth_private_probe) <> 0 THEN
    RAISE EXCEPTION 'External OAuth client escaped private RLS';
  END IF;
END
$oauth_denial$;

SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","client_id":""}';

DO $empty_client_claim$
BEGIN
  IF (SELECT count(*) FROM public.oauth_private_probe) <> 0 THEN
    RAISE EXCEPTION 'Empty present client_id must still be denied';
  END IF;
END
$empty_client_claim$;

RESET ROLE;
ROLLBACK;
