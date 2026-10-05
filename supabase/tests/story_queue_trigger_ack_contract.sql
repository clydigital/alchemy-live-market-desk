begin;

do $$
declare
  story_id_value uuid;
  evidence_id_value uuid;
  run_id_value uuid := '74000000-0000-4000-8000-000000000001';
  legacy_run_id_value uuid := '74000000-0000-4000-8000-000000000002';
  queue_id_value uuid := '75000000-0000-4000-8000-000000000001';
  legacy_queue_id_value uuid := '75000000-0000-4000-8000-000000000002';
  assessment_id_value uuid := '76000000-0000-4000-8000-000000000001';
  legacy_assessment_id_value uuid := '76000000-0000-4000-8000-000000000002';
  rejected boolean := false;
begin
  select id into story_id_value
  from public.stories
  order by id
  limit 1;

  select id into evidence_id_value
  from public.intelligence_evidence
  order by id
  limit 1;

  if story_id_value is null or evidence_id_value is null then
    raise exception 'B4e fixture requires one Story and one canonical Evidence row';
  end if;

  insert into public.intelligence_engine_runs(id, metadata)
  values (
    run_id_value,
    jsonb_build_object(
      'frozenInputs',
      jsonb_build_object(
        'storyReviewTargets',
        jsonb_build_array(
          jsonb_build_object(
            'story', jsonb_build_object('id', story_id_value),
            'reviewContext', jsonb_build_object(
              'queueEvidenceIds', jsonb_build_array(evidence_id_value)
            )
          )
        )
      )
    )
  ), (
    legacy_run_id_value,
    jsonb_build_object(
      'frozenInputs',
      jsonb_build_object(
        'storyReviewTargets',
        jsonb_build_array(
          jsonb_build_object(
            'story', jsonb_build_object('id', story_id_value),
            'reviewContext', jsonb_build_object('triggerEvidenceIds', jsonb_build_array(evidence_id_value))
          )
        )
      )
    )
  );

  insert into public.intelligence_reevaluation_queue(
    id,target_kind,target_id,requested_by_evidence_id,reason,status,priority,available_at
  ) values (
    queue_id_value,'story',story_id_value,evidence_id_value,
    'dossier_motion_acceptance:fixture:motion:ACCEPT','processing',95,now()
  ), (
    legacy_queue_id_value,'story',story_id_value,evidence_id_value,
    'legacy_fixture','processing',70,now()
  );

  begin
    insert into public.intelligence_story_assessments(
      id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
      disposition,rationale,evidence_ids,eligible_evidence_ids
    ) values (
      assessment_id_value,run_id_value,gen_random_uuid(),story_id_value,array[queue_id_value],
      'unchanged','Missing trigger acknowledgement fixture.','{}'::uuid[],'{}'::uuid[]
    );
  exception when others then
    if position('acknowledge every queued canonical trigger Evidence ID' in sqlerrm) > 0 then
      rejected := true;
    else
      raise;
    end if;
  end;

  if not rejected then
    raise exception 'B4e accepted an assessment that omitted its queued canonical trigger Evidence';
  end if;

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids
  ) values (
    assessment_id_value,run_id_value,gen_random_uuid(),story_id_value,array[queue_id_value],
    'unchanged','Acknowledged trigger fixture.',array[evidence_id_value],'{}'::uuid[]
  );

  if not exists (
    select 1
    from public.intelligence_story_assessments assessment
    where assessment.id = assessment_id_value
      and evidence_id_value = any(assessment.evidence_ids)
  ) then
    raise exception 'B4e rejected a correctly acknowledged Story trigger';
  end if;

  -- Legacy frozen runs predate queueEvidenceIds. They remain replayable.
  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids
  ) values (
    legacy_assessment_id_value,legacy_run_id_value,gen_random_uuid(),story_id_value,array[legacy_queue_id_value],
    'unchanged','Legacy frozen-target replay fixture.','{}'::uuid[],'{}'::uuid[]
  );

  if not exists (
    select 1 from public.intelligence_story_assessments
    where id = legacy_assessment_id_value
  ) then
    raise exception 'B4e broke legacy frozen Story-target replay compatibility';
  end if;
end;
$$;

rollback;
