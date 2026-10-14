\set ON_ERROR_STOP on

-- RLS user A: valid allowlisted account, insert a complete 13-key checklist.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"email":"presenter-a@example.com"}',true);

INSERT INTO public.presenter_technical_checklists
  (user_id,contract_version,checks,history,revision)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'technical-checks/2',
  (SELECT jsonb_agg(jsonb_build_object(
    'key',key,
    'title', key,
    'group','Core',
    'technical','Holding uptrend',
    'lastBreak','Not checked',
    'observedOn','2026-10-14',
    'fundamentals','Manual presenter observation',
    'alignment','unassessed',
    'evidenceUrl','',
    'notes','',
    'updatedAt','2099-01-01T00:00:00Z'
  ) ORDER BY ord)
   FROM unnest(ARRAY[
     'dxy-4h','dxy-1d','jxy','us02y-30y','spx-log-channel-rollover',
     'us10y-real','hy-credit','vix','equity-breadth','gold','oil','move-vix','copper-gold'
   ]) WITH ORDINALITY AS t(key,ord)),
  '[]'::jsonb, 1
);

DO $$
DECLARE row_count bigint;
DECLARE stored_stamp text;
BEGIN
  SELECT count(*), min(checks->0->>'updatedAt') INTO row_count, stored_stamp
    FROM public.presenter_technical_checklists;
  IF row_count <> 1 THEN
    RAISE EXCEPTION 'Owner could not read own checklist';
  END IF;
  IF stored_stamp = '2099-01-01T00:00:00Z' OR stored_stamp = '' THEN
    RAISE EXCEPTION 'Database accepted forged freshness timestamp or omitted genuine new stamp';
  END IF;

  BEGIN
    UPDATE public.presenter_technical_checklists
      SET revision = revision + 1, checks = '[]'::jsonb
      WHERE user_id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'Invalid empty checklist succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.presenter_technical_checklists
      SET revision = 9
      WHERE user_id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'Invalid CAS revision succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.presenter_technical_checklists
      SET revision = revision + 1,
          checks = jsonb_set(checks,'{0,observedOn}',to_jsonb('2026-02-30'::text))
      WHERE user_id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'Invalid civil date succeeded';
  EXCEPTION WHEN check_violation OR datetime_field_overflow THEN NULL;
  END;

  UPDATE public.presenter_technical_checklists SET revision=revision+1
    WHERE user_id='11111111-1111-4111-8111-111111111111';
  IF (SELECT revision FROM public.presenter_technical_checklists
      WHERE user_id='11111111-1111-4111-8111-111111111111') <> 2 THEN
    RAISE EXCEPTION 'Valid revision increment failed';
  END IF;
END $$;
COMMIT;

-- Account B cannot read account A even if B is allowlisted.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims','{"email":"presenter-b@example.com"}',true);
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.presenter_technical_checklists) THEN
    RAISE EXCEPTION 'RLS exposed account A data to account B';
  END IF;
END $$;
COMMIT;

-- Account C not on allowlist cannot even insert a valid clone.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT set_config('request.jwt.claims','{"email":"unapproved@example.com"}',true);
DO $$
DECLARE payload jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM public.presenter_technical_checklists) THEN
    RAISE EXCEPTION 'RLS exposed another account to unapproved user';
  END IF;
  SELECT checks INTO payload FROM public.presenter_technical_checklists LIMIT 1;
  -- A nonallowlisted user sees no rows; attempt to clone the schema-valid
  -- owner A payload from an explicitly constructed 13-key data set instead.
  SELECT jsonb_agg(jsonb_build_object(
    'key',key,'title',key,'group','Core','technical','Not checked',
    'lastBreak','Not checked','observedOn','','fundamentals','',
    'alignment','unassessed','evidenceUrl','','notes','','updatedAt',''
  )) INTO payload FROM unnest(ARRAY[
    'dxy-4h','dxy-1d','jxy','us02y-30y','spx-log-channel-rollover',
    'us10y-real','hy-credit','vix','equity-breadth','gold','oil','move-vix','copper-gold'
  ]) AS t(key);
  BEGIN
    INSERT INTO public.presenter_technical_checklists
      (user_id,checks,history,revision)
      VALUES ('33333333-3333-4333-8333-333333333333',payload,'[]'::jsonb,1);
    RAISE EXCEPTION 'Nonallowlisted insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

-- Anonymous access cannot read a table with RLS and no anon grants.
BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.presenter_technical_checklists;
    RAISE EXCEPTION 'Anonymous SELECT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

\echo 'PASS: presenter E1 SQL migration, RLS isolation, owner CAS, JSON bounds, timestamp protection'
