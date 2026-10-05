begin;

do $$
declare
  story_id_value uuid;
  evidence_id_value uuid;
  owner_run_id uuid := '77000000-0000-4000-8000-000000000001';
  other_run_id uuid := '77000000-0000-4000-8000-000000000002';
  legacy_run_id uuid := '77000000-0000-4000-8000-000000000003';
  queue_id_value uuid := '78000000-0000-4000-8000-000000000001';
  legacy_queue_id uuid := '78000000-0000-4000-8000-000000000002';
  assessment_id uuid := '79000000-0000-4000-8000-000000000001';
  legacy_assessment_id uuid := '79000000-0000-4000-8000-000000000002';
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
    raise exception 'B4l fixture requires one Story and one canonical Evidence row';
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
    other_run_id,95,now()
  ),
  (
    legacy_queue_id,'story',story_id_value,evidence_id_value,
    'legacy_fixture','processing',
    other_run_id,70,now()
  );

  begin
    insert into public.intelligence_story_assessments(
      id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
      disposition,rationale,evidence_ids,eligible_evidence_ids
    ) values (
      assessment_id,owner_run_id,gen_random_uuid(),story_id_value,array[queue_id_value],
      'unchanged','Correct Evidence but queue owned by another run.',
      array[evidence_id_value],'{}'::uuid[]
    );
  exception when others then
    if position('processing and claimed by the same engine run' in sqlerrm) > 0 then
      rejected := true;
    else
      raise;
    end if;
  end;

  if not rejected then
    raise exception 'B4l accepted a Story assessment against a queue owned by another engine run';
  end if;

  update public.intelligence_reevaluation_queue
  set claimed_by_engine_run_id = owner_run_id
  where id = queue_id_value;

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids
  ) values (
    assessment_id,owner_run_id,gen_random_uuid(),story_id_value,array[queue_id_value],
    'unchanged','Queue and canonical Evidence are owned by this engine run.',
    array[evidence_id_value],'{}'::uuid[]
  );

  if not exists (
    select 1
    from public.intelligence_story_assessments assessment
    where assessment.id = assessment_id
      and assessment.engine_run_id = owner_run_id
  ) then
    raise exception 'B4l rejected a fully owned Story assessment';
  end if;

  -- Status is part of ownership: a completed/pending queue is not an active
  -- obligation even if claimed_by_engine_run_id still happens to match.
  delete from public.intelligence_story_assessments where id = assessment_id;
  update public.intelligence_reevaluation_queue
  set status = 'pending'
  where id = queue_id_value;

  rejected := false;
  begin
    insert into public.intelligence_story_assessments(
      id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
      disposition,rationale,evidence_ids,eligible_evidence_ids
    ) values (
      assessment_id,owner_run_id,gen_random_uuid(),story_id_value,array[queue_id_value],
      'unchanged','Queue is not processing.',
      array[evidence_id_value],'{}'::uuid[]
    );
  exception when others then
    if position('processing and claimed by the same engine run' in sqlerrm) > 0 then
      rejected := true;
    else
      raise;
    end if;
  end;

  if not rejected then
    raise exception 'B4l accepted a Story assessment against a non-processing queue';
  end if;

  -- Legacy frozen targets predate queueEvidenceIds. Preserve exact replay
  -- compatibility even when the legacy queue belongs to another run.
  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids
  ) values (
    legacy_assessment_id,legacy_run_id,gen_random_uuid(),story_id_value,array[legacy_queue_id],
    'unchanged','Legacy frozen-target replay fixture.','{}'::uuid[],'{}'::uuid[]
  );

  if not exists (
    select 1
    from public.intelligence_story_assessments
    where id = legacy_assessment_id
  ) then
    raise exception 'B4l broke legacy frozen Story-target replay compatibility';
  end if;
end;
$$;

rollback;
