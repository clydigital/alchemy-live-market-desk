begin;

alter table public.research_gap_cases
  add column if not exists research_plan_version text null,
  add column if not exists research_plan jsonb null,
  add column if not exists research_started_at timestamptz null,
  add column if not exists verdict_version text null,
  add column if not exists verdict jsonb null;

alter table public.research_gap_cases
  drop constraint if exists research_gap_cases_plan_shape_check;

alter table public.research_gap_cases
  add constraint research_gap_cases_plan_shape_check
  check (
    (research_plan is null and research_plan_version is null and research_started_at is null)
    or
    (
      research_plan is not null
      and research_plan_version = 'research-gap-plan/1'
      and jsonb_typeof(research_plan) = 'object'
    )
  );

alter table public.research_gap_cases
  drop constraint if exists research_gap_cases_verdict_shape_check;

alter table public.research_gap_cases
  add constraint research_gap_cases_verdict_shape_check
  check (
    (verdict is null and verdict_version is null)
    or
    (
      verdict is not null
      and verdict_version = 'research-gap-verdict/1'
      and jsonb_typeof(verdict) = 'object'
    )
  );

create or replace function public.start_research_gap_case(
  p_case_id uuid,
  p_claim_token uuid,
  p_plan_version text,
  p_plan jsonb,
  p_started_at timestamptz default now()
)
returns setof public.research_gap_cases
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_plan_version <> 'research-gap-plan/1' then
    raise exception 'unsupported Research Gap plan version' using errcode = '22023';
  end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    raise exception 'p_plan must be a JSON object' using errcode = '22023';
  end if;

  return query
  update public.research_gap_cases gap
  set status = 'RESEARCHING',
      research_plan_version = p_plan_version,
      research_plan = p_plan,
      research_started_at = coalesce(gap.research_started_at, p_started_at),
      updated_at = now()
  where gap.id = p_case_id
    and gap.claim_token = p_claim_token
    and gap.status in ('CLAIMED', 'RESEARCHING')
    and gap.claim_expires_at is not null
    and gap.claim_expires_at > now()
  returning gap.*;
end;
$$;

create or replace function public.complete_research_gap_case(
  p_case_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_verdict_version text,
  p_verdict jsonb,
  p_completed_at timestamptz default now()
)
returns setof public.research_gap_cases
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_outcome not in ('CONFIRMING', 'CONTRADICTING', 'UNRESOLVED', 'NO_CHANGE') then
    raise exception 'invalid Research Gap outcome' using errcode = '22023';
  end if;
  if p_verdict_version <> 'research-gap-verdict/1' then
    raise exception 'unsupported Research Gap verdict version' using errcode = '22023';
  end if;
  if p_verdict is null or jsonb_typeof(p_verdict) <> 'object' then
    raise exception 'p_verdict must be a JSON object' using errcode = '22023';
  end if;

  return query
  update public.research_gap_cases gap
  set status = 'COMPLETED',
      research_outcome = p_outcome,
      verdict_version = p_verdict_version,
      verdict = p_verdict,
      completed_at = p_completed_at,
      claim_token = null,
      claimed_by = null,
      claimed_at = null,
      claim_expires_at = null,
      updated_at = now()
  where gap.id = p_case_id
    and gap.claim_token = p_claim_token
    and gap.status = 'RESEARCHING'
    and gap.claim_expires_at is not null
    and gap.claim_expires_at > now()
  returning gap.*;
end;
$$;

revoke all on function public.start_research_gap_case(uuid, uuid, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.start_research_gap_case(uuid, uuid, text, jsonb, timestamptz)
  to service_role;

revoke all on function public.complete_research_gap_case(uuid, uuid, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_research_gap_case(uuid, uuid, text, text, jsonb, timestamptz)
  to service_role;

comment on function public.start_research_gap_case(uuid, uuid, text, jsonb, timestamptz) is
  'Transitions an owned, unexpired Research Gap claim into RESEARCHING with a deterministic bounded plan.';

comment on function public.complete_research_gap_case(uuid, uuid, text, text, jsonb, timestamptz) is
  'Marks an owned Research Gap research attempt COMPLETED only after the deterministic verdict gate says research should stop.';

commit;
