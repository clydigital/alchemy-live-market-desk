-- Read-only verification for MRU P2 provenance-complete research graph.
-- Run after P1 and 20260908113000_provenance_complete_research_graph_p2.sql.

begin read only;

do $$
declare
  v_intake_count bigint;
  v_raw_covered bigint;
  v_observation_covered bigint;
  v_untraceable_evidence bigint;
  v_bad_research_evidence bigint;
  v_bad_observation_raw bigint;
  v_bad_derived_evidence bigint;
  v_viewdef text;
begin
  if to_regclass('public.derived_metric_versions') is null then
    raise exception 'P1 dependency missing: derived_metric_versions';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intelligence_evidence'
      and column_name = 'normalised_observation_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intelligence_evidence'
      and column_name = 'derived_metric_version_id'
  ) then
    raise exception 'P2 intelligence_evidence provenance columns are missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'research_intake_items_capture_provenance'
      and not tgisinternal
  ) then
    raise exception 'research_intake_items provenance capture trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'intelligence_evidence_enforce_provenance'
      and not tgisinternal
  ) then
    raise exception 'intelligence_evidence provenance enforcement trigger is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'intelligence_evidence_provenance_required'
      and conrelid = 'public.intelligence_evidence'::regclass
      and convalidated
  ) then
    raise exception 'intelligence_evidence provenance check is missing or unvalidated';
  end if;

  if to_regclass('public.research_provenance_edges_v1') is null
    or to_regclass('public.research_claim_lineage_v1') is null then
    raise exception 'P2 provenance views are missing';
  end if;

  select count(*) into v_intake_count
  from public.research_intake_items;

  select count(*) into v_raw_covered
  from public.research_intake_items intake
  where exists (
    select 1
    from public.raw_source_records raw
    where raw.intake_item_id = intake.id
      and raw.provider = 'research_intake'
  );

  if v_raw_covered <> v_intake_count then
    raise exception 'Raw provenance backfill incomplete: %/% intake items covered', v_raw_covered, v_intake_count;
  end if;

  select count(*) into v_observation_covered
  from public.research_intake_items intake
  where exists (
    select 1
    from public.raw_source_records raw
    join public.normalised_observations observation
      on observation.raw_record_id = raw.id
     and observation.observation_type = 'research_intake_claim'
     and observation.subject_type = 'research_intake_item'
     and observation.methodology_version = 'research-intake-provenance-v1'
    where raw.intake_item_id = intake.id
      and raw.provider = 'research_intake'
  );

  if v_observation_covered <> v_intake_count then
    raise exception 'Normalised provenance backfill incomplete: %/% intake items covered', v_observation_covered, v_intake_count;
  end if;

  select count(*) into v_untraceable_evidence
  from public.intelligence_evidence
  where normalised_observation_id is null
    and derived_metric_version_id is null;

  if v_untraceable_evidence <> 0 then
    raise exception '% intelligence Evidence rows have no direct/derived provenance', v_untraceable_evidence;
  end if;

  select count(*) into v_bad_research_evidence
  from public.intelligence_evidence evidence
  left join public.raw_source_records raw
    on raw.id = evidence.raw_source_record_id
  where evidence.external_evidence_id like 'research-intake:%'
    and (
      raw.id is null
      or evidence.external_evidence_id <> 'research-intake:' || raw.intake_item_id::text
    );

  if v_bad_research_evidence <> 0 then
    raise exception '% research-intake Evidence rows point at the wrong raw intake record', v_bad_research_evidence;
  end if;

  select count(*) into v_bad_observation_raw
  from public.intelligence_evidence evidence
  join public.normalised_observations observation
    on observation.id = evidence.normalised_observation_id
  where evidence.raw_source_record_id is distinct from observation.raw_record_id;

  if v_bad_observation_raw <> 0 then
    raise exception '% Evidence rows have direct observations owned by a different raw record', v_bad_observation_raw;
  end if;

  select count(*) into v_bad_derived_evidence
  from public.intelligence_evidence evidence
  join public.derived_metric_versions metric
    on metric.id = evidence.derived_metric_version_id
  where cardinality(metric.input_observation_ids) = 0
     or (
       evidence.normalised_observation_id is not null
       and not (evidence.normalised_observation_id = any(metric.input_observation_ids))
     );

  if v_bad_derived_evidence <> 0 then
    raise exception '% derived Evidence rows have incomplete or inconsistent observation lineage', v_bad_derived_evidence;
  end if;

  select pg_get_viewdef('public.research_provenance_edges_v1'::regclass, true)
  into v_viewdef;

  if v_viewdef not like '%research_intake_item%'
    or v_viewdef not like '%raw_source_record%'
    or v_viewdef not like '%normalised_observation%'
    or v_viewdef not like '%derived_metric_version%'
    or v_viewdef not like '%intelligence_evidence%'
    or v_viewdef not like '%story_thesis_version%'
    or v_viewdef not like '%asset_entity%'
    or v_viewdef not like '%topic_entity%' then
    raise exception 'research_provenance_edges_v1 does not expose the complete P2 graph';
  end if;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('research_provenance_edges_v1', 'research_claim_lineage_v1')
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'P2 provenance views must remain server-side only';
  end if;
end
$$;

select
  (select count(*) from public.research_intake_items) as intake_items,
  (select count(*) from public.raw_source_records where provider = 'research_intake') as research_intake_raw_versions,
  (select count(*) from public.normalised_observations where methodology_version = 'research-intake-provenance-v1') as research_intake_observation_versions,
  (select count(*) from public.intelligence_evidence) as intelligence_evidence,
  (select count(*) from public.intelligence_evidence where normalised_observation_id is not null) as evidence_with_direct_observation,
  (select count(*) from public.intelligence_evidence where derived_metric_version_id is not null) as evidence_with_derived_metric;

select relationship, count(*) as edge_count
from public.research_provenance_edges_v1
group by relationship
order by relationship;

commit;
