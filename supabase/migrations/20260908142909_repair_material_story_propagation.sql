-- Repair deterministic research-to-Story propagation and material freshness.
-- Story association is performed by Live before this boundary. PostgreSQL keeps
-- scheduled catalysts non-material and advances freshness only from an applied
-- assessment that actually changed canonical Story state.

begin;

create or replace function public.filter_story_assessment_material_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select coalesce(array_agg(candidate.evidence_id order by candidate.ordinal), '{}'::uuid[])
  into new.eligible_evidence_ids
  from unnest(coalesce(new.eligible_evidence_ids, '{}'::uuid[])) with ordinality
    candidate(evidence_id, ordinal)
  join public.intelligence_evidence evidence on evidence.id = candidate.evidence_id
  where coalesce(evidence.structured_payload ->> 'evidenceNature', '') <> 'scheduled_event';

  return new;
end;
$$;

revoke all on function public.filter_story_assessment_material_evidence() from public, anon, authenticated;

drop trigger if exists intelligence_story_assessments_filter_material_evidence
  on public.intelligence_story_assessments;
create trigger intelligence_story_assessments_filter_material_evidence
before insert or update of eligible_evidence_ids on public.intelligence_story_assessments
for each row execute function public.filter_story_assessment_material_evidence();

create or replace function public.advance_story_material_update_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.material_change_applied and new.applied_at is not null then
    update public.intelligence_story_states state
    set last_material_update_at = greatest(
          coalesce(state.last_material_update_at, '-infinity'::timestamptz),
          new.applied_at
        ),
        updated_at = greatest(state.updated_at, new.applied_at)
    where state.story_id = new.story_id
      and state.last_material_update_at is distinct from greatest(
        coalesce(state.last_material_update_at, '-infinity'::timestamptz),
        new.applied_at
      );
  end if;
  return new;
end;
$$;

revoke all on function public.advance_story_material_update_at() from public, anon, authenticated;

drop trigger if exists intelligence_story_assessments_advance_material_at
  on public.intelligence_story_assessments;
create trigger intelligence_story_assessments_advance_material_at
after insert or update of material_change_applied, applied_at
on public.intelligence_story_assessments
for each row execute function public.advance_story_material_update_at();

-- Initial unverified taxonomy seeds are monitoring hypotheses, not material
-- Story mutations. The state-history trigger records this correction.
update public.intelligence_story_states state
set last_material_update_at = null,
    updated_at = now()
from public.stories story
where story.id = state.story_id
  and story.article_verdict = 'theme_seed_unverified'
  and state.last_material_update_at is not null
  and not exists (
    select 1
    from public.intelligence_story_assessments assessment
    where assessment.story_id = state.story_id
      and assessment.material_change_applied
      and assessment.applied_at is not null
  );

-- Recover the exact timestamp of already-applied legitimate material changes.
with latest_material as (
  select story_id, max(applied_at) as applied_at
  from public.intelligence_story_assessments
  where material_change_applied
    and applied_at is not null
  group by story_id
)
update public.intelligence_story_states state
set last_material_update_at = latest.applied_at,
    updated_at = greatest(state.updated_at, latest.applied_at)
from latest_material latest
where state.story_id = latest.story_id
  and (
    state.last_material_update_at is null
    or state.last_material_update_at < latest.applied_at
  );

