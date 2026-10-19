-- The two legacy research views have owner-executed semantics and inherited
-- visitor table grants even though their underlying research ledger tables
-- have no anonymous SELECT policy. Restrict the views without modifying
-- the source ledger, its existing authenticated policies or canonical records.
BEGIN;
ALTER VIEW public.research_story_completeness SET (security_invoker = true);
ALTER VIEW public.research_debt_queue SET (security_invoker = true);

REVOKE ALL PRIVILEGES ON TABLE
  public.research_story_completeness,
  public.research_debt_queue
  FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.research_story_completeness,
  public.research_debt_queue
  TO service_role;
COMMIT;
