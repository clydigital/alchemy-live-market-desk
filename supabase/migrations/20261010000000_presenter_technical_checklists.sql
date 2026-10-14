-- Migration: Dedicated presenter-owned technical checklist persistence
-- Contract: technical-checks/2

CREATE TABLE IF NOT EXISTS public.presenter_technical_checklists (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_version text NOT NULL DEFAULT 'technical-checks/2',
  checks jsonb NOT NULL,
  history jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presenter_technical_checklists_checks_length CHECK (jsonb_array_length(checks) = 13),
  CONSTRAINT presenter_technical_checklists_history_length CHECK (jsonb_array_length(history) <= 30)
);

-- Always enable RLS
ALTER TABLE public.presenter_technical_checklists ENABLE ROW LEVEL SECURITY;

-- Anonymous and public grants are revoked
REVOKE ALL ON public.presenter_technical_checklists FROM anon, public;

-- Grant required row operations to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.presenter_technical_checklists TO authenticated;

-- RLS Policies requiring authenticated user_id match and active app_access_allowlist entry
DROP POLICY IF EXISTS presenter_technical_checklists_select ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_select
  ON public.presenter_technical_checklists
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.app_access_allowlist
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND active = true
    )
  );

DROP POLICY IF EXISTS presenter_technical_checklists_insert ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_insert
  ON public.presenter_technical_checklists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.app_access_allowlist
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND active = true
    )
  );

DROP POLICY IF EXISTS presenter_technical_checklists_update ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_update
  ON public.presenter_technical_checklists
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.app_access_allowlist
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND active = true
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.app_access_allowlist
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND active = true
    )
  );
