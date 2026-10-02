-- Harden Story review persistence against JSON null/scalar frozen-input metadata.
-- PostgreSQL COALESCE does not replace a JSONB literal null because it is not SQL NULL.
-- Optional Story review context must fail closed to an empty array/object instead of
-- aborting the canonical intelligence run.

begin;

create or replace function public.freeze_intelligence_story_review_targets(
  p_engine_run_id uuid,
  p_targets jsonb
)
returns table(targets jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_targets jsonb;
  enriched_targets jsonb;
begin
  if jsonb_typeof(p_targets) <> 'array' or jsonb_array_length(p_targets) > 4 then
    raise exception 'Story review targets must be a JSON array with at most four items';
  end if;

  select run.metadata #> '{frozenInputs,storyReviewTargets}'
  into existing_targets
  from public.intelligence_engine_runs run
  where run.id = p_engine_run_id
  for update;

  if jsonb_typeof(existing_targets) is distinct from 'array' then
    select coalesce(jsonb_agg(
      item || jsonb_build_object(
        'reviewContext',
        coalesce(item -> 'reviewContext', '{}'::jsonb) || jsonb_build_object(
          'queueReasons', coalesce((
            select jsonb_agg(reason_row.reason order by reason_row.reason)
            from (
              select distinct q.reason
              from public.intelligence_reevaluation_queue q
              where q.id::text in (
                select value
                from jsonb_array_elements_text(case
                  when jsonb_typeof(item -> 'queueIds') = 'array' then item -> 'queueIds'
                  else '[]'::jsonb
                end)
              )
                and nullif(btrim(q.reason), '') is not null
            ) reason_row
          ), '[]'::jsonb),
          'researchDebt', coalesce((
            select jsonb_agg(jsonb_build_object(
              'debtKey', debt.debt_key,
              'severity', debt.severity,
              'reason', debt.reason,
              'nextAction', debt.next_action,
              'nextCheckAt', debt.next_check_at
            ) order by debt.next_check_at nulls last, debt.debt_key)
            from public.research_debt debt
            where debt.story_id = ((item -> 'story' ->> 'id')::uuid)
              and debt.status = 'open'
          ), '[]'::jsonb),
          'dueCatalysts', case
            when jsonb_typeof(item #> '{reviewContext,dueCatalysts}') = 'array'
              then item #> '{reviewContext,dueCatalysts}'
            else '[]'::jsonb
          end,
          'triggerEvidenceIds', case
            when jsonb_typeof(item #> '{reviewContext,triggerEvidenceIds}') = 'array'
              then item #> '{reviewContext,triggerEvidenceIds}'
            else '[]'::jsonb
          end
        )
      )
      order by (item ->> 'reasonRank')::integer, item -> 'story' ->> 'id'
    ), '[]'::jsonb)
    into enriched_targets
    from jsonb_array_elements(p_targets) item;

    update public.intelligence_engine_runs run
    set metadata = jsonb_set(
          jsonb_set(
            case when jsonb_typeof(run.metadata) = 'object' then run.metadata else '{}'::jsonb end,
            '{frozenInputs}',
            case when jsonb_typeof(run.metadata -> 'frozenInputs') = 'object'
              then run.metadata -> 'frozenInputs'
              else '{}'::jsonb
            end,
            true
          ),
          '{frozenInputs,storyReviewTargets}',
          enriched_targets,
          true
        ),
        target_story_ids = array(
          select ((item -> 'story' ->> 'id')::uuid)
          from jsonb_array_elements(enriched_targets) item
        )
    where run.id = p_engine_run_id;
    existing_targets := enriched_targets;
  end if;

  return query select existing_targets;
end;
$$;

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
  current_catalyst_expired boolean := false;
  expired_next_test jsonb;
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
  cross join lateral jsonb_array_elements(case
      when jsonb_typeof(run.metadata #> '{frozenInputs,storyReviewTargets}') = 'array'
        then run.metadata #> '{frozenInputs,storyReviewTargets}'
      else '[]'::jsonb
    end) target
  where run.id = assessment.engine_run_id
    and target -> 'story' ->> 'id' = assessment.story_id::text
  limit 1;
  review_context := coalesce(review_context, '{}'::jsonb);

  current_catalyst_expired := story_row.next_catalyst is not null
    and coalesce(review_context ->> 'catalystRecalibrationRequired', 'false') = 'true'
    and exists (
      select 1
      from jsonb_array_elements_text(case
        when jsonb_typeof(review_context -> 'expiredCatalysts') = 'array'
          then review_context -> 'expiredCatalysts'
        else '[]'::jsonb
      end) expired
      where btrim(expired) = btrim(story_row.next_catalyst)
    );

  if current_catalyst_expired then
    expired_next_test := jsonb_build_object(
      'id', 'story:' || assessment.story_id::text || ':next-test:expired:' || md5(story_row.next_catalyst),
      'label', story_row.next_catalyst,
      'status', 'expired',
      'catalystRef', null,
      'dueAt', null,
      'expiresAt', evaluated_at,
      'evidenceIds', '[]'::jsonb,
      'resolutionEvidenceIds', '[]'::jsonb
    );
  end if;

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
    and (current_catalyst_due or current_catalyst_expired)
    and proposal_next_label is distinct from story_row.next_catalyst then
    new_next_catalyst := proposal_next_label;
    operational_refresh_allowed := true;
  end if;

  if current_catalyst_expired
    and not (proposal_next_label is not null and candidate_valid) then
    new_next_catalyst := null;
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
    elsif new_next_catalyst is null
      and story_row.next_catalyst is not null
      and current_catalyst_expired
      and expired_next_test is not null then
      reasoning_patch := reasoning_patch || jsonb_build_object('nextTest', expired_next_test);
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
    case
      when jsonb_typeof(run.metadata #> '{frozenInputs,storyReviewTargets}') = 'array'
        then run.metadata #> '{frozenInputs,storyReviewTargets}'
      else '[]'::jsonb
    end
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

revoke all on function public.freeze_intelligence_story_review_targets(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.freeze_intelligence_story_review_targets(uuid, jsonb)
  to service_role;

revoke all on function public.apply_intelligence_story_assessment(uuid)
  from public, anon, authenticated;
grant execute on function public.apply_intelligence_story_assessment(uuid)
  to service_role;

revoke all on function public.apply_intelligence_story_assessment_v2(uuid)
  from public, anon, authenticated;
grant execute on function public.apply_intelligence_story_assessment_v2(uuid)
  to service_role;

commit;
