-- Budget-neutral repair: deterministic Story review selection remains inside
-- the existing Market Belief invocation. No cron, queue service or model stage
-- is introduced by this migration.

alter table public.intelligence_reevaluation_queue
  add column if not exists claimed_by_engine_run_id uuid
    references public.intelligence_engine_runs(id) on delete set null;

alter table public.intelligence_reevaluation_queue
  drop constraint if exists intelligence_reevaluation_queue_status_check;

alter table public.intelligence_reevaluation_queue
  add constraint intelligence_reevaluation_queue_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'retryable', 'cancelled'));

create index if not exists intelligence_reevaluation_queue_review_idx
  on public.intelligence_reevaluation_queue(target_kind, status, priority desc, available_at, created_at);

alter table public.research_debt
  add column if not exists story_id uuid references public.stories(id) on delete cascade;

create index if not exists research_debt_story_due_idx
  on public.research_debt(story_id, status, severity, next_check_at)
  where story_id is not null and status = 'open';

create table if not exists public.intelligence_story_assessments (
  id uuid primary key default gen_random_uuid(),
  engine_run_id uuid not null references public.intelligence_engine_runs(id) on delete cascade,
  market_belief_stage_run_id uuid not null references public.intelligence_stage_runs(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  queue_ids uuid[] not null default '{}'::uuid[],
  model_disposition text not null check (model_disposition in ('unchanged', 'reinforced', 'weakened', 'reframed', 'invalidated')),
  disposition text not null check (disposition in ('unchanged', 'reinforced', 'weakened', 'reframed', 'invalidated')),
  rationale text not null,
  confidence_delta numeric(5,2) not null default 0 check (confidence_delta between -100 and 100),
  proposed_thesis text,
  evidence_ids uuid[] not null default '{}'::uuid[],
  eligible_evidence_ids uuid[] not null default '{}'::uuid[],
  last_evidence_at timestamptz,
  selected_reason text not null,
  selected_at timestamptz not null,
  material_change_applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique(engine_run_id, story_id)
);

create index if not exists intelligence_story_assessments_story_time_idx
  on public.intelligence_story_assessments(story_id, selected_at desc);

alter table public.intelligence_story_assessments enable row level security;
revoke all on table public.intelligence_story_assessments from anon, authenticated, service_role;
grant select, insert, update on table public.intelligence_story_assessments to service_role;

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

  if jsonb_typeof(existing_targets) <> 'array' then
    -- Enrich the deterministic selector output with the exact blocker/queue
    -- context before freezing. This means a resumed Market Belief call knows
    -- why the Story was reopened, rather than only seeing a generic reason tag.
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

create or replace function public.claim_intelligence_story_reevaluations(
  p_engine_run_id uuid,
  p_queue_ids uuid[]
)
returns setof public.intelligence_reevaluation_queue
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Repair abandoned claims opportunistically during the normal research cycle.
  -- No extra cron is required. Partial engines retain their claim for a bounded
  -- window; terminal or old claims become retryable.
  update public.intelligence_reevaluation_queue queue
  set status = 'retryable',
      claimed_by_engine_run_id = null,
      available_at = now(),
      last_error = coalesce(queue.last_error, 'Recovered abandoned Story reevaluation claim.'),
      updated_at = now()
  where queue.target_kind = 'story'
    and queue.status = 'processing'
    and (
      queue.updated_at < now() - interval '20 minutes'
      or exists (
        select 1
        from public.intelligence_engine_runs run
        where run.id = queue.claimed_by_engine_run_id
          and run.status in ('completed', 'failed', 'blocked')
      )
    );

  return query
  update public.intelligence_reevaluation_queue as queue
  set status = 'processing',
      claimed_by_engine_run_id = p_engine_run_id,
      started_at = coalesce(queue.started_at, now()),
      attempts = case when queue.status in ('pending', 'retryable') then queue.attempts + 1 else queue.attempts end,
      last_error = null,
      updated_at = now()
  where queue.id in (
    select pending.id
    from public.intelligence_reevaluation_queue pending
    where pending.id = any(p_queue_ids)
      and pending.target_kind = 'story'
      and pending.available_at <= now()
      and (
        pending.status in ('pending', 'retryable')
        or (pending.status = 'processing' and pending.claimed_by_engine_run_id = p_engine_run_id)
      )
    order by pending.priority desc, pending.created_at, pending.id
    for update skip locked
  )
  returning queue.*;
end;
$$;

revoke all on function public.claim_intelligence_story_reevaluations(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.claim_intelligence_story_reevaluations(uuid, uuid[]) to service_role;

create or replace function public.claim_intelligence_story_reevaluation(
  p_queue_id uuid default null
)
returns setof public.intelligence_reevaluation_queue
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.intelligence_reevaluation_queue queue
  set status = 'retryable',
      claimed_by_engine_run_id = null,
      available_at = now(),
      last_error = coalesce(queue.last_error, 'Recovered abandoned Story reevaluation claim.'),
      updated_at = now()
  where queue.target_kind = 'story'
    and queue.status = 'processing'
    and (
      queue.updated_at < now() - interval '20 minutes'
      or exists (
        select 1
        from public.intelligence_engine_runs run
        where run.id = queue.claimed_by_engine_run_id
          and run.status in ('completed', 'failed', 'blocked')
      )
    );

  return query
  update public.intelligence_reevaluation_queue as queue
  set status = 'processing',
      started_at = now(),
      attempts = queue.attempts + 1,
      last_error = null,
      updated_at = now()
  where queue.id = (
    select pending.id
    from public.intelligence_reevaluation_queue as pending
    where pending.target_kind = 'story'
      and pending.status in ('pending', 'retryable')
      and pending.available_at <= now()
      and (p_queue_id is null or pending.id = p_queue_id)
    order by pending.priority desc, pending.created_at, pending.id
    for update skip locked
    limit 1
  )
  returning queue.*;
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
  lifecycle_status text;
  new_thesis text;
  new_confidence numeric;
  credible_count integer := 0;
  independent_groups integer := 0;
  has_tier_one_or_two boolean := false;
  existing_version_id uuid;
  event_id uuid;
  next_version integer;
  evaluated_at timestamptz := now();
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

  -- Enforce the material-mutation policy again inside the database boundary.
  -- Creator/research-analysis rows never authorise a canonical mutation.
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
    and (
      assessment.disposition <> 'invalidated'
      or has_tier_one_or_two
      or independent_groups >= 2
    );
  effective_status := case when material_allowed then assessment.disposition else 'unchanged' end;

  insert into public.intelligence_story_states (story_id, last_evaluated_at, last_evidence_at)
  values (assessment.story_id, evaluated_at, assessment.last_evidence_at)
  on conflict (story_id) do nothing;

  -- Every valid assessment advances the review watermark. An unchanged review
  -- stops here and does not manufacture a Story Event or thesis version.
  update public.intelligence_story_states state
  set last_evaluated_at = evaluated_at,
      last_evidence_at = case
        when assessment.last_evidence_at is null then state.last_evidence_at
        else greatest(state.last_evidence_at, assessment.last_evidence_at)
      end,
      updated_at = evaluated_at
  where state.story_id = assessment.story_id;

  if material_allowed then
    public_status := case
      when effective_status = 'invalidated' then 'archived'
      when effective_status in ('weakened', 'reframed') then 'develop'
      else story_row.status
    end;
    lifecycle_status := case
      when effective_status = 'reinforced' then 'confirmed'
      when effective_status = 'weakened' then 'weakening'
      when effective_status = 'reframed' then 'developing'
      when effective_status = 'invalidated' then 'invalidated'
      else coalesce((select lifecycle_status from public.intelligence_story_states where story_id = assessment.story_id), 'detected')
    end;
    new_thesis := case
      when effective_status = 'reframed' and nullif(btrim(assessment.proposed_thesis), '') is not null
        then btrim(assessment.proposed_thesis)
      else story_row.thesis
    end;
    new_confidence := greatest(0, least(100, case
      when effective_status = 'reinforced'
        then story_row.confidence + greatest(abs(assessment.confidence_delta), 1)
      when effective_status = 'weakened'
        then story_row.confidence - greatest(abs(assessment.confidence_delta), 1)
      when effective_status = 'invalidated'
        then story_row.confidence - greatest(abs(assessment.confidence_delta), 25)
      else story_row.confidence + assessment.confidence_delta
    end));

    -- Idempotency marker: one maintenance thesis version per Market Belief stage.
    select version.id into existing_version_id
    from public.story_thesis_versions version
    where version.story_id = assessment.story_id
      and version.snapshot ->> 'marketBeliefStageRunId' = assessment.market_belief_stage_run_id::text
    order by version.version_number desc
    limit 1;

    if existing_version_id is null then
      select event.id into event_id
      from public.story_events event
      where event.story_id = assessment.story_id
        and event.metadata ->> 'marketBeliefStageRunId' = assessment.market_belief_stage_run_id::text
      order by event.event_at desc
      limit 1;

      if event_id is null then
        insert into public.story_events (
          story_id,
          evidence_id,
          research_run_id,
          event_type,
          headline,
          detail,
          confidence_delta,
          event_at,
          metadata
        ) values (
          assessment.story_id,
          assessment.evidence_ids[1],
          (select research_run_id from public.intelligence_engine_runs where id = assessment.engine_run_id),
          case
            when effective_status = 'invalidated' then 'invalidation'
            when effective_status = 'reinforced' then 'confirmation'
            else 'thesis_revision'
          end,
          left(assessment.rationale, 180),
          assessment.rationale,
          new_confidence - story_row.confidence,
          evaluated_at,
          jsonb_build_object(
            'automatic', true,
            'origin', 'existing_story_maintenance',
            'engineRunId', assessment.engine_run_id,
            'marketBeliefStageRunId', assessment.market_belief_stage_run_id,
            'disposition', effective_status,
            'evidenceIds', assessment.evidence_ids
          )
        ) returning id into event_id;
      end if;

      select coalesce(max(version_number), 0) + 1
      into next_version
      from public.story_thesis_versions
      where story_id = assessment.story_id;

      insert into public.story_thesis_versions (
        story_id,
        event_id,
        version_number,
        title,
        thesis,
        status,
        confidence,
        market_question,
        dominant_narrative,
        best_explanation,
        strongest_support,
        strongest_contradiction,
        priced_assessment,
        confirmation_trigger,
        invalidation_trigger,
        next_catalyst,
        article_angle,
        provisional_title,
        article_verdict,
        assets,
        snapshot,
        change_reason,
        effective_at
      ) values (
        assessment.story_id,
        event_id,
        next_version,
        story_row.title,
        new_thesis,
        public_status,
        new_confidence,
        story_row.market_question,
        story_row.dominant_narrative,
        story_row.best_explanation,
        story_row.strongest_support,
        story_row.strongest_contradiction,
        story_row.priced_assessment,
        story_row.confirmation_trigger,
        story_row.invalidation_trigger,
        story_row.next_catalyst,
        assessment.rationale,
        story_row.title,
        'story_maintenance',
        story_row.assets,
        jsonb_build_object(
          'origin', 'existing_story_maintenance',
          'engineRunId', assessment.engine_run_id,
          'marketBeliefStageRunId', assessment.market_belief_stage_run_id,
          'disposition', effective_status,
          'evidenceIds', assessment.evidence_ids,
          'priorVersion', next_version - 1
        ),
        'material_evidence_recalibration',
        evaluated_at
      ) returning id into existing_version_id;
    end if;

    update public.stories story
    set thesis = new_thesis,
        status = public_status,
        confidence = new_confidence,
        current_thesis_version_id = existing_version_id,
        updated_at = evaluated_at
    where story.id = assessment.story_id;

    update public.intelligence_story_states state
    set lifecycle_status = lifecycle_status,
        publication_eligible = effective_status <> 'invalidated',
        updated_at = evaluated_at
    where state.story_id = assessment.story_id;

    insert into public.story_updates (story_id, update_type, headline, detail, observed_at)
    values (
      assessment.story_id,
      case
        when effective_status = 'invalidated' then 'invalidation'
        when effective_status = 'reinforced' then 'confirmation'
        else 'recalibration'
      end,
      left(assessment.rationale, 90),
      assessment.rationale,
      evaluated_at
    );
  end if;

  update public.intelligence_story_assessments
  set disposition = effective_status,
      material_change_applied = material_allowed,
      applied_at = evaluated_at
  where id = assessment.id;

  update public.intelligence_reevaluation_queue queue
  set status = 'completed',
      completed_at = evaluated_at,
      last_error = null,
      updated_at = evaluated_at
  where queue.id = any(assessment.queue_ids)
    and queue.status = 'processing'
    and queue.claimed_by_engine_run_id = assessment.engine_run_id;

  return query select true, effective_status;
end;
$$;

revoke all on function public.apply_intelligence_story_assessment(uuid) from public, anon, authenticated;
grant execute on function public.apply_intelligence_story_assessment(uuid) to service_role;

comment on table public.intelligence_story_assessments is
  'One idempotent existing-Story assessment per engine run, produced inside the existing Market Belief stage.';
comment on column public.research_debt.story_id is
  'Optional Story-local scope. Null debt remains diagnostic and cannot block unrelated Story publication.';

-- Freshness-only reviews must not manufacture a Story history version. Material
-- changes continue to use the existing history trigger.
drop trigger if exists intelligence_story_states_history on public.intelligence_story_states;
create trigger intelligence_story_states_history
before update on public.intelligence_story_states
for each row when (
  (to_jsonb(old) - array['last_evaluated_at', 'last_evidence_at', 'updated_at'])
  is distinct from
  (to_jsonb(new) - array['last_evaluated_at', 'last_evidence_at', 'updated_at'])
)
execute function public.intelligence_capture_story_history();

alter table public.macro_releases
  add column if not exists ingestion_attempt_status text,
  add column if not exists ingestion_retry_exhausted boolean not null default false;

alter table public.macro_releases
  drop constraint if exists macro_releases_status_check;

alter table public.macro_releases
  add constraint macro_releases_status_check
  check (status in (
    'upcoming', 'scheduled', 'pre_release', 'ingestion_pending',
    'released_pending_ingestion', 'completed', 'revision_detected', 'stale_error'
  ));

drop function if exists public.refresh_macro_release_lifecycle(timestamptz, interval);

create function public.refresh_macro_release_lifecycle(
  p_now timestamptz default now(),
  p_ingestion_grace interval default interval '4 hours'
)
returns table (
  evaluated_count integer,
  scheduled_count integer,
  pre_release_count integer,
  ingestion_pending_count integer,
  released_pending_ingestion_count integer,
  completed_count integer,
  revision_detected_count integer,
  stale_error_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.macro_releases release
  set status = case
        when nullif(btrim(release.actual), '') is not null and release.status = 'revision_detected' then 'revision_detected'
        when nullif(btrim(release.actual), '') is not null then 'completed'
        when release.release_date > p_now + interval '24 hours' then 'scheduled'
        when release.release_date > p_now then 'pre_release'
        when release.last_ingestion_attempt_at is null then 'ingestion_pending'
        when release.ingestion_retry_exhausted then 'stale_error'
        else 'released_pending_ingestion'
      end,
      released_at = case
        when nullif(btrim(release.actual), '') is not null then coalesce(release.released_at, release.published_at)
        else release.released_at
      end,
      ingestion_gap_reason = case
        when nullif(btrim(release.actual), '') is not null or release.release_date > p_now then null
        when release.last_ingestion_attempt_at is null
          then 'The release time passed and no official Actual ingestion attempt is recorded yet.'
        when release.ingestion_retry_exhausted
          then coalesce(release.ingestion_gap_reason, 'Verified official Actual ingestion attempts failed and the retry policy is exhausted.')
        else coalesce(release.ingestion_gap_reason, 'Official Actual ingestion was attempted and remains inside its grace or retry state.')
      end,
      lifecycle_evaluated_at = p_now,
      updated_at = case
        when release.status is distinct from case
          when nullif(btrim(release.actual), '') is not null and release.status = 'revision_detected' then 'revision_detected'
          when nullif(btrim(release.actual), '') is not null then 'completed'
          when release.release_date > p_now + interval '24 hours' then 'scheduled'
          when release.release_date > p_now then 'pre_release'
          when release.last_ingestion_attempt_at is null then 'ingestion_pending'
          when release.ingestion_retry_exhausted then 'stale_error'
          else 'released_pending_ingestion'
        end then p_now
        else release.updated_at
      end
  where release.release_date is not null;

  get diagnostics evaluated_count = row_count;

  select
    count(*) filter (where status = 'scheduled'),
    count(*) filter (where status = 'pre_release'),
    count(*) filter (where status = 'ingestion_pending'),
    count(*) filter (where status = 'released_pending_ingestion'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'revision_detected'),
    count(*) filter (where status = 'stale_error')
  into scheduled_count, pre_release_count, ingestion_pending_count,
    released_pending_ingestion_count, completed_count, revision_detected_count, stale_error_count
  from public.macro_releases;

  return next;
end;
$$;

revoke all on function public.refresh_macro_release_lifecycle(timestamptz, interval) from public, anon, authenticated;
grant execute on function public.refresh_macro_release_lifecycle(timestamptz, interval) to service_role;

alter table public.macro_source_snapshots
  add column if not exists transport_error_message text,
  add column if not exists authentication_mode text;

comment on column public.macro_source_snapshots.transport_error_message is
  'Bounded provider response excerpt for diagnostics; large response bodies are never persisted.';
comment on column public.macro_source_snapshots.authentication_mode is
  'Non-secret transport authentication mode such as bearer or none.';
