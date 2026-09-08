begin;

do $$
declare
  observation_id uuid;
  scheduled_evidence_id uuid := '70000000-0000-4000-8000-000000000001';
  material_evidence_id uuid := '70000000-0000-4000-8000-000000000002';
  scheduled_story_id uuid := '71000000-0000-4000-8000-000000000001';
  material_story_id uuid := '71000000-0000-4000-8000-000000000002';
  unchanged_story_id uuid := '71000000-0000-4000-8000-000000000003';
  scheduled_run_id uuid := '72000000-0000-4000-8000-000000000001';
  material_run_id uuid := '72000000-0000-4000-8000-000000000002';
  unchanged_run_id uuid := '72000000-0000-4000-8000-000000000003';
  scheduled_assessment_id uuid := '73000000-0000-4000-8000-000000000001';
  material_assessment_id uuid := '73000000-0000-4000-8000-000000000002';
  unchanged_assessment_id uuid := '73000000-0000-4000-8000-000000000003';
  material_applied_at timestamptz;
begin
  select id into observation_id
  from public.normalised_observations
  order by created_at, id
  limit 1;

  insert into public.stories(id,slug,title,thesis,status,confidence,next_catalyst)
  values
    (scheduled_story_id,'fixture-fed-story','Fixture Fed Story','Existing rates thesis.','develop',50,null),
    (material_story_id,'fixture-material-story','Fixture Material Story','Existing material thesis.','develop',50,null),
    (unchanged_story_id,'fixture-unchanged-story','Fixture Unchanged Story','Existing unchanged thesis.','develop',50,null);

  insert into public.intelligence_story_states(story_id) values
    (scheduled_story_id),(material_story_id),(unchanged_story_id);

  insert into public.intelligence_evidence(
    id,source_id,normalised_observation_id,external_evidence_id,evidence_class,
    claim_text,event_at,published_at,affected_assets,content_hash,provenance_urls,
    structured_payload,normalizer_version
  ) values
    (
      scheduled_evidence_id,
      '22222222-2222-4222-8222-222222222222',
      observation_id,
      'fixture:scheduled-fomc',
      'other',
      'Official schedule for the upcoming FOMC decision.',
      now() + interval '7 days',
      now() + interval '7 days',
      array['US02Y','SPX'],
      repeat('7',64),
      array['https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'],
      jsonb_build_object('evidenceNature','scheduled_event','title','FOMC decision and projections · Scheduled'),
      'fixture-v1'
    ),
    (
      material_evidence_id,
      '22222222-2222-4222-8222-222222222222',
      observation_id,
      'fixture:material-release',
      'official_release',
      'Official release materially changed the existing Story evidence.',
      now(),
      now(),
      array['US02Y'],
      repeat('8',64),
      array['https://example.test/material-release'],
      jsonb_build_object('evidenceNature','event_outcome'),
      'fixture-v1'
    );

  insert into public.intelligence_story_evidence(story_id,evidence_id,evidence_role,weight,rationale)
  values (scheduled_story_id,scheduled_evidence_id,'context',85,'Deterministic canonical asset recruitment.')
  on conflict do nothing;
  insert into public.intelligence_story_evidence(story_id,evidence_id,evidence_role,weight,rationale)
  values (scheduled_story_id,scheduled_evidence_id,'context',85,'Deterministic canonical asset recruitment replay.')
  on conflict do nothing;

  if (select count(*) from public.intelligence_story_evidence
      where story_id=scheduled_story_id and evidence_id=scheduled_evidence_id) <> 1 then
    raise exception 'Story recruitment replay duplicated the canonical Evidence link';
  end if;

  insert into public.intelligence_engine_runs(id,metadata)
  values (
    scheduled_run_id,
    jsonb_build_object('frozenInputs',jsonb_build_object('storyReviewTargets',jsonb_build_array(
      jsonb_build_object(
        'story',jsonb_build_object('id',scheduled_story_id),
        'reviewContext',jsonb_build_object(
          'catalystCandidates',jsonb_build_array(jsonb_build_object(
            'label','FOMC decision and projections · Scheduled · 2026-09-16',
            'catalystRef',scheduled_evidence_id,
            'evidenceNature','scheduled_event'
          )),
          'triggerEvidenceIds',jsonb_build_array(scheduled_evidence_id)
        )
      )
    )))
  ),
  (material_run_id,'{}'::jsonb),
  (unchanged_run_id,'{}'::jsonb);

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,disposition,rationale,
    evidence_ids,eligible_evidence_ids,proposed_updates
  ) values (
    scheduled_assessment_id,scheduled_run_id,gen_random_uuid(),scheduled_story_id,'reinforced',
    'The scheduled event changes urgency, not the thesis.',
    array[scheduled_evidence_id],array[scheduled_evidence_id],
    jsonb_build_object('nextCatalyst',jsonb_build_object(
      'label','FOMC decision and projections · Scheduled · 2026-09-16',
      'catalystRef',scheduled_evidence_id
    ))
  );

  if cardinality((select eligible_evidence_ids from public.intelligence_story_assessments where id=scheduled_assessment_id)) <> 0 then
    raise exception 'Scheduled Evidence remained eligible for material mutation';
  end if;

  perform * from public.apply_intelligence_story_assessment_v2(scheduled_assessment_id);

  if (select material_change_applied from public.intelligence_story_assessments where id=scheduled_assessment_id) then
    raise exception 'Scheduled catalyst was falsely recorded as a material thesis change';
  end if;
  if (select last_material_update_at from public.intelligence_story_states where story_id=scheduled_story_id) is not null then
    raise exception 'Scheduled catalyst advanced material Story freshness';
  end if;
  if (select next_catalyst from public.stories where id=scheduled_story_id)
      <> 'FOMC decision and projections · Scheduled · 2026-09-16' then
    raise exception 'Scheduled catalyst did not update canonical Story urgency state';
  end if;

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,disposition,rationale,
    evidence_ids,eligible_evidence_ids,proposed_updates
  ) values (
    material_assessment_id,material_run_id,gen_random_uuid(),material_story_id,'reinforced',
    'Official evidence materially reinforced the Story.',
    array[material_evidence_id],array[material_evidence_id],'{}'::jsonb
  );
  perform * from public.apply_intelligence_story_assessment_v2(material_assessment_id);

  select applied_at into material_applied_at
  from public.intelligence_story_assessments
  where id=material_assessment_id;
  if not (select material_change_applied from public.intelligence_story_assessments where id=material_assessment_id) then
    raise exception 'Eligible material assessment was not applied';
  end if;
  if (select last_material_update_at from public.intelligence_story_states where story_id=material_story_id)
      is distinct from material_applied_at then
    raise exception 'Applied material assessment did not advance last_material_update_at';
  end if;

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,disposition,rationale,
    evidence_ids,eligible_evidence_ids,proposed_updates
  ) values (
    unchanged_assessment_id,unchanged_run_id,gen_random_uuid(),unchanged_story_id,'unchanged',
    'No material Story change.',array[material_evidence_id],array[material_evidence_id],'{}'::jsonb
  );
  perform * from public.apply_intelligence_story_assessment_v2(unchanged_assessment_id);
  if (select last_material_update_at from public.intelligence_story_states where story_id=unchanged_story_id) is not null then
    raise exception 'Non-material assessment advanced last_material_update_at';
  end if;

  perform * from public.apply_intelligence_story_assessment_v2(material_assessment_id);
  if (select last_material_update_at from public.intelligence_story_states where story_id=material_story_id)
      is distinct from material_applied_at then
    raise exception 'Assessment replay changed the material transition timestamp';
  end if;

  if exists (
    select 1 from public.intelligence_evidence
    where id in (scheduled_evidence_id,material_evidence_id)
      and (normalised_observation_id is null or raw_source_record_id is null)
  ) then
    raise exception 'P1/P2 provenance was not preserved for recruited Evidence';
  end if;
end;
$$;

rollback;
