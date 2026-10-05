begin;

do $$
declare
  story_id_value uuid := '11111111-1111-4111-8111-111111111111';
  version_id_value uuid := '77000000-0000-4000-8000-000000000001';
  stale_run_id uuid := '78000000-0000-4000-8000-000000000001';
  fresh_run_id uuid := '78000000-0000-4000-8000-000000000002';
  stale_assessment_id uuid := '79000000-0000-4000-8000-000000000001';
  fresh_assessment_id uuid := '79000000-0000-4000-8000-000000000002';
  rejected boolean := false;
  prior_confidence integer;
begin
  insert into public.story_thesis_versions(
    id,story_id,version_number,snapshot,created_at
  ) values (
    version_id_value,
    story_id_value,
    999,
    '{}'::jsonb,
    '2026-10-05T12:00:00Z'
  );

  update public.stories
  set current_thesis_version_id = version_id_value
  where id = story_id_value;

  insert into public.intelligence_engine_runs(id,metadata)
  values (stale_run_id,'{}'::jsonb),(fresh_run_id,'{}'::jsonb);

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids,selected_at
  ) values (
    stale_assessment_id,stale_run_id,gen_random_uuid(),story_id_value,'{}'::uuid[],
    'reinforced','Stale frozen maintenance fixture.','{}'::uuid[],'{}'::uuid[],
    '2026-10-05T11:00:00Z'
  ), (
    fresh_assessment_id,fresh_run_id,gen_random_uuid(),story_id_value,'{}'::uuid[],
    'reinforced','Fresh maintenance fixture.','{}'::uuid[],'{}'::uuid[],
    '2026-10-05T13:00:00Z'
  );

  select confidence into prior_confidence
  from public.stories
  where id = story_id_value;

  perform set_config(
    'alchemy.story_maintenance_context',
    jsonb_build_object('engineRunId',stale_run_id)::text,
    true
  );

  begin
    update public.stories
    set confidence = confidence + 1
    where id = story_id_value;
  exception when others then
    if position('Stale Story maintenance assessment' in sqlerrm) > 0 then
      rejected := true;
    else
      raise;
    end if;
  end;

  perform set_config('alchemy.story_maintenance_context','',true);

  if not rejected then
    raise exception 'B4i allowed stale frozen maintenance to mutate the current Story';
  end if;

  if (select confidence from public.stories where id=story_id_value) <> prior_confidence then
    raise exception 'B4i stale maintenance guard failed to preserve Story state';
  end if;

  perform set_config(
    'alchemy.story_maintenance_context',
    jsonb_build_object('engineRunId',fresh_run_id)::text,
    true
  );

  update public.stories
  set confidence = confidence + 1
  where id = story_id_value;

  perform set_config('alchemy.story_maintenance_context','',true);

  if (select confidence from public.stories where id=story_id_value) <> prior_confidence + 1 then
    raise exception 'B4i rejected maintenance selected after the current canonical version';
  end if;
end;
$$;

rollback;
