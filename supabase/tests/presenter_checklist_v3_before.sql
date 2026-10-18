\set ON_ERROR_STOP on
-- Pre-v3 fixture: create a real server-stamped update and nonempty user history
-- then snapshot all v2 fields for byte-exact preservation comparison.
UPDATE public.presenter_technical_checklists
  SET revision = revision + 1,
      history = jsonb_build_array(jsonb_build_object(
        'key','oil','title','Oil · Inflation and supply risk',
        'technical','Strengthening','alignment','mixed',
        'observedOn','2026-10-14','updatedAt','2026-10-14T10:00:00Z'
      ))
  WHERE user_id='11111111-1111-4111-8111-111111111111';
CREATE TEMP TABLE presenter_v2_before AS
 SELECT user_id, contract_version, revision, updated_at, checks, history
 FROM public.presenter_technical_checklists;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM presenter_v2_before
 WHERE revision=3 AND jsonb_array_length(checks)=13 AND jsonb_array_length(history)=1)
 THEN RAISE EXCEPTION 'v3 fixture failed to preserve a real v2 saved user'; END IF;
END $$;
