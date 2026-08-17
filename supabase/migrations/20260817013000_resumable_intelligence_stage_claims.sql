-- Intelligence stage state already exists. This migration only makes the
-- existing attempt ledger safe to resume and claim from concurrent invocations.

with ranked_started_attempts as (
  select
    id,
    row_number() over (
      partition by engine_run_id, stage_key
      order by started_at desc, id desc
    ) as attempt_rank
  from public.intelligence_stage_runs
  where status = 'started'
)
update public.intelligence_stage_runs as stage_runs
set
  status = 'failed',
  failure_code = 'superseded_active_claim',
  failure_detail = 'Superseded while installing the resumable intelligence stage claim constraint.',
  completed_at = now()
from ranked_started_attempts
where stage_runs.id = ranked_started_attempts.id
  and ranked_started_attempts.attempt_rank > 1;

create unique index if not exists intelligence_stage_runs_one_active_claim_uidx
  on public.intelligence_stage_runs(engine_run_id, stage_key)
  where status = 'started';

-- A recovered Challenger checkpoint is persisted again only to repair a
-- previously interrupted write. One assessment per hypothesis/attempt keeps
-- that repair idempotent while preserving later retry attempts as new rows.
with ranked_challenger_assessments as (
  select
    id,
    row_number() over (
      partition by stage_run_id, hypothesis_id
      order by assessed_at desc nulls last, id desc
    ) as assessment_rank
  from public.intelligence_challenger_assessments
  where stage_run_id is not null
)
delete from public.intelligence_challenger_assessments as assessments
using ranked_challenger_assessments
where assessments.id = ranked_challenger_assessments.id
  and ranked_challenger_assessments.assessment_rank > 1;

create unique index if not exists intelligence_challenger_assessments_stage_hypothesis_uidx
  on public.intelligence_challenger_assessments(stage_run_id, hypothesis_id);

create or replace function public.claim_intelligence_stage(
  p_engine_run_id uuid,
  p_stage_key text,
  p_prompt_version_id uuid,
  p_input_refs jsonb default '{}'::jsonb,
  p_stale_after_seconds integer default 360
)
returns table (
  stage_run_id uuid,
  claim_state text,
  output_payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_stage public.intelligence_stage_runs%rowtype;
  claimed_stage_id uuid;
  stale_before timestamptz := now() - make_interval(secs => greatest(60, least(p_stale_after_seconds, 3600)));
begin
  -- Serialise the read/expire/insert decision for this exact engine-stage pair.
  perform pg_advisory_xact_lock(hashtextextended(p_engine_run_id::text || ':' || p_stage_key, 0));

  select * into existing_stage
  from public.intelligence_stage_runs
  where engine_run_id = p_engine_run_id
    and stage_key = p_stage_key
    and status = 'completed'
  order by completed_at desc nulls last, started_at desc, id desc
  limit 1;
  if found then
    return query select existing_stage.id, 'completed'::text, existing_stage.output_payload;
    return;
  end if;

  update public.intelligence_stage_runs
  set
    status = 'failed',
    failure_code = 'abandoned_claim',
    failure_detail = 'A previous invocation did not release this stage claim before its bounded lease expired.',
    completed_at = now()
  where engine_run_id = p_engine_run_id
    and stage_key = p_stage_key
    and status = 'started'
    and started_at < stale_before;

  select * into existing_stage
  from public.intelligence_stage_runs
  where engine_run_id = p_engine_run_id
    and stage_key = p_stage_key
    and status = 'started'
  order by started_at desc, id desc
  limit 1;
  if found then
    return query select existing_stage.id, 'busy'::text, existing_stage.output_payload;
    return;
  end if;

  insert into public.intelligence_stage_runs (
    engine_run_id,
    prompt_version_id,
    stage_key,
    status,
    input_refs,
    started_at
  ) values (
    p_engine_run_id,
    p_prompt_version_id,
    p_stage_key,
    'started',
    coalesce(p_input_refs, '{}'::jsonb),
    now()
  )
  returning id into claimed_stage_id;

  return query select claimed_stage_id, 'claimed'::text, '{}'::jsonb;
end;
$$;

revoke all on function public.claim_intelligence_stage(uuid, text, uuid, jsonb, integer) from public;
grant execute on function public.claim_intelligence_stage(uuid, text, uuid, jsonb, integer) to service_role;

comment on function public.claim_intelligence_stage(uuid, text, uuid, jsonb, integer) is
  'Atomically returns a reusable completed stage, a fresh bounded claim, or a busy competing claim for one canonical intelligence engine run.';
