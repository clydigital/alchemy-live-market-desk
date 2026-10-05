-- B4e: server-side evidence acknowledgement guard for Story reevaluation.
--
-- New-format frozen Story review targets persist reviewContext.queueEvidenceIds.
-- When that field exists, an assessment may be persisted only if:
--   1. every claimed queue row belongs to the same Story;
--   2. every frozen queueEvidenceId corresponds to an evidence-backed queue row
--      in assessment.queue_ids; and
--   3. every frozen queueEvidenceId is explicitly present in assessment.evidence_ids.
--
-- Legacy frozen targets without queueEvidenceIds retain their existing replay
-- semantics. Motion/audit prose never satisfies this guard.

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
  if jsonb_typeof(required_evidence) <> 'array' then
    return new;
  end if;

  if exists (
    select 1
    from public.intelligence_reevaluation_queue queue
    where queue.id = any(coalesce(new.queue_ids, '{}'::uuid[]))
      and (
        queue.target_kind <> 'story'
        or queue.target_id <> new.story_id
      )
  ) then
    raise exception 'Story assessment queue IDs must target the same Story';
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

drop trigger if exists intelligence_story_assessments_guard_queue_evidence_ack
  on public.intelligence_story_assessments;

create trigger intelligence_story_assessments_guard_queue_evidence_ack
before insert or update of engine_run_id, story_id, queue_ids, evidence_ids
on public.intelligence_story_assessments
for each row
execute function public.guard_story_assessment_queue_evidence_ack();

commit;
