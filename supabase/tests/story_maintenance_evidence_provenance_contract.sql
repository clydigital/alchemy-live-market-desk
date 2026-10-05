begin;

do $$
declare
  story_id_value uuid;
  eligible_evidence_id uuid;
  considered_only_id uuid := '7d000000-0000-4000-8000-000000000099';
  run_id_value uuid := '7d000000-0000-4000-8000-000000000001';
  legacy_run_id uuid := '7d000000-0000-4000-8000-000000000002';
  assessment_id uuid := '7e000000-0000-4000-8000-000000000001';
  maintenance_context jsonb;
  legacy_context jsonb;
begin
  select id into story_id_value
  from public.stories
  order by id
  limit 1;

  select id into eligible_evidence_id
  from public.intelligence_evidence
  order by id
  limit 1;

  if story_id_value is null or eligible_evidence_id is null then
    raise exception 'B4n fixture requires one Story and one canonical Evidence row';
  end if;

  insert into public.intelligence_engine_runs(id, metadata)
  values (run_id_value, '{}'::jsonb),(legacy_run_id, '{}'::jsonb);

  insert into public.intelligence_story_assessments(
    id,engine_run_id,market_belief_stage_run_id,story_id,queue_ids,
    disposition,rationale,evidence_ids,eligible_evidence_ids
  ) values (
    assessment_id,run_id_value,gen_random_uuid(),story_id_value,'{}'::uuid[],
    'reinforced','Evidence provenance fixture.',
    array[eligible_evidence_id,considered_only_id],
    array[eligible_evidence_id]
  );

  create temporary table b4n_story_probe(
    id uuid primary key
  ) on commit drop;

  insert into b4n_story_probe(id) values (story_id_value);

  create trigger b4n_probe_enrich
  before update on b4n_story_probe
  for each row
  execute function public.enrich_story_maintenance_evidence_context();

  perform set_config(
    'alchemy.story_maintenance_context',
    jsonb_build_object(
      'engineRunId',run_id_value,
      'intelligenceEvidenceIds',jsonb_build_array(eligible_evidence_id,considered_only_id)
    )::text,
    true
  );

  update b4n_story_probe set id=id where id=story_id_value;

  maintenance_context := nullif(
    current_setting('alchemy.story_maintenance_context', true),
    ''
  )::jsonb;

  if maintenance_context -> 'intelligenceEvidenceIds'
      <> jsonb_build_array(eligible_evidence_id,considered_only_id) then
    raise exception 'B4n changed the reviewed Evidence set instead of preserving it';
  end if;

  if maintenance_context -> 'eligibleIntelligenceEvidenceIds'
      <> jsonb_build_array(eligible_evidence_id) then
    raise exception 'B4n did not preserve the exact material-authorising Evidence set';
  end if;

  -- A maintenance caller with no persisted Story assessment keeps its legacy
  -- context unchanged rather than receiving invented eligibility.
  perform set_config(
    'alchemy.story_maintenance_context',
    jsonb_build_object(
      'engineRunId',legacy_run_id,
      'intelligenceEvidenceIds',jsonb_build_array(considered_only_id)
    )::text,
    true
  );

  update b4n_story_probe set id=id where id=story_id_value;

  legacy_context := nullif(
    current_setting('alchemy.story_maintenance_context', true),
    ''
  )::jsonb;

  if legacy_context ? 'eligibleIntelligenceEvidenceIds' then
    raise exception 'B4n invented material-authorising Evidence for a legacy caller';
  end if;
end;
$$;

rollback;
