-- Account-private presenter utility, not a canonical evidence or reasoning table.
-- E1: multi-device technical checklist. All writes are RLS-scoped and CAS-guarded.
CREATE TABLE IF NOT EXISTS public.presenter_technical_checklists (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_version text NOT NULL DEFAULT 'technical-checks/2',
  checks jsonb NOT NULL,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presenter_checklist_contract_chk CHECK (contract_version = 'technical-checks/2'),
  CONSTRAINT presenter_checklist_revision_chk CHECK (revision BETWEEN 1 AND 9223372036854775806),
  -- The Data API also exposes authenticated, owner-scoped writes. Enforce
  -- integrity in Postgres; the Next.js route is not a security boundary.
  CONSTRAINT presenter_checklist_bounds_chk CHECK (
    jsonb_typeof(checks) = 'array'
    AND jsonb_array_length(checks) = 13
    AND octet_length(checks::text) <= 24000
    AND jsonb_typeof(history) = 'array'
    AND jsonb_array_length(history) <= 30
    AND octet_length(history::text) <= 16000
  )
);

-- Pure validation: no elevated security, no dynamic SQL or data access.
-- The 13 distinct monitor IDs must match the existing client specification.
CREATE OR REPLACE FUNCTION public.presenter_checklist_valid_json(_checks jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_typeof(_checks) = 'array' AND jsonb_array_length(_checks) = 13
    AND (SELECT count(*) = 13 AND count(DISTINCT c->>'key') = 13
      AND bool_and(
        jsonb_typeof(c) = 'object'
        AND c->>'key' = ANY(ARRAY[
          'dxy-4h','dxy-1d','jxy','us02y-30y','spx-log-channel-rollover',
          'us10y-real','hy-credit','vix','equity-breadth','gold','oil','move-vix','copper-gold'
        ])
        AND c->>'technical' = ANY(ARRAY[
          'Not checked','Holding uptrend','Holding downtrend','Upper-band break',
          'Lower-band break','Strengthening','Weakening','Recovering','Deteriorating',
          'Rangebound','Mixed','Rising channel intact','Rollover watch','Rollover confirmed'
        ])
        AND c->>'lastBreak' = ANY(ARRAY['Not applicable','Not checked','UPPER','LOWER'])
        AND c->>'alignment' = ANY(ARRAY['unassessed','aligned','diverging','mixed'])
        AND length(COALESCE(c->>'fundamentals','')) <= 600
        AND length(COALESCE(c->>'notes','')) <= 700
        AND length(COALESCE(c->>'evidenceUrl','')) <= 700
        AND (COALESCE(c->>'evidenceUrl','') = '' OR c->>'evidenceUrl' ~ '^https://[^[:space:]]+$')
        AND CASE
          WHEN COALESCE(c->>'observedOn','') = '' THEN true
          WHEN c->>'observedOn' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}        AND (COALESCE(c->>'updatedAt','') = '' OR c->>'updatedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T')
      )
      FROM jsonb_array_elements(_checks) AS entries(c)), FALSE
  );
$$;

ALTER TABLE public.presenter_technical_checklists
  ADD CONSTRAINT presenter_checklist_shape_chk
  CHECK (public.presenter_checklist_valid_json(checks));

-- All client-supplied per-monitor timestamps are disregarded at the database
-- boundary. Only the database writes a fresh timestamp for changed monitor
-- readings; unchanged monitor revisions retain their previous DB timestamps.
CREATE OR REPLACE FUNCTION public.presenter_checklist_guard_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_check jsonb;
  v_previous jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_stamp text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'presenter owner is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.revision IS DISTINCT FROM OLD.revision + 1 THEN
      RAISE EXCEPTION 'presenter revision conflict' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.revision IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'first presenter revision must be 1' USING ERRCODE = '23514';
  END IF;

  IF NEW.contract_version IS DISTINCT FROM 'technical-checks/2'
      OR NOT public.presenter_checklist_valid_json(NEW.checks) THEN
    RAISE EXCEPTION 'invalid presenter checklist contract' USING ERRCODE = '23514';
  END IF;

  FOR v_check IN SELECT value FROM jsonb_array_elements(NEW.checks)
  LOOP
    v_previous := NULL;
    IF TG_OP = 'UPDATE' THEN
      SELECT value INTO v_previous FROM jsonb_array_elements(OLD.checks)
        WHERE value->>'key' = v_check->>'key' LIMIT 1;
    END IF;
    IF v_previous IS NOT NULL
      AND (v_previous - 'updatedAt') = (v_check - 'updatedAt') THEN
      v_stamp := COALESCE(v_previous->>'updatedAt','');
    ELSIF COALESCE(v_check->>'observedOn','') = '' THEN
      v_stamp := '';
    ELSE
      v_stamp := to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    END IF;
    v_clean := v_clean || jsonb_build_array(jsonb_set(v_check, '{updatedAt}', to_jsonb(v_stamp), true));
  END LOOP;

  NEW.checks := v_clean;
  NEW.updated_at := v_now;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presenter_checklists_guard_write ON public.presenter_technical_checklists;
