-- Production proof hardening for PR #94.
-- Fixes fresh-run target freezing, avoids duplicate maintenance history, and
-- reschedules overdue high/critical Story-local research debt after review.

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
                from jsonb_array_elements_text(coalesce(item -> 'queueIds', '[]'::jsonb))
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
          'dueCatalysts', coalesce(item #> '{reviewContext,dueCatalysts}', '[]'::jsonb),
          'triggerEvidenceIds', coalesce(item #> '{reviewContext,triggerEvidenceIds}', '[]'::jsonb)
        )
      )
      order by (item ->> 'reasonRank')::integer, item -> 'story' ->> 'id'
    ), '[]'::jsonb)
    into enriched_targets
    from jsonb_array_elements(p_targets) item;

    update public.intelligence_engine_runs run
    set metadata = jsonb_set(
          jsonb_set(coalesce(run.metadata, '{}'::jsonb), '{frozenInputs}', coalesce(run.metadata -> 'frozenInputs', '{}'::jsonb), true),
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

revoke all on function public.freeze_intelligence_story_review_targets(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.freeze_intelligence_story_review_targets(uuid, jsonb) to service_role;

alter table public.story_updates
  add column if not exists suppress_event_mirror boolean not null default false;

create or replace function public.capture_story_update_event()
returns trigger
language plpgsql
as $$
begin
  if new.suppress_event_mirror then
    return new;
  end if;
  insert into public.story_events(story_id,legacy_update_id,event_type,headline,detail,event_at,recorded_at,metadata)
  values(
    new.story_id,
    new.id,
    case
      when new.update_type='contradiction' then 'contradiction'
      when new.update_type='confirmation' then 'confirmation'
      when new.update_type='invalidation' then 'invalidation'
      else 'headline_update'
    end,
    new.headline,
    new.detail,
    coalesce(new.observed_at,new.published_at,new.created_at),
    new.created_at,
    jsonb_build_object('legacy_update_type',new.update_type,'mirrored',true)
  ) on conflict(legacy_update_id) do nothing;
  return new;
end;
$$;

create or replace function public.capture_story_thesis_version()
returns trigger
language plpgsql
as $$
declare
  next_version integer;
  new_version_id uuid;
  revision_event_id uuid;
  maintenance_context jsonb;
  event_metadata jsonb;
  version_snapshot jsonb;
  event_type_value text := 'thesis_revision';
  event_headline text;
  change_reason_value text := 'story_updated';
begin
  if row(new.title,new.thesis,new.status,new.confidence,new.market_question,new.dominant_narrative,new.best_explanation,new.strongest_support,new.strongest_contradiction,new.priced_assessment,new.confirmation_trigger,new.invalidation_trigger,new.next_catalyst,new.article_angle,new.provisional_title,new.article_verdict,new.assets)
  is not distinct from row(old.title,old.thesis,old.status,old.confidence,old.market_question,old.dominant_narrative,old.best_explanation,old.strongest_support,old.strongest_contradiction,old.priced_assessment,old.confirmation_trigger,old.invalidation_trigger,old.next_catalyst,old.article_angle,old.provisional_title,old.article_verdict,old.assets) then
    return new;
  end if;

  begin
    maintenance_context := nullif(current_setting('alchemy.story_maintenance_context', true), '')::jsonb;
  exception when others then
    maintenance_context := null;
  end;

  event_metadata := jsonb_build_object('automatic',true,'previous_version_id',old.current_thesis_version_id);
  version_snapshot := to_jsonb(new);

  if maintenance_context is not null then
    event_metadata := event_metadata || jsonb_build_object('origin','existing_story_maintenance') || maintenance_context;
    version_snapshot := version_snapshot || jsonb_build_object('maintenanceContext',maintenance_context);
    change_reason_value := 'material_evidence_recalibration';
    event_type_value := case
      when maintenance_context ->> 'disposition' = 'invalidated' then 'invalidation'
      when maintenance_context ->> 'disposition' = 'reinforced' then 'confirmation'
      else 'thesis_revision'
    end;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
  select coalesce(max(version_number),0)+1 into next_version
  from public.story_thesis_versions where story_id=new.id;

  if maintenance_context is null then
    event_headline := format('Story thesis version %s recorded',next_version);
  else
    event_headline := left(format('Existing Story %s: %s', maintenance_context ->> 'disposition', coalesce(maintenance_context ->> 'rationale','material evidence recalibration')),180);
  end if;

  insert into public.story_events(story_id,event_type,headline,detail,event_at,metadata)
  values(
    new.id,
    event_type_value,
    event_headline,
    case when maintenance_context is null
      then 'A thesis-bearing Story field changed. The complete prior version remains preserved.'
      else coalesce(maintenance_context ->> 'rationale','Existing Story was recalibrated against fresh evidence.')
    end,
    now(),
    event_metadata
  ) returning id into revision_event_id;

  insert into public.story_thesis_versions(
    story_id,event_id,version_number,title,thesis,status,confidence,market_question,dominant_narrative,best_explanation,strongest_support,strongest_contradiction,priced_assessment,confirmation_trigger,invalidation_trigger,next_catalyst,article_angle,provisional_title,article_verdict,assets,snapshot,change_reason,effective_at
  ) values(
    new.id,revision_event_id,next_version,new.title,new.thesis,new.status,new.confidence,new.market_question,new.dominant_narrative,new.best_explanation,new.strongest_support,new.strongest_contradiction,new.priced_assessment,new.confirmation_trigger,new.invalidation_trigger,new.next_catalyst,new.article_angle,new.provisional_title,new.article_verdict,new.assets,version_snapshot,change_reason_value,now()
  ) returning id into new_version_id;

  update public.stories
  set current_thesis_version_id=new_version_id
  where id=new.id and current_thesis_version_id is distinct from new_version_id;
  return new;
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
  material_allowed boolean := false;
  effective_status text := 'unchanged';
  public_status text;
  new_lifecycle_status text;
  new_thesis text;
  new_confidence integer;
  credible_count integer := 0;
  independent_groups integer := 0;
  has_tier_one_or_two boolean := false;
  evaluated_at timestamptz := now();
  maintenance_context jsonb;
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

  material_allowed := assessment.disposition <> 'unchanged'
    and credible_count > 0
    and (assessment.disposition <> 'reframed' or nullif(btrim(assessment.proposed_thesis), '') is not null)
    and (
      assessment.disposition <> 'invalidated'
      or has_tier_one_or_two
      or independent_groups >= 2
    );
  effective_status := case when material_allowed then assessment.disposition else 'unchanged' end;

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
      last_evidence_at=case when assessment.last_evidence_at is null then state.last_evidence_at else greatest(state.last_evidence_at,assessment.last_evidence_at) end,
      updated_at=evaluated_at
  where state.story_id=assessment.story_id;

  if material_allowed then
    public_status := case
      when effective_status='invalidated' then 'archived'
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
    new_thesis := case
      when effective_status='reframed' then btrim(assessment.proposed_thesis)
      else story_row.thesis
    end;
    new_confidence := round(greatest(0,least(100,case
      when effective_status='reinforced' then story_row.confidence + greatest(abs(assessment.confidence_delta),1)
      when effective_status='weakened' then story_row.confidence - greatest(abs(assessment.confidence_delta),1)
      when effective_status='invalidated' then story_row.confidence - greatest(abs(assessment.confidence_delta),25)
      else story_row.confidence + assessment.confidence_delta
    end)))::integer;

    maintenance_context := jsonb_build_object(
      'engineRunId',assessment.engine_run_id,
      'marketBeliefStageRunId',assessment.market_belief_stage_run_id,
      'disposition',effective_status,
      'rationale',assessment.rationale,
      'intelligenceEvidenceIds',assessment.evidence_ids
    );
    perform set_config('alchemy.story_maintenance_context',maintenance_context::text,true);

    update public.stories story
    set thesis=new_thesis,
        status=public_status,
        confidence=new_confidence,
        updated_at=evaluated_at
    where story.id=assessment.story_id;

    update public.intelligence_story_states state
    set lifecycle_status=new_lifecycle_status,
        publication_eligible=effective_status <> 'invalidated',
        updated_at=evaluated_at
    where state.story_id=assessment.story_id;

    insert into public.story_updates(story_id,update_type,headline,detail,observed_at,suppress_event_mirror)
    values(
      assessment.story_id,
      case when effective_status='invalidated' then 'invalidation' when effective_status='reinforced' then 'confirmation' else 'recalibration' end,
      left(assessment.rationale,90),
      assessment.rationale,
      evaluated_at,
      true
    );
  end if;

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
      material_change_applied=material_allowed,
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
