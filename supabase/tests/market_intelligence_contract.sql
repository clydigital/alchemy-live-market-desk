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
end;
$$;

rollback;