create or replace function public.apply_intelligence_story_assessment_v2(
  p_assessment_id uuid
)
returns table(applied boolean, effective_disposition text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  base_applied boolean;
  base_disposition text;
  assessment public.intelligence_story_assessments%rowtype;
  story_row public.stories%rowtype;
  proposal_next jsonb;
  proposal_next_label text;
  proposal_next_ref text;
  review_context jsonb;
  accepted_next_test jsonb;
  maintenance_context jsonb;
  evaluated_at timestamptz := now();
begin
  select result.applied, result.effective_disposition
  into base_applied, base_disposition
  from public.apply_intelligence_story_assessment(p_assessment_id) result;

  if not coalesce(base_applied, false) then
    return query select false, coalesce(base_disposition, 'unchanged'::text);
    return;
  end if;

  select * into assessment
  from public.intelligence_story_assessments
  where id = p_assessment_id;

  if assessment.id is null
    or assessment.material_change_applied
    or assessment.disposition <> 'unchanged' then
    return query select true, coalesce(base_disposition, 'unchanged'::text);
    return;
  end if;

  proposal_next := assessment.proposed_updates -> 'nextCatalyst';
  proposal_next_label := case when jsonb_typeof(proposal_next) = 'object'
    then nullif(btrim(proposal_next ->> 'label'), '') else null end;
  proposal_next_ref := case when jsonb_typeof(proposal_next) = 'object'
    then nullif(btrim(proposal_next ->> 'catalystRef'), '') else null end;

  if proposal_next_label is null or proposal_next_ref is null then
    return query select true, coalesce(base_disposition, 'unchanged'::text);
    return;
  end if;

  select target -> 'reviewContext'
  into review_context
  from public.intelligence_engine_runs run
  cross join lateral jsonb_array_elements(
    coalesce(run.metadata #> '{frozenInputs,storyReviewTargets}', '[]'::jsonb)
  ) target
  where run.id = assessment.engine_run_id
    and target -> 'story' ->> 'id' = assessment.story_id::text
  limit 1;
  review_context := coalesce(review_context, '{}'::jsonb);

  if not public.story_maintenance_catalyst_candidate_is_valid(
    null,
    proposal_next_label,
    proposal_next_ref,
    review_context,
    false
  ) or not exists (
    select 1
    from jsonb_array_elements(case
      when jsonb_typeof(review_context -> 'catalystCandidates') = 'array'
        then review_context -> 'catalystCandidates'
      else '[]'::jsonb
    end) candidate
    join public.intelligence_evidence evidence
      on evidence.id::text = nullif(btrim(candidate ->> 'catalystRef'), '')
    join public.intelligence_story_evidence link
      on link.evidence_id = evidence.id
     and link.story_id = assessment.story_id
    where nullif(btrim(candidate ->> 'label'), '') = proposal_next_label
      and nullif(btrim(candidate ->> 'catalystRef'), '') = proposal_next_ref
      and candidate ->> 'evidenceNature' = 'scheduled_event'
      and evidence.structured_payload ->> 'evidenceNature' = 'scheduled_event'
      and evidence.id = any(assessment.evidence_ids)
  ) then
    return query select true, coalesce(base_disposition, 'unchanged'::text);
    return;
  end if;

  select * into story_row
  from public.stories
  where id = assessment.story_id
  for update;

  if story_row.id is null or proposal_next_label is not distinct from story_row.next_catalyst then
    return query select true, coalesce(base_disposition, 'unchanged'::text);
    return;
  end if;

  accepted_next_test := public.story_maintenance_next_test_for_candidate(
    assessment.story_id,
    proposal_next_label,
    proposal_next_ref,
    review_context
  );
  if accepted_next_test is null then
    return query select true, coalesce(base_disposition, 'unchanged'::text);
    return;
  end if;

  maintenance_context := jsonb_build_object(
    'engineRunId', assessment.engine_run_id,
    'marketBeliefStageRunId', assessment.market_belief_stage_run_id,
    'disposition', 'unchanged',
    'rationale', assessment.rationale,
    'intelligenceEvidenceIds', assessment.evidence_ids,
    'proposedUpdates', assessment.proposed_updates,
    'operationalCatalystRefresh', true,
    'reasoningPatch', jsonb_build_object('nextTest', accepted_next_test)
  );
  perform set_config('alchemy.story_maintenance_context', maintenance_context::text, true);

  update public.stories
  set next_catalyst = proposal_next_label,
      updated_at = evaluated_at
  where id = assessment.story_id;

  perform set_config('alchemy.story_maintenance_context', '', true);

  insert into public.story_updates(
    story_id, update_type, headline, detail, observed_at, suppress_event_mirror
  ) values (
    assessment.story_id,
    'recalibration',
    left('Scheduled catalyst attached: ' || proposal_next_label, 90),
    assessment.rationale,
    evaluated_at,
    true
  );

  update public.intelligence_story_states state
  set last_evaluated_at = greatest(state.last_evaluated_at, evaluated_at),
      next_catalysts = case
        when proposal_next_label = any(coalesce(state.next_catalysts, '{}'::text[]))
          then state.next_catalysts
        else array_append(coalesce(state.next_catalysts, '{}'::text[]), proposal_next_label)
      end,
      updated_at = evaluated_at
  where state.story_id = assessment.story_id;

  return query select true, coalesce(base_disposition, 'unchanged'::text);
end;
$$;

revoke all on function public.apply_intelligence_story_assessment_v2(uuid) from public, anon, authenticated;
grant execute on function public.apply_intelligence_story_assessment_v2(uuid) to service_role;

comment on function public.apply_intelligence_story_assessment_v2(uuid) is
  'Applies canonical Story maintenance and may attach a linked scheduled Evidence record as an operational next catalyst without marking a material thesis change.';

commit;
