\set ON_ERROR_STOP on
-- Run in same psql session as presenter_v2_before; migration must preserve all
-- original 13 objects and order, history, revision and timestamp.
DO $$
DECLARE old_row record; new_row record; original_checks jsonb;
BEGIN
 SELECT * INTO old_row FROM presenter_v2_before
   WHERE user_id='11111111-1111-4111-8111-111111111111';
 SELECT * INTO new_row FROM public.presenter_technical_checklists
   WHERE user_id=old_row.user_id;
 IF old_row.user_id IS NULL OR new_row.user_id IS NULL THEN
   RAISE EXCEPTION 'v3 migration lost the saved checklist';
 END IF;
 SELECT jsonb_agg(value ORDER BY ord) INTO original_checks
 FROM jsonb_array_elements(new_row.checks) WITH ORDINALITY AS row(value,ord)
 WHERE ord<=13;
 IF new_row.contract_version <> 'technical-checks/3'
 OR jsonb_array_length(new_row.checks)<>14
 OR original_checks IS DISTINCT FROM old_row.checks
 OR new_row.history IS DISTINCT FROM old_row.history
 OR new_row.revision IS DISTINCT FROM old_row.revision
 OR new_row.updated_at IS DISTINCT FROM old_row.updated_at THEN
   RAISE EXCEPTION 'v3 migration changed old readings/history/revision/freshness';
 END IF;
 IF new_row.checks->13->>'key' <> 'smh-qqq'
 OR new_row.checks->13->>'technical' <> 'Not checked'
 OR new_row.checks->13->>'observedOn' <> ''
 OR new_row.checks->13->>'updatedAt' <> '' THEN
   RAISE EXCEPTION 'new SMH/QQQ reading must start unassessed and undated';
 END IF;
END $$;

-- A v2 payload cannot overwrite or truncate an account's v3 data.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"email":"presenter-a@example.com"}',true);
DO $$
DECLARE original jsonb; updated jsonb;
BEGIN
 SELECT checks INTO original FROM public.presenter_technical_checklists
 WHERE user_id='11111111-1111-4111-8111-111111111111';
 IF original IS NULL OR jsonb_array_length(original)<>14 THEN
   RAISE EXCEPTION 'owner cannot read v3 data';
 END IF;
 BEGIN
   UPDATE public.presenter_technical_checklists
   SET revision=revision+1,
       checks=(SELECT jsonb_agg(value ORDER BY ord) FROM
         jsonb_array_elements(original) WITH ORDINALITY AS row(value,ord)
         WHERE ord<=13)
   WHERE user_id='11111111-1111-4111-8111-111111111111';
   RAISE EXCEPTION 'v2 truncated payload illegally accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 UPDATE public.presenter_technical_checklists
   SET revision=revision+1,
       checks=jsonb_set(original,'{13,observedOn}',to_jsonb('2026-10-16'::text))
   WHERE user_id='11111111-1111-4111-8111-111111111111';
 SELECT checks INTO updated FROM public.presenter_technical_checklists
 WHERE user_id='11111111-1111-4111-8111-111111111111';
 IF updated->13->>'updatedAt' = '' THEN
   RAISE EXCEPTION 'v3 SMH verified manual save did not get server timestamp';
 END IF;
END $$;
COMMIT;
\echo 'PASS: presenter v3 migration preserves 13 readings/history and protects RLS/CAS with 14 keys'
