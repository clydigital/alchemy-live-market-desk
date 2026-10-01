begin;

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
  if p_plan ? 'context' then
    if jsonb_typeof(p_plan -> 'context') <> 'object' then
      raise exception 'p_plan.context must be a JSON object' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(p_plan ->> 'caseId', '')), '') is null
      or nullif(btrim(coalesce(p_plan ->> 'gapKey', '')), '') is null
      or nullif(btrim(coalesce(p_plan #>> '{context,sourceWorkId}', '')), '') is null
      or nullif(btrim(coalesce(p_plan #>> '{context,authoritativeDossierId}', '')), '') is null
    then
      raise exception 'context-aware Research Gap plans require caseId, gapKey, sourceWorkId and authoritativeDossierId'
        using errcode = '22023';
    end if;
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
    and (
      not (p_plan ? 'context')
      or (
        p_plan ->> 'caseId' = gap.id::text
        and p_plan ->> 'gapKey' = gap.gap_key
        and p_plan #>> '{context,sourceWorkId}' = gap.latest_work_id
        and p_plan #>> '{context,authoritativeDossierId}' = gap.latest_dossier_id::text
      )
    )
  returning gap.*;
end;
$$;

revoke all on function public.start_research_gap_case(uuid, uuid, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.start_research_gap_case(uuid, uuid, text, jsonb, timestamptz)
  to service_role;

comment on function public.start_research_gap_case(uuid, uuid, text, jsonb, timestamptz) is
  'Starts owned Research Gap research and fences context-aware plans against stale case, work and authoritative Dossier identity.';

commit;
