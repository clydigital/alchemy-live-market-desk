-- Allow evidence-backed Story maintenance to revive an archived Story when
-- fresh canonical evidence materially reinforces it. Dossier V2 only queues
-- reevaluation; this function remains the evidence-gated mutation boundary.

begin;

create or replace function public.apply_intelligence_story_assessment(
  p_assessment_id uuid
)
returns table(applied boolean, effective_disposition text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assessment public.intelligence_story_assessments%rowtype;
  story_row public.stories%rowtype;
  proposal jsonb;
  review_context jsonb;
  proposal_next jsonb;
  proposal_title text;
  proposal_thesis text;
  proposal_question text;
  proposal_confirmation jsonb;
  proposal_invalidation jsonb;
  proposal_confirmation_text text;
  proposal_invalidation_text text;
  proposal_next_label text;
  proposal_next_ref text;
  accepted_next_test jsonb;
  allowed_fields text[];
  candidate_valid boolean := false;
  current_catalyst_due boolean := false;
  mechanism_reframe_blocked boolean := false;
  material_allowed boolean := false;
  operational_refresh_allowed boolean := false;
  story_changed boolean := false;
  effective_status text := 'unchanged';
  public_status text;
  new_lifecycle_status text;
  new_title text;
  new_thesis text;
  new_question text;
  new_confirmation text;
  new_invalidation text;
  new_next_catalyst text;
  new_confidence integer;
  credible_count integer := 0;
  independent_groups integer := 0;
  has_tier_one_or_two boolean := false;
  evaluated_at timestamptz := now();
  maintenance_context jsonb;
  reasoning_patch jsonb := '{}'::jsonb;
begin
  select * into assessment
  from public.intelligence_story_assessments
  where id = p_assessment_id
  for update;

  if assessment.id is null then
    raise exception 'Story assessment not found';
  end if;
  if assessment.applied_at is not null then
    return query select false, assessment.disposition;
    return;
  end if;

  select * into story_row
  from public.stories
  where id = assessment.story_id
  for update;
  if story_row.id is null then
    raise exception 'Story not found for assessment %', assessment.id;
  end if;

  -- Story-row locking serializes concurrent applies. Once the lock is held, an
  -- older assessment can safely observe and yield to any newer applied result.
  if exists (
    select 1
    from public.intelligence_story_assessments newer
    where newer.story_id = assessment.story_id
      and newer.id <> assessment.id
      and newer.applied_at is not null
      and row(newer.selected_at,newer.created_at)
        >= row(assessment.selected_at,assessment.created_at)
  ) then
    update public.intelligence_story_assessments stale
    set disposition='unchanged',
        rationale=assessment.rationale || ' Story assessment was superseded by a newer applied assessment.',
        material_change_applied=false,
        applied_at=evaluated_at
    where stale.id=assessment.id;

    update public.intelligence_reevaluation_queue queue
    set status='completed',completed_at=evaluated_at,last_error=null,updated_at=evaluated_at
    where queue.id=any(assessment.queue_ids)
      and queue.status='processing'
      and queue.claimed_by_engine_run_id=assessment.engine_run_id;

    return query select true,'unchanged'::text;
    return;
  end if;

  proposal := coalesce(assessment.proposed_updates, '{}'::jsonb);
  if jsonb_typeof(proposal) <> 'object' then
    raise exception 'Story assessment proposed_updates must be an object';
  end if;

  proposal_title := nullif(btrim(proposal ->> 'title'), '');
  proposal_thesis := nullif(btrim(proposal ->> 'thesis'), '');
  proposal_question := nullif(btrim(proposal ->> 'marketQuestion'), '');
  proposal_confirmation := proposal -> 'confirmation';
  proposal_invalidation := proposal -> 'invalidation';
  proposal_next := proposal -> 'nextCatalyst';
  proposal_next_label := case when jsonb_typeof(proposal_next) = 'object'
    then nullif(btrim(proposal_next ->> 'label'), '') else null end;
  proposal_next_ref := case when jsonb_typeof(proposal_next) = 'object'
    then nullif(btrim(proposal_next ->> 'catalystRef'), '') else null end;

  if proposal_confirmation is not null
    and jsonb_typeof(proposal_confirmation) not in ('array', 'null') then
    raise exception 'Story maintenance confirmation proposal must be an array or null';
  end if;
  if proposal_invalidation is not null
    and jsonb_typeof(proposal_invalidation) not in ('array', 'null') then
    raise exception 'Story maintenance invalidation proposal must be an array or null';
  end if;

  if jsonb_typeof(proposal_confirmation) = 'array' then
    select string_agg(btrim(value), '; ' order by ordinal)
    into proposal_confirmation_text
    from jsonb_array_elements_text(proposal_confirmation) with ordinality item(value, ordinal)
    where nullif(btrim(value), '') is not null;
  end if;
  if jsonb_typeof(proposal_invalidation) = 'array' then
    select string_agg(btrim(value), '; ' order by ordinal)
    into proposal_invalidation_text
    from jsonb_array_elements_text(proposal_invalidation) with ordinality item(value, ordinal)
    where nullif(btrim(value), '') is not null;
  end if;

  select target -> 'reviewContext'
  into review_context
  from public.intelligence_engine_runs run
  cross join lateral jsonb_array_elements(coalesce(run.metadata #> '{frozenInputs,storyReviewTargets}', '[]'::jsonb)) target
  where run.id = assessment.engine_run_id
    and target -> 'story' ->> 'id' = assessment.story_id::text
  limit 1;
  review_context := coalesce(review_context, '{}'::jsonb);

  candidate_valid := public.story_maintenance_catalyst_candidate_is_valid(
    story_row.next_catalyst,
    proposal_next_label,
    proposal_next_ref,
    review_context,
    false
  );
  current_catalyst_due := public.story_maintenance_catalyst_candidate_is_valid(
    story_row.next_catalyst,
    proposal_next_label,
    proposal_next_ref,
    review_context,
    true
  );
  accepted_next_test := public.story_maintenance_next_test_for_candidate(
    assessment.story_id,
    proposal_next_label,
    proposal_next_ref,
    review_context
  );

  select
    count(*)::integer,
    count(distinct coalesce(source.ancestry_group_id::text, evidence.source_id::text))::integer,
    coalesce(bool_or(source.source_tier <= 2), false)
  into credible_count, independent_groups, has_tier_one_or_two
  from public.intelligence_evidence evidence
  join public.intelligence_evidence_sources source on source.id = evidence.source_id
  where evidence.id = any(assessment.eligible_evidence_ids)
    and evidence.evidence_class not in ('transcript', 'research_analysis')
    and source.source_tier <= 4;

  -- The model's original disposition owns the mechanism boundary even when
  -- evidence eligibility later downgrades the effective disposition to unchanged.
  if assessment.model_disposition = 'reframed' then
    mechanism_reframe_blocked := not public.story_maintenance_reframe_is_lightweight(
      story_row.thesis,
      proposal_thesis,
      assessment.rationale
    )
      or (
        proposal_title is not null
        and not public.story_maintenance_text_reframe_is_lightweight(story_row.title, proposal_title)
      )
      or (
        proposal_question is not null
        and not public.story_maintenance_text_reframe_is_lightweight(story_row.market_question, proposal_question)
      )
      or (
        proposal_confirmation_text is not null
        and not public.story_maintenance_text_reframe_is_lightweight(
          story_row.confirmation_trigger,
          proposal_confirmation_text
        )
      )
      or (
        proposal_invalidation_text is not null
        and not public.story_maintenance_text_reframe_is_lightweight(
          story_row.invalidation_trigger,
          proposal_invalidation_text
        )
      );
  end if;

  material_allowed := assessment.disposition <> 'unchanged'
    and credible_count > 0
    and not mechanism_reframe_blocked
    and (assessment.disposition <> 'reframed' or proposal_thesis is not null)
    and (
      assessment.disposition <> 'invalidated'
      or has_tier_one_or_two
      or independent_groups >= 2
    );
  effective_status := case when material_allowed then assessment.disposition else 'unchanged' end;
  allowed_fields := public.story_maintenance_allowed_fields(effective_status);

  insert into public.intelligence_story_states(
    story_id,lifecycle_status,publication_eligible,last_evaluated_at,last_evidence_at
  ) values(
    assessment.story_id,
    case
      when story_row.status='publish' then 'confirmed'
      when story_row.status='develop' then 'developing'
      when story_row.status='archived' then 'archived'
      else 'detected'
    end,
    story_row.status not in ('archived','discarded'),
    evaluated_at,
    assessment.last_evidence_at
  ) on conflict(story_id) do nothing;

  update public.intelligence_story_states state
  set last_evaluated_at=evaluated_at,
      last_evidence_at=case
        when assessment.last_evidence_at is null then state.last_evidence_at
        else greatest(state.last_evidence_at,assessment.last_evidence_at)
      end,
      updated_at=evaluated_at
  where state.story_id=assessment.story_id;

  public_status := case
    when effective_status='invalidated' then 'archived'
    when story_row.status='archived' and effective_status='reinforced' then 'publish'
    when effective_status in ('weakened','reframed') then 'develop'
    else story_row.status
  end;
  new_lifecycle_status := case
    when effective_status='reinforced' then 'confirmed'
    when effective_status='weakened' then 'weakening'
    when effective_status='reframed' then 'developing'
    when effective_status='invalidated' then 'invalidated'
    else coalesce((select lifecycle_status from public.intelligence_story_states where story_id=assessment.story_id),'detected')
  end;
  new_confidence := case when material_allowed then round(greatest(0,least(100,case
    when effective_status='reinforced' then story_row.confidence + greatest(abs(assessment.confidence_delta),1)
    when effective_status='weakened' then story_row.confidence - greatest(abs(assessment.confidence_delta),1)
    when effective_status='invalidated' then story_row.confidence - greatest(abs(assessment.confidence_delta),25)
    else story_row.confidence + assessment.confidence_delta
  end)))::integer else story_row.confidence end;

  new_title := story_row.title;
  new_thesis := story_row.thesis;
  new_question := story_row.market_question;
  new_confirmation := story_row.confirmation_trigger;
  new_invalidation := story_row.invalidation_trigger;
  new_next_catalyst := story_row.next_catalyst;

  if material_allowed then
    if 'title' = any(allowed_fields) and proposal_title is not null then
      new_title := left(proposal_title, 180);
    end if;
    if 'thesis' = any(allowed_fields) and proposal_thesis is not null then
      new_thesis := proposal_thesis;
    end if;
    if 'marketQuestion' = any(allowed_fields) and proposal_question is not null then
      new_question := proposal_question;
    end if;
    if 'confirmation' = any(allowed_fields)
      and jsonb_typeof(proposal_confirmation) = 'array'
      and jsonb_array_length(proposal_confirmation) > 0 then
      new_confirmation := proposal_confirmation_text;
    end if;
    if 'invalidation' = any(allowed_fields)
      and jsonb_typeof(proposal_invalidation) = 'array'
      and jsonb_array_length(proposal_invalidation) > 0 then
      new_invalidation := proposal_invalidation_text;
    end if;
    if 'nextCatalyst' = any(allowed_fields) and proposal_next_label is not null and candidate_valid then
      new_next_catalyst := proposal_next_label;
    end if;
  elsif not mechanism_reframe_blocked
    and assessment.disposition = 'unchanged'
    and proposal_next_label is not null
    and candidate_valid
    and current_catalyst_due
    and proposal_next_label is distinct from story_row.next_catalyst then
    new_next_catalyst := proposal_next_label;
    operational_refresh_allowed := true;
  end if;

  story_changed := row(
    new_title,new_thesis,public_status,new_confidence,new_question,new_confirmation,new_invalidation,new_next_catalyst
  ) is distinct from row(
    story_row.title,story_row.thesis,story_row.status,story_row.confidence,story_row.market_question,
    story_row.confirmation_trigger,story_row.invalidation_trigger,story_row.next_catalyst
  );

  if story_changed then
    if material_allowed then
      reasoning_patch := reasoning_patch || jsonb_build_object('lifecycle', new_lifecycle_status);
      if new_confirmation is distinct from story_row.confirmation_trigger
        and jsonb_typeof(proposal_confirmation) = 'array' then
        reasoning_patch := reasoning_patch || jsonb_build_object('confirmation', proposal_confirmation);
      end if;
      if new_invalidation is distinct from story_row.invalidation_trigger
        and jsonb_typeof(proposal_invalidation) = 'array' then
        reasoning_patch := reasoning_patch || jsonb_build_object('invalidation', proposal_invalidation);
      end if;
    end if;
    if new_next_catalyst is distinct from story_row.next_catalyst
      and candidate_valid
      and accepted_next_test is not null then
      reasoning_patch := reasoning_patch || jsonb_build_object('nextTest', accepted_next_test);
    end if;

    maintenance_context := jsonb_build_object(
      'engineRunId',assessment.engine_run_id,
      'marketBeliefStageRunId',assessment.market_belief_stage_run_id,
      'disposition',effective_status,
      'rationale',assessment.rationale,
      'intelligenceEvidenceIds',assessment.evidence_ids,
      'proposedUpdates',proposal,
      'operationalCatalystRefresh',operational_refresh_allowed,
      'reasoningPatch',reasoning_patch
    );
    perform set_config('alchemy.story_maintenance_context',maintenance_context::text,true);

    update public.stories story
    set title=new_title,
        thesis=new_thesis,
        status=public_status,
        confidence=new_confidence,
        market_question=new_question,
        confirmation_trigger=new_confirmation,
        invalidation_trigger=new_invalidation,
        next_catalyst=new_next_catalyst,
        updated_at=evaluated_at
    where story.id=assessment.story_id;

    perform set_config('alchemy.story_maintenance_context','',true);

    insert into public.story_updates(story_id,update_type,headline,detail,observed_at,suppress_event_mirror)
    values(
      assessment.story_id,
      case
        when effective_status='invalidated' then 'invalidation'
        when effective_status='reinforced' then 'confirmation'
        else 'recalibration'
      end,
      left(assessment.rationale,90),
      assessment.rationale,
      evaluated_at,
      true
    );
  end if;

  -- Lifecycle/publication state must advance only with the same concrete Story
  -- mutation that produced the new immutable thesis version.
  update public.intelligence_story_states state
  set lifecycle_status=case
        when material_allowed and story_changed then new_lifecycle_status
        else state.lifecycle_status
      end,
      publication_eligible=case
        when material_allowed and story_changed then public_status not in ('archived','discarded')
        else state.publication_eligible
      end,
      updated_at=evaluated_at
  where state.story_id=assessment.story_id;

  update public.research_debt debt
  set last_attempt_at=evaluated_at,
      next_check_at=evaluated_at + case when debt.severity='critical' then interval '6 hours' else interval '24 hours' end,
      updated_at=evaluated_at
  where debt.story_id=assessment.story_id
    and debt.status='open'
    and debt.severity in ('high','critical')
    and (debt.next_check_at is null or debt.next_check_at <= evaluated_at);

  update public.intelligence_story_assessments
  set disposition=effective_status,
      material_change_applied=(material_allowed and story_changed),
      applied_at=evaluated_at
  where id=assessment.id;

  update public.intelligence_reevaluation_queue queue
  set status='completed',completed_at=evaluated_at,last_error=null,updated_at=evaluated_at
  where queue.id=any(assessment.queue_ids)
    and queue.status='processing'
    and queue.claimed_by_engine_run_id=assessment.engine_run_id;

  return query select true,effective_status;
end;
$$;

revoke all on function public.apply_intelligence_story_assessment(uuid) from public, anon, authenticated;
grant execute on function public.apply_intelligence_story_assessment(uuid) to service_role;

comment on function public.apply_intelligence_story_assessment(uuid) is
  'Applies evidence-gated existing Story maintenance. A materially reinforced archived Story may return to publishable state; unchanged archived Stories stay archived.';

commit;
