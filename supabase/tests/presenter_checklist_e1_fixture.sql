-- Isolated PostgreSQL 17 fixture (CI only; never run against Supabase production).
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;

CREATE TABLE public.app_access_allowlist (email text PRIMARY KEY, active boolean NOT NULL);
ALTER TABLE public.app_access_allowlist ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_access_allowlist TO authenticated;
CREATE POLICY allow_account_email ON public.app_access_allowlist
  FOR SELECT TO authenticated
  USING (active = true AND email = lower(auth.jwt()->>'email'));

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.app_access_allowlist(email,active)
VALUES ('presenter-a@example.com',true), ('presenter-b@example.com',true);
