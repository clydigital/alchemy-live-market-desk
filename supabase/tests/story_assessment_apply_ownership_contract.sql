begin;

do $$
declare
  story_id_value uuid;
  evidence_id_value uuid;
  owner_run_id uuid := '7a000000-0000-4000-8000-000000000001';
  other_run_id uuid := '7a000000-0000-4000-8000-000000000002';
  legacy_run_id uuid := '7a000000-0000-4000-8000-000000000003';
  queue_id_value uuid := '7b000000-0000-4000-8000-000000000001';
  legacy_queue_id uuid := '7b000000-0000-4000-8000-000000000002';
  assessment_id uuid := '7c000000-0000-4000-8000-000000000001';
  legacy_assessment_id uuid := '7c000000-0000-4000-8000-000000000002';
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
    raise exception 'B4m fixture requires one Story and one canonical Evidence row';
  end if;

  insert into public.intelligence_engine_runs(id, metadata)
  values
  (
    owner_run_id,
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
  ),
  (other_run_id, '{}'::jsonb),
  (
    legacy_run_id,
    jsonb_build_object(
      'frozenInputs',
      jsonb_build_object(
        'storyReviewTargets',
        jsonb_build_array(
          jsonb_build_object(
            'story', jsonb_build_object('id', story_id_value),
            'reviewContext', jsonb_build_object(
              'triggerEvidenceIds', jsonb_build_array(evidence_id_value)
            )
          )
        )
      )
    )
  );

  insert into public.intelligence_reevaluation_queue(
    id,target_kind,target_id,requested_by_evidence_id,reason,status,
    claimed_by_engine_run_id,priority,available_at
  ) values
  (
    queue_id_value,'story',story_id_value,evidence_id_value,
    'dossier_motion_acceptance:fixture:motion:ACCEPT','processing',
    owner_run_id,95,now()
  ),
  (
    legacy_queue_id,'story',story_id_value,evidence_id_value,
    'legacy_fixture','processing',
    other_run_id,70,now()
  );

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids
  ) values (
    assessment_id,owner_run_id,gen_random_uuid(),story_id_value,array[queue_id_value],
    'unchanged','Apply-time ownership fixture.',array[evidence_id_value],'{}'::uuid[]
  );

  -- Ownership changes after assessment persistence but before apply.
  update public.intelligence_reevaluation_queue
  set claimed_by_engine_run_id = other_run_id
  where id = queue_id_value;

  begin
    perform * from public.apply_intelligence_story_assessment(assessment_id);
  exception when others then
    if position('lost queue ownership before apply' in sqlerrm) > 0 then
      rejected := true;
    else
      raise;
    end if;
  end;

  if not rejected then
    raise exception 'B4m allowed a Story assessment to apply after queue ownership changed';
  end if;

  if (select applied_at from public.intelligence_story_assessments where id = assessment_id) is not null then
    raise exception 'B4m failed to roll back assessment application after ownership loss';
  end if;

  -- Restore ownership: the same assessment may now apply successfully.
  update public.intelligence_reevaluation_queue
  set claimed_by_engine_run_id = owner_run_id,
      status = 'processing'
  where id = queue_id_value;

  perform * from public.apply_intelligence_story_assessment(assessment_id);

  if (select applied_at from public.intelligence_story_assessments where id = assessment_id) is null then
    raise exception 'B4m rejected apply after queue ownership was restored';
  end if;

  -- Legacy frozen runs predate queueEvidenceIds and remain replayable.
  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids
  ) values (
    legacy_assessment_id,legacy_run_id,gen_random_uuid(),story_id_value,array[legacy_queue_id],
    'unchanged','Legacy apply-time replay fixture.','{}'::uuid[],'{}'::uuid[]
  );

  perform * from public.apply_intelligence_story_assessment(legacy_assessment_id);

  if (select applied_at from public.intelligence_story_assessments where id = legacy_assessment_id) is null then
    raise exception 'B4m broke legacy frozen Story assessment apply compatibility';
  end if;
end;
$$;

rollback;
