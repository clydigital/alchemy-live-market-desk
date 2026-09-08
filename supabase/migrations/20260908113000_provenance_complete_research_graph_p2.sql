-- MRU P2: provenance-complete durable research graph.
--
-- P1 supplies immutable derived_metric_versions. P2 closes the live intake
-- lineage gap by making the canonical research-intake ledger append raw and
-- normalised memory automatically, requiring every intelligence Evidence claim
-- to resolve to either a direct normalised observation or a versioned derived
-- metric, and exposing the resulting chain as deterministic service-side views.
--
-- No presentation, Hybrid, model-stage or Story-synthesis behaviour changes.

begin;

do $$
begin
  if to_regclass('public.derived_metric_versions') is null then
    raise exception 'MRU P2 requires durable research memory P1 (derived_metric_versions) first';
  end if;
end
$$;

alter table public.intelligence_evidence
  add column if not exists normalised_observation_id uuid,
  add column if not exists derived_metric_version_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intelligence_evidence_normalised_observation_id_fkey'
      and conrelid = 'public.intelligence_evidence'::regclass
  ) then
    alter table public.intelligence_evidence
      add constraint intelligence_evidence_normalised_observation_id_fkey
      foreign key (normalised_observation_id)
      references public.normalised_observations(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'intelligence_evidence_derived_metric_version_id_fkey'
      and conrelid = 'public.intelligence_evidence'::regclass
  ) then
    alter table public.intelligence_evidence
      add constraint intelligence_evidence_derived_metric_version_id_fkey
      foreign key (derived_metric_version_id)
      references public.derived_metric_versions(id)
      on delete restrict;
  end if;
end
$$;

create index if not exists intelligence_evidence_normalised_observation_idx
  on public.intelligence_evidence(normalised_observation_id)
  where normalised_observation_id is not null;

create index if not exists intelligence_evidence_derived_metric_version_idx
  on public.intelligence_evidence(derived_metric_version_id)
  where derived_metric_version_id is not null;

