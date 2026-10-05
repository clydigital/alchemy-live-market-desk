-- B4l: make Story queue ownership a PostgreSQL persistence invariant.
--
-- B4k filters Story targets against the rows actually claimed by the current
-- engine run before System 2. This migration adds the same requirement at the
-- final assessment INSERT/UPDATE boundary so application drift or concurrency
-- cannot persist an assessment against queue rows owned by another run.
--
-- The existing B4e evidence-acknowledgement contract remains intact. Legacy
-- frozen targets without reviewContext.queueEvidenceIds keep their historical
-- replay semantics and bypass this newer ownership contract.

begin;

create or replace function public.guard_story_assessment_queue_evidence_ack()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_context jsonb;
  required_evidence jsonb;
begin
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

  required_evidence := review_context -> 'queueEvidenceIds';

  -- Compatibility boundary: older frozen targets predate B4c and have no
  -- queueEvidenceIds contract. New targets always persist an array, including [].
  if coalesce(jsonb_typeof(required_evidence), 'null') <> 'array' then
    return new;
  end if;

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
    raise exception 'Story assessment queue IDs must be processing and claimed by the same engine run';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(required_evidence) required(evidence_id)
    where not exists (
      select 1
      from public.intelligence_reevaluation_queue queue
      where queue.id = any(coalesce(new.queue_ids, '{}'::uuid[]))
        and queue.target_kind = 'story'
        and queue.target_id = new.story_id
        and queue.requested_by_evidence_id::text = required.evidence_id
    )
  ) then
    raise exception 'Frozen Story queue Evidence contract does not match assessment queue IDs';
  end if;

  if exists (
    select 1
    from public.intelligence_reevaluation_queue queue
    where queue.id = any(coalesce(new.queue_ids, '{}'::uuid[]))
      and queue.target_kind = 'story'
      and queue.target_id = new.story_id
      and queue.requested_by_evidence_id is not null
      and not exists (
        select 1
        from jsonb_array_elements_text(required_evidence) required(evidence_id)
        where required.evidence_id = queue.requested_by_evidence_id::text
      )
  ) then
    raise exception 'Assessment queue IDs contain Evidence absent from the frozen Story queue contract';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(required_evidence) required(evidence_id)
    where not exists (
      select 1
      from unnest(coalesce(new.evidence_ids, '{}'::uuid[])) acknowledged(evidence_id)
      where acknowledged.evidence_id::text = required.evidence_id
    )
  ) then
    raise exception 'Story assessment must acknowledge every queued canonical trigger Evidence ID';
  end if;

  return new;
end;
$$;


revoke all on function public.guard_story_assessment_queue_evidence_ack()
  from public, anon, authenticated;

comment on function public.guard_story_assessment_queue_evidence_ack() is
  'Guards new-format Story assessments so queue rows are owned by the same engine run and queued canonical trigger Evidence is explicitly acknowledged.';

commit;
