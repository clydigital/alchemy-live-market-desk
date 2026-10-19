-- P-1 defence-in-depth: stop automatic Data API grants on FUTURE
-- public tables / sequences created by migrations running as postgres.
--
-- Current objects and RLS policies are unchanged. New API contracts must
-- grant specific privileges explicitly alongside their RLS policies.
-- Keep service_role's platform default for canonical writers and automation.
--
-- Supabase's superuser-owned supabase_admin defaults are NOT modified here:
-- postgres is not a member of that role in production. That requires a
-- separately authorised Supabase platform/security-admin action (#849).
--
-- Function EXECUTE defaults are deliberately not changed here. PostgreSQL's
-- global PUBLIC EXECUTE inheritance and internal RPC compatibility need a
-- separate review; the three known high-risk functions are addressed in #852.
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
COMMIT;
