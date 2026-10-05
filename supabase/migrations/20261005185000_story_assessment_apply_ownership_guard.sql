-- B4m: re-check Story queue ownership at the assessment apply boundary.
--
-- B4l guarantees ownership when the assessment is persisted. Queue ownership
-- can still change before apply. This trigger fires when an unapplied assessment
-- is about to receive applied_at; if ownership was lost, raising an exception
-- aborts the surrounding PostgreSQL transaction and therefore rolls back any
-- Story/state mutation performed earlier by the apply RPC.
--
-- Legacy frozen targets without reviewContext.queueEvidenceIds keep their
-- historical replay semantics.

begin;

create or replace function public.guard_story_assessment_apply_queue_ownership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_context jsonb;
  queue_evidence_ids jsonb;
begin
  if new.applied_at is null or old.applied_at is not null then
    return new;
  end if;

  select target -> 'reviewContext'
  into review_context
  from public.intelligence_engine_runs run
  cross join lateral jsonb_array_elements(case
    when jsonb_typeof(run.metadata #> '{frozenInputs,storyReviewTargets}') = 'array'
      then run.metadata #> '{frozenInputs,storyReviewTargets}'
    else '[]'::jsonb
  end) target
  where run.id = new.engine_run_id
    and target -> 'story' ->> 'id' = new.story_id::text
  limit 1;

  queue_evidence_ids := review_context -> 'queueEvidenceIds';

  -- Compatibility boundary: B4c introduced queueEvidenceIds. Historical frozen
  -- targets without that field remain replayable exactly as before.
  if coalesce(jsonb_typeof(queue_evidence_ids), 'null') <> 'array' then
    return new;
  end if;

  -- Hold the queue rows through the rest of the apply transaction so ownership
  -- cannot change between this validation and the canonical queue-completion update.
  perform 1
  from public.intelligence_reevaluation_queue queue
  where queue.id = any(coalesce(new.queue_ids, '{}'::uuid[]))
  order by queue.id
  for update;

  if exists (
    select 1
    from unnest(coalesce(new.queue_ids, '{}'::uuid[])) assessment_queue(queue_id)
    where not exists (
      select 1
      from public.intelligence_reevaluation_queue queue
      where queue.id = assessment_queue.queue_id
        and queue.target_kind = 'story'
        and queue.target_id = new.story_id
        and queue.status = 'processing'
        and queue.claimed_by_engine_run_id is not distinct from new.engine_run_id
    )
  ) then
    raise exception 'Story assessment lost queue ownership before apply';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_story_assessment_apply_queue_ownership()
  from public, anon, authenticated;

drop trigger if exists intelligence_story_assessments_guard_apply_queue_ownership
  on public.intelligence_story_assessments;

create trigger intelligence_story_assessments_guard_apply_queue_ownership
before update of applied_at
on public.intelligence_story_assessments
for each row
execute function public.guard_story_assessment_apply_queue_ownership();

commit;
