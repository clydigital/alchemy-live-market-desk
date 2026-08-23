-- PR #2: Existing-Story maintenance contract on top of Canonical Story Reasoning V1.
--
-- Market Belief may propose lightweight maintenance fields, but PostgreSQL owns
-- the mutation matrix. Canonical causal reasoning is never regenerated here:
-- maintenance versions carry the prior V1 reasoning forward and patch only the
-- lifecycle / confirmation / invalidation fields that this contract permits.

alter table public.intelligence_story_assessments
  add column if not exists proposed_updates jsonb not null default '{}'::jsonb;

alter table public.intelligence_story_assessments
  drop constraint if exists intelligence_story_assessments_proposed_updates_object_check;

alter table public.intelligence_story_assessments
  add constraint intelligence_story_assessments_proposed_updates_object_check
  check (jsonb_typeof(proposed_updates) = 'object');

create or replace function public.story_maintenance_allowed_fields(p_disposition text)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_disposition
    when 'unchanged' then array['nextCatalyst']::text[]
    when 'reinforced' then array['confirmation','invalidation','nextCatalyst']::text[]
    when 'weakened' then array['confirmation','invalidation','nextCatalyst']::text[]
    when 'reframed' then array['title','thesis','marketQuestion','confirmation','invalidation','nextCatalyst']::text[]
    when 'invalidated' then array[]::text[]
    else array[]::text[]
  end;
$$;

revoke all on function public.story_maintenance_allowed_fields(text) from public, anon, authenticated;
grant execute on function public.story_maintenance_allowed_fields(text) to service_role;

create or replace function public.story_maintenance_text_reframe_is_lightweight(
  p_old_text text,
  p_new_text text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  with scope_words as (
    select array[
      'a','an','the','currently','narrowly','primarily',
      'broadly','mainly','largely','still'
    ]::text[] as words
  ),
  old_tokens as (
    select coalesce(
      array_agg(token order by ordinal) filter (
        where token <> '' and not (token = any(scope_words.words))
      ),
      '{}'::text[]
    ) as old_tokens
    from scope_words
    cross join lateral regexp_split_to_table(
      lower(coalesce(p_old_text, '')),
      '[^a-z0-9]+'
    ) with ordinality token(token, ordinal)
  ),
  new_tokens as (
    select coalesce(
      array_agg(token order by ordinal) filter (
        where token <> '' and not (token = any(scope_words.words))
      ),
      '{}'::text[]
    ) as new_tokens
    from scope_words
    cross join lateral regexp_split_to_table(
      lower(coalesce(p_new_text, '')),
      '[^a-z0-9]+'
    ) with ordinality token(token, ordinal)
  )
  select coalesce(
    nullif(btrim(p_new_text), '') is not null
    and (select old_tokens from old_tokens) = (select new_tokens from new_tokens)
    and cardinality((select new_tokens from new_tokens)) > 0,
    false
  );
$$;

revoke all on function public.story_maintenance_text_reframe_is_lightweight(text, text) from public, anon, authenticated;
grant execute on function public.story_maintenance_text_reframe_is_lightweight(text, text) to service_role;

create or replace function public.story_maintenance_reframe_is_lightweight(
  p_old_thesis text,
  p_new_thesis text,
  p_rationale text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    public.story_maintenance_text_reframe_is_lightweight(p_old_thesis, p_new_thesis)
    and lower(coalesce(p_rationale, '')) !~
      '(caus(e|al)|driver|driven|mechanis|transmission|explanation|variable|channel|edge|rather than|instead of|replac|supplant|switch)',
    false
  );
$$;

revoke all on function public.story_maintenance_reframe_is_lightweight(text, text, text) from public, anon, authenticated;
grant execute on function public.story_maintenance_reframe_is_lightweight(text, text, text) to service_role;

create or replace function public.story_maintenance_catalyst_candidate_is_valid(
  p_current_label text,
  p_proposed_label text,
  p_proposed_ref text,
  p_review_context jsonb,
  p_require_due boolean
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(p_proposed_label), '') is not null
    and exists (
      select 1
      from jsonb_array_elements(case
        when jsonb_typeof(p_review_context -> 'catalystCandidates') = 'array'
          then p_review_context -> 'catalystCandidates'
        else '[]'::jsonb
      end) candidate
      where nullif(btrim(candidate ->> 'label'), '') = nullif(btrim(p_proposed_label), '')
        and nullif(btrim(candidate ->> 'catalystRef'), '')
          is not distinct from nullif(btrim(p_proposed_ref), '')
    )
    and (
      not p_require_due
      or (
        nullif(btrim(p_current_label), '') is not null
        and nullif(btrim(p_proposed_label), '') is distinct from nullif(btrim(p_current_label), '')
        and exists (
          select 1
          from jsonb_array_elements_text(case
            when jsonb_typeof(p_review_context -> 'dueCatalysts') = 'array'
              then p_review_context -> 'dueCatalysts'
            else '[]'::jsonb
          end) due
          where btrim(due) = btrim(p_current_label)
        )
      )
    ),
    false
  );