CREATE TRIGGER presenter_checklists_guard_write
  BEFORE INSERT OR UPDATE ON public.presenter_technical_checklists
  FOR EACH ROW EXECUTE FUNCTION public.presenter_checklist_guard_write();

ALTER TABLE public.presenter_technical_checklists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.presenter_technical_checklists FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.presenter_technical_checklists TO authenticated;

DROP POLICY IF EXISTS presenter_technical_checklists_select ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_select ON public.presenter_technical_checklists
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ));

DROP POLICY IF EXISTS presenter_technical_checklists_insert ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_insert ON public.presenter_technical_checklists
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ));

DROP POLICY IF EXISTS presenter_technical_checklists_update ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_update ON public.presenter_technical_checklists
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ));
 THEN
            to_char(to_date(c->>'observedOn','YYYY-MM-DD'),'YYYY-MM-DD') = c->>'observedOn'
          ELSE false
        END
        AND (COALESCE(c->>'updatedAt','') = '' OR c->>'updatedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T')
      )
      FROM jsonb_array_elements(_checks) AS entries(c)), FALSE
  );
$$;

ALTER TABLE public.presenter_technical_checklists
  ADD CONSTRAINT presenter_checklist_shape_chk
  CHECK (public.presenter_checklist_valid_json(checks));

-- All client-supplied per-monitor timestamps are disregarded at the database
-- boundary. Only the database writes a fresh timestamp for changed monitor
-- readings; unchanged monitor revisions retain their previous DB timestamps.
CREATE OR REPLACE FUNCTION public.presenter_checklist_guard_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_check jsonb;
  v_previous jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_stamp text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'presenter owner is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.revision IS DISTINCT FROM OLD.revision + 1 THEN
      RAISE EXCEPTION 'presenter revision conflict' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.revision IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'first presenter revision must be 1' USING ERRCODE = '23514';
  END IF;

  IF NEW.contract_version IS DISTINCT FROM 'technical-checks/2'
      OR NOT public.presenter_checklist_valid_json(NEW.checks) THEN
    RAISE EXCEPTION 'invalid presenter checklist contract' USING ERRCODE = '23514';
  END IF;

  FOR v_check IN SELECT value FROM jsonb_array_elements(NEW.checks)
  LOOP
    v_previous := NULL;
    IF TG_OP = 'UPDATE' THEN
      SELECT value INTO v_previous FROM jsonb_array_elements(OLD.checks)
        WHERE value->>'key' = v_check->>'key' LIMIT 1;
    END IF;
    IF v_previous IS NOT NULL
      AND (v_previous - 'updatedAt') = (v_check - 'updatedAt') THEN
      v_stamp := COALESCE(v_previous->>'updatedAt','');
    ELSIF COALESCE(v_check->>'observedOn','') = '' THEN
      v_stamp := '';
    ELSE
      v_stamp := to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    END IF;
    v_clean := v_clean || jsonb_build_array(jsonb_set(v_check, '{updatedAt}', to_jsonb(v_stamp), true));
  END LOOP;

  NEW.checks := v_clean;
  NEW.updated_at := v_now;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presenter_checklists_guard_write ON public.presenter_technical_checklists;
CREATE TRIGGER presenter_checklists_guard_write
  BEFORE INSERT OR UPDATE ON public.presenter_technical_checklists
  FOR EACH ROW EXECUTE FUNCTION public.presenter_checklist_guard_write();

ALTER TABLE public.presenter_technical_checklists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.presenter_technical_checklists FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.presenter_technical_checklists TO authenticated;

DROP POLICY IF EXISTS presenter_technical_checklists_select ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_select ON public.presenter_technical_checklists
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ));

DROP POLICY IF EXISTS presenter_technical_checklists_insert ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_insert ON public.presenter_technical_checklists
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ));

DROP POLICY IF EXISTS presenter_technical_checklists_update ON public.presenter_technical_checklists;
CREATE POLICY presenter_technical_checklists_update ON public.presenter_technical_checklists
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_access_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND active = true
  ));
