-- Blue Desk P-1: anonymous RPC hardening. The three functions below are
-- SECURITY DEFINER and currently executable by anon/authenticated, including
-- two functions that mutate internal research state. Neither Live nor Hybrid
-- calls these from public clients. The intelligence stage claimer is invoked
-- only through the server-side service-role adapter.
--
-- REVOKE FROM PUBLIC is necessary where the function has a PUBLIC EXECUTE
-- grant; revoking direct role grants alone leaves inherited access open.
-- Existing service_role / postgres grants and event trigger remain unchanged.
BEGIN;
REVOKE EXECUTE ON FUNCTION
  public.claim_intelligence_stage(uuid,text,uuid,jsonb,integer),
  public.refresh_research_debt(),
  public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_intelligence_stage(uuid,text,uuid,jsonb,integer),
  public.refresh_research_debt(),
  public.rls_auto_enable()
  TO service_role;
COMMIT;