-- Canonical snapshot used for raw research-intake memory. Operational retry
-- counters/timestamps are deliberately excluded so a harmless retry does not
-- manufacture a new immutable source version.
create or replace function public.research_intake_provenance_snapshot(
  p_item public.research_intake_items
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select to_jsonb(p_item)
    - array[
        'created_at',
        'updated_at',
        'transcript_attempted_at',
        'transcript_attempt_count',
        'transcript_error_code',
        'transcript_error_message',
        'transcript_http_status',
        'transcript_retryable'
      ]::text[];
$$;

-- Append/reuse one immutable raw snapshot and one deterministic normalised
-- observation for a research_intake_items row. The row remains the mutable
-- operational projection; these records preserve what the research engine saw.
create or replace function public.capture_research_intake_provenance(
  p_intake_item_id uuid
)
returns table(raw_source_record_id uuid, normalised_observation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.research_intake_items%rowtype;
  v_snapshot jsonb;
  v_observation_value jsonb;
  v_content_hash text;
  v_ingestion_key text;
  v_raw_id uuid;
  v_previous_raw_id uuid;
  v_observation_id uuid;
  v_previous_observation_id uuid;
begin
  select *
  into v_item
  from public.research_intake_items
  where id = p_intake_item_id;

  if not found then
    raise exception 'Unknown research intake item %', p_intake_item_id
      using errcode = '23503';
  end if;

  v_snapshot := public.research_intake_provenance_snapshot(v_item);
  v_content_hash := encode(
    extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  v_ingestion_key := 'research-intake:' || v_item.id::text || ':' || v_content_hash;

  select raw.id
  into v_raw_id
  from public.raw_source_records raw
  where raw.ingestion_key = v_ingestion_key
  limit 1;

  if v_raw_id is null then
    select raw.id
    into v_previous_raw_id
    from public.raw_source_records raw
    where raw.intake_item_id = v_item.id
      and raw.provider = 'research_intake'
    order by raw.created_at desc, raw.id desc
    limit 1;

    insert into public.raw_source_records (
      intake_item_id,
      research_run_id,
      supersedes_record_id,
      ingestion_key,
      provider,
      source_url,
      source_type,
      content_type,
      content_hash,
      content_text,
      payload,
      published_at,
      observed_at,
      fetched_at
    ) values (
      v_item.id,
      v_item.run_id,
      v_previous_raw_id,
      v_ingestion_key,
      'research_intake',
      v_item.url,
      v_item.item_type,
      'application/json',
      v_content_hash,
      case
        when v_item.item_type = 'video'
          and v_item.transcript_status = 'ready'
          and nullif(v_item.transcript_text, '') is not null
          then v_item.transcript_text
        else coalesce(nullif(v_item.recontextualized_summary, ''), v_item.summary)
      end,
      v_snapshot,
      v_item.published_at,
      v_item.published_at,
      now()
    )
    on conflict do nothing
    returning id into v_raw_id;

    if v_raw_id is null then
      select raw.id
      into v_raw_id
      from public.raw_source_records raw
      where raw.ingestion_key = v_ingestion_key
      limit 1;
    end if;
  end if;

  if v_raw_id is null then
    raise exception 'Could not resolve immutable raw provenance for intake item %', v_item.id;
  end if;

  v_observation_value := jsonb_build_object(
    'itemId', v_item.id,
    'itemKey', v_item.item_key,
    'itemType', v_item.item_type,
    'publisher', v_item.publisher,
    'title', v_item.title,
    'url', v_item.url,
    'summary', v_item.summary,
    'recontextualizedSummary', v_item.recontextualized_summary,
    'status', v_item.status,
    'recommendedAction', v_item.recommended_action,
    'sourceQuality', v_item.source_quality,
    'relevance', v_item.relevance,
    'novelty', v_item.novelty,
    'materiality', v_item.materiality,
    'candidateScore', v_item.candidate_score,
    'freshnessScore', v_item.freshness_score,
    'affectedStorySlugs', to_jsonb(v_item.affected_story_slugs),
    'divergenceKind', v_item.divergence_kind,
    'divergenceNote', v_item.divergence_note,
    'statsSignal', v_item.stats_signal,
    'newsSignal', v_item.news_signal,
    'evidenceLinks', v_item.evidence_links,
    'claimChecks', v_item.claim_checks,
    'expertNotes', v_item.expert_notes,
    'videoReviewStatus', v_item.video_review_status,
    'transcriptStatus', v_item.transcript_status,
    'transcriptProvider', v_item.transcript_provider,
    'transcriptLanguage', v_item.transcript_language
  );

  select observation.id
  into v_observation_id
  from public.normalised_observations observation
  where observation.raw_record_id = v_raw_id
    and observation.observation_type = 'research_intake_claim'
    and observation.subject_type = 'research_intake_item'
    and observation.subject_key = v_item.item_key
    and observation.observed_at = v_item.published_at
    and observation.methodology_version = 'research-intake-provenance-v1'
  order by observation.created_at desc, observation.id desc
  limit 1;

  if v_observation_id is null then
    select observation.id
    into v_previous_observation_id
    from public.normalised_observations observation
    where observation.observation_type = 'research_intake_claim'
      and observation.subject_type = 'research_intake_item'
      and observation.subject_key = v_item.item_key
      and observation.methodology_version = 'research-intake-provenance-v1'
    order by observation.created_at desc, observation.id desc
    limit 1;

    insert into public.normalised_observations (
      raw_record_id,
      supersedes_observation_id,
      observation_type,
      subject_type,
      subject_key,
      observed_at,
      effective_at,
      value,
      unit,
      confidence,
      is_preliminary,
      methodology_version
    ) values (
      v_raw_id,
      case when v_previous_observation_id = v_observation_id then null else v_previous_observation_id end,
      'research_intake_claim',
      'research_intake_item',
      v_item.item_key,
      v_item.published_at,
      v_item.updated_at,
      v_observation_value,
      null,
      greatest(0, least(100, coalesce(v_item.source_quality, 50))),
      false,
      'research-intake-provenance-v1'
    )
    on conflict do nothing
    returning id into v_observation_id;

    if v_observation_id is null then
      select observation.id
      into v_observation_id
      from public.normalised_observations observation
      where observation.raw_record_id = v_raw_id
        and observation.observation_type = 'research_intake_claim'
        and observation.subject_type = 'research_intake_item'
        and observation.subject_key = v_item.item_key
        and observation.observed_at = v_item.published_at
        and observation.methodology_version = 'research-intake-provenance-v1'
      order by observation.created_at desc, observation.id desc
      limit 1;
    end if;
  end if;

  if v_observation_id is null then
    raise exception 'Could not resolve normalised provenance for intake item %', v_item.id;
  end if;

  raw_source_record_id := v_raw_id;
  normalised_observation_id := v_observation_id;
  return next;
end;
$$;

revoke all on function public.research_intake_provenance_snapshot(public.research_intake_items) from public, anon, authenticated;
revoke all on function public.capture_research_intake_provenance(uuid) from public, anon, authenticated;
grant execute on function public.capture_research_intake_provenance(uuid) to service_role;

create or replace function public.capture_research_intake_provenance_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.capture_research_intake_provenance(new.id);
  return new;
end;
$$;

revoke all on function public.capture_research_intake_provenance_trigger() from public, anon, authenticated;

drop trigger if exists research_intake_items_capture_provenance on public.research_intake_items;
create trigger research_intake_items_capture_provenance
after insert or update on public.research_intake_items
for each row execute function public.capture_research_intake_provenance_trigger();

-- Backfill the current intake ledger before evidence enforcement is activated.
do $$
declare
  v_intake_item_id uuid;
begin
  for v_intake_item_id in
    select id from public.research_intake_items order by created_at, id
  loop
    perform public.capture_research_intake_provenance(v_intake_item_id);
  end loop;
end
$$;

-- Resolve existing research-intake Evidence rows to the exact immutable raw
-- snapshot and normalised claim observation produced above.
with resolved as (
  select
    evidence.id as evidence_id,
    raw.id as raw_source_record_id,
    observation.id as normalised_observation_id
  from public.intelligence_evidence evidence
  join public.research_intake_items intake
    on evidence.external_evidence_id = 'research-intake:' || intake.id::text
  join lateral (
    select candidate.id
    from public.raw_source_records candidate
    where candidate.intake_item_id = intake.id
      and candidate.provider = 'research_intake'
    order by candidate.created_at desc, candidate.id desc
    limit 1
  ) raw on true
  join lateral (
    select candidate.id
    from public.normalised_observations candidate
    where candidate.raw_record_id = raw.id
      and candidate.observation_type = 'research_intake_claim'
      and candidate.subject_type = 'research_intake_item'
      and candidate.methodology_version = 'research-intake-provenance-v1'
    order by candidate.created_at desc, candidate.id desc
    limit 1
  ) observation on true
)
update public.intelligence_evidence evidence
set
  raw_source_record_id = resolved.raw_source_record_id,
  normalised_observation_id = resolved.normalised_observation_id
from resolved
where evidence.id = resolved.evidence_id
  and (
    evidence.raw_source_record_id is distinct from resolved.raw_source_record_id
    or evidence.normalised_observation_id is distinct from resolved.normalised_observation_id
  );

-- Server-side guard used by every writer, not only the current canonicaliser.
-- Research-intake Evidence is auto-linked from its stable external ID. Other
-- Evidence writers must supply either a direct observation or a derived metric.
create or replace function public.enforce_intelligence_evidence_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intake_item_id uuid;
  v_raw_id uuid;
  v_observation_id uuid;
  v_observation_raw_id uuid;
  v_metric_inputs uuid[];
begin
  if new.external_evidence_id like 'research-intake:%' then
    begin
      v_intake_item_id := split_part(new.external_evidence_id, ':', 2)::uuid;
    exception when invalid_text_representation then
      raise exception 'Malformed research-intake evidence ID: %', new.external_evidence_id
        using errcode = '22023';
    end;

    select raw.id, observation.id
    into v_raw_id, v_observation_id
    from public.raw_source_records raw
    join public.normalised_observations observation
      on observation.raw_record_id = raw.id
     and observation.observation_type = 'research_intake_claim'
     and observation.subject_type = 'research_intake_item'
     and observation.methodology_version = 'research-intake-provenance-v1'
    where raw.intake_item_id = v_intake_item_id
      and raw.provider = 'research_intake'
    order by raw.created_at desc, observation.created_at desc
    limit 1;

    if v_raw_id is null or v_observation_id is null then
      perform public.capture_research_intake_provenance(v_intake_item_id);

      select raw.id, observation.id
      into v_raw_id, v_observation_id
      from public.raw_source_records raw
      join public.normalised_observations observation
        on observation.raw_record_id = raw.id
       and observation.observation_type = 'research_intake_claim'
       and observation.subject_type = 'research_intake_item'
       and observation.methodology_version = 'research-intake-provenance-v1'
      where raw.intake_item_id = v_intake_item_id
        and raw.provider = 'research_intake'
      order by raw.created_at desc, observation.created_at desc
      limit 1;
    end if;

    if v_raw_id is null or v_observation_id is null then
      raise exception 'Research-intake Evidence % has no immutable provenance', new.external_evidence_id
        using errcode = '23514';
    end if;

    new.raw_source_record_id := v_raw_id;
    new.normalised_observation_id := v_observation_id;
  end if;

  if new.normalised_observation_id is not null then
    select observation.raw_record_id
    into v_observation_raw_id
    from public.normalised_observations observation
    where observation.id = new.normalised_observation_id;

    if v_observation_raw_id is null then
      raise exception 'Evidence references unknown normalised observation %', new.normalised_observation_id
        using errcode = '23503';
    end if;

    if new.raw_source_record_id is null then
      new.raw_source_record_id := v_observation_raw_id;
    elsif new.raw_source_record_id <> v_observation_raw_id then
      raise exception 'Evidence raw record % does not own normalised observation %',
        new.raw_source_record_id, new.normalised_observation_id
        using errcode = '23514';
    end if;
  end if;

  if new.derived_metric_version_id is not null then
    select metric.input_observation_ids
    into v_metric_inputs
    from public.derived_metric_versions metric
    where metric.id = new.derived_metric_version_id;

    if v_metric_inputs is null or cardinality(v_metric_inputs) = 0 then
      raise exception 'Derived Evidence requires a metric version with explicit input observations: %',
        new.derived_metric_version_id
        using errcode = '23514';
    end if;

    if new.normalised_observation_id is not null
      and not (new.normalised_observation_id = any(v_metric_inputs)) then
      raise exception 'Evidence observation % is not an input to derived metric version %',
        new.normalised_observation_id, new.derived_metric_version_id
        using errcode = '23514';
    end if;
  end if;

  if new.normalised_observation_id is null
    and new.derived_metric_version_id is null then
    raise exception 'Canonical intelligence Evidence requires normalised or derived provenance'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_intelligence_evidence_provenance() from public, anon, authenticated;

drop trigger if exists intelligence_evidence_enforce_provenance on public.intelligence_evidence;
create trigger intelligence_evidence_enforce_provenance
before insert or update on public.intelligence_evidence
for each row execute function public.enforce_intelligence_evidence_provenance();

-- Refuse activation if any historical Evidence escaped the backfill. Failing the
-- migration is safer than silently claiming provenance coverage that does not
-- exist.
do $$
declare
  v_missing bigint;
begin
  select count(*)
  into v_missing
  from public.intelligence_evidence
  where normalised_observation_id is null
    and derived_metric_version_id is null;

  if v_missing <> 0 then
    raise exception 'MRU P2 backfill incomplete: % intelligence Evidence rows lack provenance', v_missing;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intelligence_evidence_provenance_required'
      and conrelid = 'public.intelligence_evidence'::regclass
  ) then
    alter table public.intelligence_evidence
      add constraint intelligence_evidence_provenance_required
      check (
        normalised_observation_id is not null
        or derived_metric_version_id is not null
      );
  end if;
end
$$;

-- Deterministic edge projection over the canonical persistence graph. The view
-- stores no duplicate analytical state: it simply exposes relationships already
-- present in immutable/current canonical tables.
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
  from public.story_thesis_versions version

  union all

  select
    'intelligence_evidence'::text,
    evidence.id::text,
    'asset_entity'::text,
    asset,
    'affects'::text,
    evidence.created_at
  from public.intelligence_evidence evidence
  cross join lateral unnest(evidence.affected_assets) asset

  union all

  select
    'intelligence_evidence'::text,
    evidence.id::text,
    'topic_entity'::text,
    topic,
    'about'::text,
    evidence.created_at
  from public.intelligence_evidence evidence
  cross join lateral unnest(evidence.affected_topics) topic;

-- Audit-friendly flattened claim lineage. Derived metrics expand to each exact
-- input observation recorded by P1; direct claims retain their one normalised
-- observation. Legacy Story versions without canonical reasoning remain absent
-- rather than being enriched from current state.
create or replace view public.research_claim_lineage_v1
with (security_invoker = true)
as
with story_claims as (
  select
    version.story_id,
    version.id as story_thesis_version_id,
    version.version_number,
    claim.value ->> 'id' as claim_id,
    claim.value ->> 'type' as claim_type,
    claim.value ->> 'text' as claim_text,
    evidence_ref.evidence_id
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
),
resolved as (
  select
    claim.story_id,
    claim.story_thesis_version_id,
    claim.version_number,
    claim.claim_id,
    claim.claim_type,
    claim.claim_text,
    evidence.id as evidence_id,
    evidence.source_id as evidence_source_id,
    evidence.raw_source_record_id,
    raw.intake_item_id,
    evidence.normalised_observation_id as direct_observation_id,
    evidence.derived_metric_version_id,
    metric.input_observation_ids
  from story_claims claim
  join public.intelligence_evidence evidence
    on evidence.id::text = claim.evidence_id
  left join public.raw_source_records raw
    on raw.id = evidence.raw_source_record_id
  left join public.derived_metric_versions metric
    on metric.id = evidence.derived_metric_version_id
)
select
  resolved.story_id,
  resolved.story_thesis_version_id,
  resolved.version_number,
  resolved.claim_id,
  resolved.claim_type,
  resolved.claim_text,
  resolved.evidence_id,
  resolved.evidence_source_id,
  resolved.raw_source_record_id,
  resolved.intake_item_id,
  resolved.derived_metric_version_id,
  coalesce(metric_input.observation_id, resolved.direct_observation_id) as normalised_observation_id
from resolved
left join lateral unnest(coalesce(resolved.input_observation_ids, '{}'::uuid[])) metric_input(observation_id)
  on true
where resolved.direct_observation_id is not null
   or metric_input.observation_id is not null;

revoke all on table public.research_provenance_edges_v1 from public, anon, authenticated;
revoke all on table public.research_claim_lineage_v1 from public, anon, authenticated;
grant select on table public.research_provenance_edges_v1 to service_role;
grant select on table public.research_claim_lineage_v1 to service_role;

comment on column public.intelligence_evidence.normalised_observation_id is
  'Direct canonical observation supporting this Evidence claim. Required unless derived_metric_version_id supplies the lineage.';
comment on column public.intelligence_evidence.derived_metric_version_id is
  'Optional immutable calculated-metric version supporting this Evidence claim; its input_observation_ids provide exact upstream lineage.';
comment on view public.research_provenance_edges_v1 is
  'Service-side deterministic provenance graph from research intake/raw memory through observations, derived metrics, Evidence, Story claims and entities.';
comment on view public.research_claim_lineage_v1 is
  'Flattened immutable Story-claim lineage to canonical Evidence and exact direct/derived observation inputs.';

commit;
