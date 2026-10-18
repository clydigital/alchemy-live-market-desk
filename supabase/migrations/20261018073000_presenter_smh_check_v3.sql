-- Add SMH/QQQ as the 14th manual presenter observation (non-canonical).
-- Requires coordinated database-first deployment of the v3 UI/API.
-- Preserve every v2 item, user history, revision, updated_at and per-item
-- updatedAt. Do not run the old client/API against this version after cutover.
BEGIN;
LOCK TABLE public.presenter_technical_checklists IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.presenter_technical_checklists
   WHERE contract_version <> 'technical-checks/2'
      OR jsonb_typeof(checks) <> 'array'
      OR jsonb_array_length(checks) <> 13
      OR NOT public.presenter_checklist_valid_json(checks)
 ) THEN
   RAISE EXCEPTION 'presenter v3 migration preflight: unexpected v2 row'
     USING ERRCODE = '23514';
 END IF;
END;
$$;

DROP TRIGGER IF EXISTS presenter_checklists_guard_write
 ON public.presenter_technical_checklists;

ALTER TABLE public.presenter_technical_checklists
 DROP CONSTRAINT IF EXISTS presenter_checklist_shape_chk,
 DROP CONSTRAINT IF EXISTS presenter_checklist_bounds_chk,
 DROP CONSTRAINT IF EXISTS presenter_checklist_contract_chk;

-- Pure validation: no elevated security, no dynamic SQL or data access.
-- The 14 distinct monitor IDs must match the existing client specification.
CREATE OR REPLACE FUNCTION public.presenter_checklist_valid_json(_checks jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_typeof(_checks) = 'array' AND jsonb_array_length(_checks) = 14
    AND (SELECT count(*) = 14 AND count(DISTINCT c->>'key') = 14
      AND bool_and(
        jsonb_typeof(c) = 'object'
        AND c->>'key' = ANY(ARRAY[
          'dxy-4h','dxy-1d','jxy','us02y-30y','spx-log-channel-rollover','smh-qqq',
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
          WHEN c->>'observedOn' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN
            to_char(to_date(c->>'observedOn','YYYY-MM-DD'),'YYYY-MM-DD') = c->>'observedOn'
          ELSE false
        END
        AND (COALESCE(c->>'updatedAt','') = '' OR c->>'updatedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T')
      )
      FROM jsonb_array_elements(_checks) AS entries(c)), FALSE
  );
$$;


-- Append a new, explicitly undated SMH manual reading. Existing rows and their
-- history remain byte-equivalent in their original JSON array order.
UPDATE public.presenter_technical_checklists
SET checks = checks || jsonb_build_array(jsonb_build_object(
    'key','smh-qqq',
    'title','SMH / QQQ · Relative leadership and EMA band',
    'group','Core',
    'technical','Not checked',
    'lastBreak','Not applicable',
    'observedOn','',
    'fundamentals','',
    'alignment','unassessed',
    'evidenceUrl','',
    'notes','',
    'updatedAt',''
  )),
  contract_version = 'technical-checks/3'
WHERE contract_version = 'technical-checks/2';

ALTER TABLE public.presenter_technical_checklists
 ALTER COLUMN contract_version SET DEFAULT 'technical-checks/3',
 ADD CONSTRAINT presenter_checklist_contract_chk
   CHECK (contract_version = 'technical-checks/3'),
 ADD CONSTRAINT presenter_checklist_bounds_chk
   CHECK (
     jsonb_typeof(checks) = 'array'
     AND jsonb_array_length(checks) = 14
     AND octet_length(checks::text) <= 24000
     AND jsonb_typeof(history) = 'array'
     AND jsonb_array_length(history) <= 30
     AND octet_length(history::text) <= 16000
   ),
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

  IF NEW.contract_version IS DISTINCT FROM 'technical-checks/3'
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


CREATE TRIGGER presenter_checklists_guard_write
 BEFORE INSERT OR UPDATE ON public.presenter_technical_checklists
 FOR EACH ROW EXECUTE FUNCTION public.presenter_checklist_guard_write();

-- Fail the transaction if migration did not produce a complete, correct
-- account-private checklist; no row may be left with v2 or 13 items.
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.presenter_technical_checklists
   WHERE contract_version <> 'technical-checks/3'
      OR jsonb_array_length(checks) <> 14
      OR NOT public.presenter_checklist_valid_json(checks)
 ) THEN
  RAISE EXCEPTION 'presenter v3 migration postcondition failed'
    USING ERRCODE = '23514';
 END IF;
END;
$$;
COMMIT;
