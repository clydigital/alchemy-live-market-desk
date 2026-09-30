begin;

alter table public.research_gap_cases
  add column if not exists handoff_run_key text null,
  add column if not exists handoff_canonical_status integer null;

alter table public.research_gap_cases
  drop constraint if exists research_gap_cases_handoff_status_check;

alter table public.research_gap_cases
  add constraint research_gap_cases_handoff_status_check
  check (
    handoff_canonical_status is null
    or handoff_canonical_status between 200 and 299
  );

create or replace function public.mark_research_gap_case_handed_off(
  p_case_id uuid,
  p_expected_outcome text,
  p_handoff_run_key text,
  p_canonical_status integer,
  p_handed_off_at timestamptz default now()
)
returns setof public.research_gap_cases
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_expected_outcome not in ('CONFIRMING', 'CONTRADICTING', 'UNRESOLVED', 'NO_CHANGE') then
    raise exception 'invalid Research Gap handoff outcome' using errcode = '22023';
  end if;
  if nullif(btrim(p_handoff_run_key), '') is null then
    raise exception 'p_handoff_run_key is required' using errcode = '22023';
  end if;
  if p_canonical_status < 200 or p_canonical_status > 299 then
    raise exception 'canonical handoff status must be 2xx' using errcode = '22023';
  end if;

  return query
  update public.research_gap_cases gap
  set status = 'HANDED_OFF',
      handed_off_at = coalesce(gap.handed_off_at, p_handed_off_at),
      handoff_run_key = p_handoff_run_key,
      handoff_canonical_status = p_canonical_status,
      updated_at = now()
  where gap.id = p_case_id
    and gap.research_outcome = p_expected_outcome
    and (
      gap.status = 'COMPLETED'
      or (
        gap.status = 'HANDED_OFF'
        and gap.handoff_run_key = p_handoff_run_key
      )
    )
  returning gap.*;
end;
$$;

revoke all on function public.mark_research_gap_case_handed_off(
  uuid, text, text, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.mark_research_gap_case_handed_off(
  uuid, text, text, integer, timestamptz
) to service_role;

comment on function public.mark_research_gap_case_handed_off(uuid, text, text, integer, timestamptz) is
  'Marks a COMPLETED Research Gap case HANDED_OFF only after canonical /api/research-update accepted the deterministic handoff run. Replays of the same run key are idempotent.';

commit;
