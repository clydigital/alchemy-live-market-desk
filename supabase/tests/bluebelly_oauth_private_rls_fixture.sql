-- Test-only CI subset of owner-private tables, plus a live policy-equivalence
-- probe. This file MUST NOT be included in production migrations.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;

DO $ci_private$
DECLARE
  named_table text;
BEGIN
  FOREACH named_table IN ARRAY ARRAY[
    'app_access_allowlist','catalyst_reviews','decision_snapshots',
    'evidence_reviews','hybrid_publication_snapshots','journey_step_states',
    'market_motion_items','presenter_technical_checklists',
    'record_revisions','research_journeys','story_events',
    'story_thesis_versions'
  ] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (id integer)', named_table);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', named_table);
  END LOOP;
END
$ci_private$;

CREATE TABLE public.oauth_private_probe (id integer PRIMARY KEY);
INSERT INTO public.oauth_private_probe (id) VALUES (1);
ALTER TABLE public.oauth_private_probe ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.oauth_private_probe TO authenticated;
CREATE POLICY ci_direct_owner_read ON public.oauth_private_probe
  FOR SELECT TO authenticated USING (true);