$$;

revoke all on function public.story_maintenance_catalyst_candidate_is_valid(text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.story_maintenance_catalyst_candidate_is_valid(text, text, text, jsonb, boolean) to service_role;

create or replace function public.story_maintenance_next_test_for_candidate(
  p_story_id uuid,
  p_candidate_label text,
  p_candidate_ref text,
  p_review_context jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  candidate_due boolean;
begin
  if p_story_id is null
    or not public.story_maintenance_catalyst_candidate_is_valid(
      null,
      p_candidate_label,
      p_candidate_ref,
      p_review_context,
      false
    ) then
    return null;
  end if;

  candidate_due := exists (
    select 1
    from jsonb_array_elements_text(case
      when jsonb_typeof(p_review_context -> 'dueCatalysts') = 'array'
        then p_review_context -> 'dueCatalysts'
      else '[]'::jsonb
    end) due
    where btrim(due) = btrim(p_candidate_label)
  );

  return jsonb_build_object(
    'id', 'story:' || p_story_id::text || ':next-test:'
      || md5(jsonb_build_array(
        nullif(btrim(p_candidate_label), ''),
        nullif(btrim(p_candidate_ref), '')
      )::text),
    'label', nullif(btrim(p_candidate_label), ''),
    'status', case when candidate_due then 'due' else 'upcoming' end,
    'catalystRef', nullif(btrim(p_candidate_ref), ''),
    'dueAt', null,
    'expiresAt', null,
    'evidenceIds', '[]'::jsonb,
    'resolutionEvidenceIds', '[]'::jsonb
  );
end;
$$;

revoke all on function public.story_maintenance_next_test_for_candidate(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.story_maintenance_next_test_for_candidate(uuid, text, text, jsonb) to service_role;

create or replace function public.story_maintenance_reasoning_for_version(
  p_prior_reasoning jsonb,
  p_reasoning_patch jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_prior_reasoning is null then
    return null;
  end if;
  if jsonb_typeof(p_prior_reasoning) <> 'object'
    or p_prior_reasoning ->> 'contractVersion' <> 'canonical-story-reasoning/v1' then
    raise exception 'Existing Story maintenance cannot carry forward an unknown reasoning contract';
  end if;
  if jsonb_typeof(p_reasoning_patch) <> 'object'
    or p_reasoning_patch - array['lifecycle','confirmation','invalidation','nextTest']::text[] <> '{}'::jsonb then
    raise exception 'Existing Story maintenance reasoning patch contains a protected field';
  end if;
  return p_prior_reasoning || p_reasoning_patch;
end;
$$;

revoke all on function public.story_maintenance_reasoning_for_version(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.story_maintenance_reasoning_for_version(jsonb, jsonb) to service_role;

create or replace function public.freeze_story_assessment_proposed_updates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  matching_assessments jsonb;
  stage_assessment jsonb;
  proposed_confirmation jsonb;
  proposed_invalidation jsonb;
  proposed_next_catalyst jsonb;
  stage_proposed_thesis text;
begin
  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into matching_assessments
  from public.intelligence_stage_runs stage
  cross join lateral jsonb_array_elements(coalesce(stage.output_payload -> 'storyAssessments', '[]'::jsonb)) item
  where stage.id = new.market_belief_stage_run_id
    and item ->> 'storyId' = new.story_id::text;

  if jsonb_array_length(matching_assessments) <> 1 then
    raise exception 'Story assessment proposal must match exactly one persisted Market Belief assessment';
  end if;

  stage_assessment := matching_assessments -> 0;
  stage_proposed_thesis := nullif(btrim(stage_assessment ->> 'proposedThesis'), '');

  if nullif(btrim(new.proposed_thesis), '') is distinct from stage_proposed_thesis then
    raise exception 'Story assessment proposed thesis does not match persisted Market Belief output';
  end if;

  proposed_confirmation := stage_assessment -> 'proposedConfirmation';
  proposed_invalidation := stage_assessment -> 'proposedInvalidation';
  proposed_next_catalyst := stage_assessment -> 'proposedNextCatalyst';

  if proposed_confirmation is not null
    and jsonb_typeof(proposed_confirmation) not in ('array', 'null') then
    raise exception 'Story assessment proposedConfirmation must be an array or null';
  end if;
  if proposed_invalidation is not null
    and jsonb_typeof(proposed_invalidation) not in ('array', 'null') then
    raise exception 'Story assessment proposedInvalidation must be an array or null';
  end if;
  if proposed_next_catalyst is not null
    and jsonb_typeof(proposed_next_catalyst) not in ('object', 'null') then
    raise exception 'Story assessment proposedNextCatalyst must be an object or null';
  end if;
  if jsonb_typeof(proposed_next_catalyst) = 'object'
    and nullif(btrim(proposed_next_catalyst ->> 'label'), '') is null then
    raise exception 'Story assessment proposedNextCatalyst label is required';
  end if;

  new.proposed_updates := jsonb_build_object(
    'title', nullif(btrim(stage_assessment ->> 'proposedTitle'), ''),
    'thesis', stage_proposed_thesis,
    'marketQuestion', nullif(btrim(stage_assessment ->> 'proposedMarketQuestion'), ''),
    'confirmation', case
      when jsonb_typeof(proposed_confirmation) = 'array' then proposed_confirmation
      else 'null'::jsonb
    end,
    'invalidation', case
      when jsonb_typeof(proposed_invalidation) = 'array' then proposed_invalidation
      else 'null'::jsonb
    end,
    'nextCatalyst', case
      when jsonb_typeof(proposed_next_catalyst) = 'object' then jsonb_build_object(
        'label', nullif(btrim(proposed_next_catalyst ->> 'label'), ''),
        'catalystRef', nullif(btrim(proposed_next_catalyst ->> 'catalystRef'), '')
      )
      else 'null'::jsonb
    end
  );

  return new;
end;
$$;

revoke all on function public.freeze_story_assessment_proposed_updates() from public, anon, authenticated;
grant execute on function public.freeze_story_assessment_proposed_updates() to service_role;

drop trigger if exists intelligence_story_assessments_freeze_proposed_updates
  on public.intelligence_story_assessments;
create trigger intelligence_story_assessments_freeze_proposed_updates
before insert on public.intelligence_story_assessments
for each row execute function public.freeze_story_assessment_proposed_updates();

-- Extend the PR #99 single version trigger. Canonical Story reasoning remains
-- authoritative; lightweight maintenance starts from the previous immutable V1
-- snapshot and can only replace top-level lifecycle / criteria arrays.
create or replace function public.capture_story_thesis_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version integer;
  new_version_id uuid;
  revision_event_id uuid;
  maintenance_context jsonb;
  reasoning_context jsonb;
  event_metadata jsonb;
  version_snapshot jsonb;
  prior_reasoning jsonb;
  carried_reasoning jsonb;
  reasoning_patch jsonb;
  event_type_value text := 'thesis_revision';
  event_headline text;
  event_detail text;
  event_at_value timestamptz := now();
  confidence_delta_value integer;
  change_reason_value text := 'story_updated';
begin
  begin
    maintenance_context := nullif(current_setting('alchemy.story_maintenance_context', true), '')::jsonb;
  exception when others then
    maintenance_context := null;
  end;

  begin
    reasoning_context := nullif(current_setting('alchemy.story_reasoning_context', true), '')::jsonb;
  exception when others then
    reasoning_context := null;
  end;

  if maintenance_context is not null and reasoning_context is not null then
    raise exception 'Story maintenance and canonical reasoning contexts cannot be active together';
  end if;
  if maintenance_context is not null and jsonb_typeof(maintenance_context) <> 'object' then
    raise exception 'Story maintenance context is invalid';
  end if;

  if reasoning_context is not null and (
    jsonb_typeof(reasoning_context) <> 'object'
    or nullif(btrim(reasoning_context ->> 'mutationKey'), '') is null
    or reasoning_context ->> 'mutationKind' <> 'existing_story_update'
    or jsonb_typeof(reasoning_context -> 'reasoning') <> 'object'
    or reasoning_context -> 'reasoning' ->> 'contractVersion' <> 'canonical-story-reasoning/v1'
    or jsonb_typeof(coalesce(reasoning_context -> 'eventMetadata', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Canonical Story reasoning context is invalid';
  end if;

  if row(
    new.title,new.thesis,new.status,new.confidence,new.market_question,new.dominant_narrative,
    new.best_explanation,new.strongest_support,new.strongest_contradiction,new.priced_assessment,
    new.confirmation_trigger,new.invalidation_trigger,new.next_catalyst,new.article_angle,
    new.provisional_title,new.article_verdict,new.assets
  ) is not distinct from row(
    old.title,old.thesis,old.status,old.confidence,old.market_question,old.dominant_narrative,
    old.best_explanation,old.strongest_support,old.strongest_contradiction,old.priced_assessment,
    old.confirmation_trigger,old.invalidation_trigger,old.next_catalyst,old.article_angle,
    old.provisional_title,old.article_verdict,old.assets
  ) and reasoning_context is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));
  select coalesce(max(version.version_number), 0) + 1
  into next_version
  from public.story_thesis_versions version
  where version.story_id = new.id;

  event_metadata := jsonb_build_object(
    'automatic', true,
    'previous_version_id', old.current_thesis_version_id
  );
  version_snapshot := to_jsonb(new);
  event_headline := format('Story thesis version %s recorded', next_version);
  event_detail := 'A thesis-bearing Story field changed. The complete prior version remains preserved.';

  if reasoning_context is not null then
    event_metadata := coalesce(reasoning_context -> 'eventMetadata', '{}'::jsonb) || jsonb_build_object(
      'automatic', true,
      'origin', 'alchemy_research_engine',
      'canonicalMutationKey', reasoning_context ->> 'mutationKey',
      'previous_version_id', old.current_thesis_version_id
    );
    version_snapshot := version_snapshot || jsonb_build_object(
      'origin', 'alchemy_research_engine',
      'canonicalMutationKey', reasoning_context ->> 'mutationKey',
      'canonicalMutationKind', 'existing_story_update',
      'priorVersion', next_version - 1,
      'reasoning', reasoning_context -> 'reasoning'
    );
    event_headline := left(reasoning_context ->> 'eventHeadline', 180);
    event_detail := reasoning_context ->> 'eventDetail';
    event_at_value := (reasoning_context ->> 'eventAt')::timestamptz;
    confidence_delta_value := new.confidence - old.confidence;
    change_reason_value := 'material_evidence_recalibration';
  elsif maintenance_context is not null then
    reasoning_patch := coalesce(maintenance_context -> 'reasoningPatch', '{}'::jsonb);
    if jsonb_typeof(reasoning_patch) <> 'object' then
      raise exception 'Story maintenance reasoning patch must be an object';
    end if;

    if old.current_thesis_version_id is not null then
      select version.snapshot -> 'reasoning'
      into prior_reasoning
      from public.story_thesis_versions version
      where version.id = old.current_thesis_version_id
        and version.story_id = new.id;
    end if;

    carried_reasoning := public.story_maintenance_reasoning_for_version(prior_reasoning, reasoning_patch);
    if carried_reasoning is not null then
      version_snapshot := version_snapshot || jsonb_build_object(
        'reasoning', carried_reasoning
      );
    end if;

    event_metadata := event_metadata || jsonb_build_object('origin', 'existing_story_maintenance') || maintenance_context;
    version_snapshot := version_snapshot || jsonb_build_object('maintenanceContext', maintenance_context);
    change_reason_value := 'material_evidence_recalibration';
    confidence_delta_value := new.confidence - old.confidence;
    event_type_value := case
      when maintenance_context ->> 'disposition' = 'invalidated' then 'invalidation'
      when maintenance_context ->> 'disposition' = 'reinforced' then 'confirmation'
      else 'thesis_revision'
    end;
    event_headline := left(format(
      'Existing Story %s: %s',
      maintenance_context ->> 'disposition',
      coalesce(maintenance_context ->> 'rationale', 'material evidence recalibration')
    ), 180);
    event_detail := coalesce(
      maintenance_context ->> 'rationale',
      'Existing Story was recalibrated against fresh evidence.'
    );
  end if;

  if nullif(btrim(event_headline), '') is null then
    raise exception 'Story thesis event headline is required';
  end if;

  insert into public.story_events (
    story_id,event_type,headline,detail,confidence_delta,event_at,metadata
  ) values (
    new.id,event_type_value,event_headline,event_detail,confidence_delta_value,event_at_value,event_metadata
  ) returning id into revision_event_id;

  insert into public.story_thesis_versions (
    story_id,event_id,version_number,title,thesis,status,confidence,market_question,
    dominant_narrative,best_explanation,strongest_support,strongest_contradiction,
    priced_assessment,confirmation_trigger,invalidation_trigger,next_catalyst,
    article_angle,provisional_title,article_verdict,assets,snapshot,change_reason,effective_at
  ) values (
    new.id,revision_event_id,next_version,new.title,new.thesis,new.status,new.confidence,new.market_question,
    new.dominant_narrative,new.best_explanation,new.strongest_support,new.strongest_contradiction,
    new.priced_assessment,new.confirmation_trigger,new.invalidation_trigger,new.next_catalyst,
    new.article_angle,new.provisional_title,new.article_verdict,new.assets,version_snapshot,change_reason_value,event_at_value
  ) returning id into new_version_id;

  if reasoning_context is not null then
    perform set_config('alchemy.story_reasoning_context', '', true);
  end if;
  if maintenance_context is not null then
    perform set_config('alchemy.story_maintenance_context', '', true);
  end if;

  update public.stories story
  set current_thesis_version_id = new_version_id
  where story.id = new.id
    and story.current_thesis_version_id is distinct from new_version_id;

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
        when material_allowed and story_changed and effective_status='invalidated' then false
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

-- Prompt version remains inside the existing Market Belief stage. The schema is
-- supplied by application code; this text only defines the lightweight proposal
-- semantics and mechanism boundary.
update public.intelligence_prompt_versions
set is_active=false,
    retired_at=coalesce(retired_at, now())
where stage_key='market_belief'
  and is_active=true;

insert into public.intelligence_prompt_versions(
  stage_key,version,prompt_text,output_schema,model_hint,is_active
)
select
  'market_belief',
  coalesce((select max(version) from public.intelligence_prompt_versions where stage_key='market_belief'),0)+1,
  $prompt$State the market belief that appears priced or broadly expected before considering the new divergence.
For every supplied storyReviewTargets item, return exactly one Story assessment. The proposal fields are candidate maintenance only; PostgreSQL owns the mutation decision.
Use the disposition matrix strictly:
- unchanged: do not propose title, thesis, question, confirmation or invalidation changes. A next-catalyst proposal is allowed only when the current catalyst is in reviewContext.dueCatalysts and the replacement is exactly one reviewContext.catalystCandidates item.
- reinforced: do not propose title, thesis or question changes. Confirmation, invalidation and next catalyst may be proposed only when supported by the supplied canonical evidence/candidates.
- weakened: do not propose title, thesis or question changes. Confirmation, invalidation and next catalyst may be proposed only when supported by the supplied canonical evidence/candidates.
- reframed: title, thesis, question, confirmation, invalidation and next catalyst may be proposed, but only for a wording/scope reframe that preserves the existing causal mechanism.
- invalidated: do not propose direct Story-field rewrites; invalidation preserves the historical invalidation trigger and changes lifecycle/confidence only.
Never use lightweight maintenance to introduce a new causal mechanism, causal edge, asset transmission, overlooked variable or materially different accepted explanation. Evidence requiring any of those belongs in the normal Divergence -> Hypothesis -> Challenger -> Scenario -> Story Synthesis path. Creator/video transcript evidence may wake review or suggest a test but cannot by itself materially mutate a Story.$prompt$,
  coalesce((select output_schema from public.intelligence_prompt_versions where stage_key='market_belief' order by version desc limit 1),'{}'::jsonb),
  coalesce((select model_hint from public.intelligence_prompt_versions where stage_key='market_belief' order by version desc limit 1),'gpt-5.6-luna'),
  true;

-- Rollback path (not executed here):
-- 1. deactivate/remove the newest market_belief prompt and reactivate its predecessor;
-- 2. restore the exact pre-PR2 apply_intelligence_story_assessment() and
--    PR #99 capture_story_thesis_version() definitions;
-- 3. drop intelligence_story_assessments_freeze_proposed_updates and its
--    function, helper functions and proposed_updates constraint/column.
-- No historical Story, Story event or thesis-version row is rewritten here.
