begin;

-- Portable contract check: production does not need the pgTAP extension just
-- to verify the additive intelligence schema.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'intelligence_evidence',
    'intelligence_evidence_sources',
    'intelligence_source_ancestry_groups',
    'intelligence_entities',
    'intelligence_entity_relationships',
    'intelligence_evidence_rooms',
    'intelligence_evidence_room_items',
    'intelligence_evidence_entities',
    'intelligence_market_beliefs',
    'intelligence_divergences',
    'intelligence_hypotheses',
    'intelligence_challenger_assessments',
    'intelligence_scenarios',
    'intelligence_hypothesis_evidence',
    'intelligence_story_candidates',
    'intelligence_story_states',
    'intelligence_story_relations',
    'intelligence_novelty_memory',
    'intelligence_story_history',
    'intelligence_reevaluation_queue',
    'intelligence_prompt_versions',
    'intelligence_engine_runs',
    'intelligence_stage_runs',
    'intelligence_acquisition_failures',
    'macro_release_metrics'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'missing intelligence contract table: %', table_name;
    end if;
  end loop;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intelligence_engine_runs'
      and column_name = 'run_key'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'intelligence_engine_runs.run_key must exist as a non-null text column';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
     and attribute_row.attnum = constraint_row.conkey[1]
    where constraint_row.conrelid = 'public.intelligence_engine_runs'::regclass
      and constraint_row.contype = 'u'
      and array_length(constraint_row.conkey, 1) = 1
      and attribute_row.attname = 'run_key'
  ) then
    raise exception 'intelligence_engine_runs.run_key must have a unique constraint usable by on_conflict=run_key';
  end if;
end;
$$;

rollback;
