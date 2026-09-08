-- MRU P2 canonical entity activation and derived-lineage hardening.
--
-- The intelligence entity tables already exist but production currently has no
-- entities, relationships or Evidence links. Populate only deterministic entity
-- identities already present on canonical Evidence (affected_assets/topics).
-- Do not infer companies, people or causal relationships from free text here.
--
-- P1 also creates derived_metric_versions with explicit input_observation_ids.
-- P2 makes those inputs mandatory and real before a metric may participate in
-- the durable provenance graph.

begin;

create or replace function public.validate_derived_metric_observation_lineage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_distinct_count integer;
  v_existing_count integer;
begin
  if cardinality(new.input_observation_ids) = 0 then
    raise exception 'Derived metric version % requires at least one canonical input observation', new.metric_key
      using errcode = '23514';
  end if;

  select count(distinct input_id)
  into v_distinct_count
  from unnest(new.input_observation_ids) input_id;

  if v_distinct_count <> cardinality(new.input_observation_ids) then
    raise exception 'Derived metric version % contains duplicate input observations', new.metric_key
      using errcode = '23514';
  end if;

  select count(*)
  into v_existing_count
  from public.normalised_observations observation
  where observation.id = any(new.input_observation_ids);

  if v_existing_count <> cardinality(new.input_observation_ids) then
    raise exception 'Derived metric version % references unknown canonical observations', new.metric_key
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_derived_metric_observation_lineage() from public, anon, authenticated;

do $$
declare
  v_invalid bigint;
begin
  select count(*)
  into v_invalid
  from public.derived_metric_versions metric
  where cardinality(metric.input_observation_ids) = 0
     or cardinality(metric.input_observation_ids) <> (
       select count(distinct input_id)
       from unnest(metric.input_observation_ids) input_id
     )
     or cardinality(metric.input_observation_ids) <> (
       select count(*)
       from public.normalised_observations observation
       where observation.id = any(metric.input_observation_ids)
     );

  if v_invalid <> 0 then
    raise exception 'MRU P2 cannot activate: % derived metric versions have incomplete observation lineage', v_invalid;
  end if;
end
$$;

drop trigger if exists derived_metric_versions_validate_inputs on public.derived_metric_versions;
create trigger derived_metric_versions_validate_inputs
before insert on public.derived_metric_versions
for each row execute function public.validate_derived_metric_observation_lineage();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'derived_metric_versions_inputs_required'
      and conrelid = 'public.derived_metric_versions'::regclass
  ) then
    alter table public.derived_metric_versions
      add constraint derived_metric_versions_inputs_required
      check (cardinality(input_observation_ids) > 0);
  end if;
end
$$;

create or replace function public.sync_intelligence_evidence_entities(
  p_evidence_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.intelligence_evidence%rowtype;
  v_value text;
  v_entity_id uuid;
  v_key text;
begin
  select *
  into v_evidence
  from public.intelligence_evidence
  where id = p_evidence_id;

  if not found then
    raise exception 'Unknown intelligence Evidence %', p_evidence_id
      using errcode = '23503';
  end if;

  -- These two roles are deterministic projections of the current canonical
  -- Evidence arrays. Clear only our own links before recreating them so stale
  -- affected-asset/topic links cannot survive a legitimate Evidence update.
  delete from public.intelligence_evidence_entities
  where evidence_id = v_evidence.id
    and relationship_role in ('affected_asset', 'affected_topic');

  foreach v_value in array coalesce(v_evidence.affected_assets, '{}'::text[]) loop
    v_value := btrim(v_value);
    if v_value = '' then
      continue;
    end if;

    v_key := 'asset:' || lower(v_value);
    insert into public.intelligence_entities (
      canonical_key,
      entity_type,
      canonical_name,
      aliases,
      identifiers,
      metadata
    ) values (
      v_key,
      'asset',
      v_value,
      array[v_value],
      jsonb_build_object('marketSymbol', v_value),
      jsonb_build_object('provenanceKind', 'affected_asset')
    )
    on conflict (canonical_key) do nothing;

    select id into v_entity_id
    from public.intelligence_entities
    where canonical_key = v_key;

    insert into public.intelligence_evidence_entities (
      evidence_id,
      entity_id,
      relationship_role,
      salience
    ) values (
      v_evidence.id,
      v_entity_id,
      'affected_asset',
      80
    )
    on conflict do nothing;
  end loop;

  foreach v_value in array coalesce(v_evidence.affected_topics, '{}'::text[]) loop
    v_value := btrim(v_value);
    if v_value = '' then
      continue;
    end if;

    v_key := 'theme:' || lower(v_value);
    insert into public.intelligence_entities (
      canonical_key,
      entity_type,
      canonical_name,
      aliases,
      identifiers,
      metadata
    ) values (
      v_key,
      'theme',
      v_value,
      array[v_value],
      '{}'::jsonb,
      jsonb_build_object('provenanceKind', 'affected_topic')
    )
    on conflict (canonical_key) do nothing;

    select id into v_entity_id
    from public.intelligence_entities
    where canonical_key = v_key;

    insert into public.intelligence_evidence_entities (
      evidence_id,
      entity_id,
      relationship_role,
      salience
    ) values (
      v_evidence.id,
      v_entity_id,
      'affected_topic',
      60
    )
    on conflict do nothing;
  end loop;
end;
$$;

revoke all on function public.sync_intelligence_evidence_entities(uuid) from public, anon, authenticated;
grant execute on function public.sync_intelligence_evidence_entities(uuid) to service_role;

create or replace function public.sync_intelligence_evidence_entities_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_intelligence_evidence_entities(new.id);
  return new;
end;
$$;

revoke all on function public.sync_intelligence_evidence_entities_trigger() from public, anon, authenticated;

drop trigger if exists intelligence_evidence_sync_entities on public.intelligence_evidence;
create trigger intelligence_evidence_sync_entities
after insert or update on public.intelligence_evidence
for each row execute function public.sync_intelligence_evidence_entities_trigger();

-- Deterministically backfill the currently empty entity graph from canonical
-- Evidence arrays. This is intentionally bounded to already-explicit identity;
-- no free-text NER or LLM inference is introduced.
do $$
declare
  v_evidence_id uuid;
begin
  for v_evidence_id in
    select id from public.intelligence_evidence order by created_at, id
  loop
    perform public.sync_intelligence_evidence_entities(v_evidence_id);
  end loop;
end
$$;

-- Replace the first P2 graph projection so entity edges point at the existing
-- canonical entity tables instead of presentation-only asset/topic labels.
create or replace view public.research_provenance_edges_v1
with (security_invoker = true)
as
  select
    'research_intake_item'::text as from_type,
    raw.intake_item_id::text as from_id,
    'raw_source_record'::text as to_type,
    raw.id::text as to_id,
    'captured_as'::text as relationship,
    raw.created_at as recorded_at
  from public.raw_source_records raw
  where raw.intake_item_id is not null

  union all

  select distinct
    'intelligence_evidence_source'::text,
    evidence.source_id::text,
    'raw_source_record'::text,
    evidence.raw_source_record_id::text,
    'source_for'::text,
    evidence.created_at
  from public.intelligence_evidence evidence
  where evidence.raw_source_record_id is not null

  union all

  select
    'raw_source_record'::text,
    observation.raw_record_id::text,
    'normalised_observation'::text,
    observation.id::text,
    'normalised_as'::text,
    observation.created_at
  from public.normalised_observations observation

  union all

  select
    'normalised_observation'::text,
    input_observation_id::text,
    'derived_metric_version'::text,
    metric.id::text,
    'input_to'::text,
    metric.created_at
  from public.derived_metric_versions metric
  cross join lateral unnest(metric.input_observation_ids) input_observation_id

  union all

  select
    'normalised_observation'::text,
    evidence.normalised_observation_id::text,
    'intelligence_evidence'::text,
    evidence.id::text,
    'supports_direct_claim'::text,
    evidence.created_at
  from public.intelligence_evidence evidence
  where evidence.normalised_observation_id is not null

  union all

  select
    'derived_metric_version'::text,
    evidence.derived_metric_version_id::text,
    'intelligence_evidence'::text,
    evidence.id::text,
    'supports_derived_claim'::text,
    evidence.created_at
  from public.intelligence_evidence evidence
  where evidence.derived_metric_version_id is not null

  union all

  select
    'intelligence_evidence'::text,
    link.evidence_id::text,
    'canonical_entity'::text,
    link.entity_id::text,
    link.relationship_role,
    link.created_at
  from public.intelligence_evidence_entities link

  union all

  select
    'canonical_entity'::text,
    relationship.from_entity_id::text,
    'canonical_entity'::text,
    relationship.to_entity_id::text,
    relationship.relationship_type,
    relationship.created_at
  from public.intelligence_entity_relationships relationship

  union all

  select
    'intelligence_evidence'::text,
    link.evidence_id::text,
    'story'::text,
    link.story_id::text,
    'linked_to_story'::text,
    link.linked_at
  from public.intelligence_story_evidence link

  union all

  select
    'intelligence_evidence'::text,
    evidence.id::text,
    'story_claim'::text,
    version.id::text || ':' || coalesce(claim.value ->> 'id', 'claim-' || substr(md5(claim.value::text), 1, 16)),
    'supports_story_claim'::text,
    version.created_at
  from public.story_thesis_versions version
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(version.snapshot -> 'reasoning' -> 'claims') = 'array'
        then version.snapshot -> 'reasoning' -> 'claims'
      else '[]'::jsonb
    end
  ) claim(value)
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(claim.value -> 'evidenceIds') = 'array'
        then claim.value -> 'evidenceIds'
      else '[]'::jsonb
    end
  ) evidence_ref(evidence_id)
  join public.intelligence_evidence evidence
    on evidence.id::text = evidence_ref.evidence_id

  union all

  select
    'story_claim'::text,
    version.id::text || ':' || coalesce(claim.value ->> 'id', 'claim-' || substr(md5(claim.value::text), 1, 16)),
    'story_thesis_version'::text,
    version.id::text,
    'recorded_in'::text,
    version.created_at
  from public.story_thesis_versions version
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(version.snapshot -> 'reasoning' -> 'claims') = 'array'
        then version.snapshot -> 'reasoning' -> 'claims'
      else '[]'::jsonb
    end
  ) claim(value)

  union all

  select
    'story_thesis_version'::text,
    version.id::text,
    'story'::text,
    version.story_id::text,
    'version_of'::text,
    version.created_at
  from public.story_thesis_versions version;

revoke all on table public.research_provenance_edges_v1 from public, anon, authenticated;
grant select on table public.research_provenance_edges_v1 to service_role;

comment on function public.sync_intelligence_evidence_entities(uuid) is
  'Deterministically maps explicit intelligence Evidence affected_assets/topics onto the canonical intelligence entity graph; performs no free-text inference.';
comment on function public.validate_derived_metric_observation_lineage() is
  'Rejects derived metric versions whose canonical input_observation_ids are empty, duplicated or missing from normalised_observations.';

commit;
