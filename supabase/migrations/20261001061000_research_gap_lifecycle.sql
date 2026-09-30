begin;

create table if not exists public.research_gap_cases (
  id uuid primary key default gen_random_uuid(),
  gap_key text not null unique,
  status text not null default 'QUEUED' check (status in (
    'NEW', 'QUEUED', 'CLAIMED', 'RESEARCHING', 'COMPLETED', 'HANDED_OFF', 'CLOSED'
  )),
  research_outcome text null check (
    research_outcome is null
    or research_outcome in ('CONFIRMING', 'CONTRADICTING', 'UNRESOLVED', 'NO_CHANGE')
  ),
  source_kind text not null check (source_kind in ('research_gap', 'research_now', 'investigation')),
  source_ref text not null,
  question text null,
  action text not null,
  reason text null,
  evidence_needed jsonb not null default '[]'::jsonb,
  linked_investigation_ids jsonb not null default '[]'::jsonb,
  linked_story_ids jsonb not null default '[]'::jsonb,
  blocking_refs jsonb not null default '[]'::jsonb,
  latest_work_id text not null,
  latest_dossier_id uuid not null references public.market_dossiers_v2(id) on delete restrict,
  latest_dossier_as_of timestamptz not null,
  latest_priority_rank integer null check (latest_priority_rank is null or latest_priority_rank between 1 and 3),
  latest_priority_score integer null check (latest_priority_score is null or latest_priority_score >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 0 check (occurrence_count >= 0),
  claim_token uuid null,
  claimed_by text null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  completed_at timestamptz null,
  handed_off_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(gap_key) between 1 and 240),
  check (
    (status in ('CLAIMED', 'RESEARCHING')
      and claim_token is not null
      and claimed_by is not null
      and claimed_at is not null
      and claim_expires_at is not null)
    or
    (status not in ('CLAIMED', 'RESEARCHING'))
  )
);

create index if not exists research_gap_cases_claim_queue_idx
  on public.research_gap_cases (status, latest_priority_score desc, first_seen_at asc);

create index if not exists research_gap_cases_lease_idx
  on public.research_gap_cases (claim_expires_at)
  where status in ('CLAIMED', 'RESEARCHING');

create index if not exists research_gap_cases_latest_dossier_idx
  on public.research_gap_cases (latest_dossier_id, latest_priority_rank);

create table if not exists public.research_gap_case_occurrences (
  id uuid primary key default gen_random_uuid(),
  gap_case_id uuid not null references public.research_gap_cases(id) on delete restrict,
  dossier_id uuid not null references public.market_dossiers_v2(id) on delete restrict,
  dossier_as_of timestamptz not null,
  work_id text not null,
  source_kind text not null check (source_kind in ('research_gap', 'research_now', 'investigation')),
  source_ref text not null,
  priority_rank integer not null check (priority_rank between 1 and 3),
  priority_score integer not null check (priority_score >= 0),
  snapshot jsonb not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (gap_case_id, dossier_id, work_id)
);

create index if not exists research_gap_case_occurrences_case_idx
  on public.research_gap_case_occurrences (gap_case_id, observed_at desc);

create or replace function public.research_gap_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists research_gap_cases_updated_at on public.research_gap_cases;
create trigger research_gap_cases_updated_at
before update on public.research_gap_cases
for each row execute function public.research_gap_set_updated_at();

-- Occurrences are the immutable audit trail for cross-Dossier carry-forward.
create or replace function public.prevent_research_gap_occurrence_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'research_gap_case_occurrences is append-only';
end;
$$;

drop trigger if exists research_gap_case_occurrences_append_only
  on public.research_gap_case_occurrences;
create trigger research_gap_case_occurrences_append_only
before update or delete on public.research_gap_case_occurrences
for each row execute function public.prevent_research_gap_occurrence_mutation();

create or replace function public.upsert_research_gap_case(
  p_gap_key text,
  p_dossier_id uuid,
  p_dossier_as_of timestamptz,
  p_work_id text,
  p_source_kind text,
  p_source_ref text,
  p_question text,
  p_action text,
  p_reason text,
  p_evidence_needed jsonb,
  p_linked_investigation_ids jsonb,
  p_linked_story_ids jsonb,
  p_blocking_refs jsonb,
  p_priority_rank integer,
  p_priority_score integer,
  p_snapshot jsonb,
  p_observed_at timestamptz default now()
)
returns setof public.research_gap_cases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case public.research_gap_cases%rowtype;
  v_occurrence_rows integer := 0;
begin
  if nullif(btrim(p_gap_key), '') is null then
    raise exception 'p_gap_key is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_action), '') is null then
    raise exception 'p_action is required' using errcode = '22023';
  end if;
  if p_priority_rank is null or p_priority_rank < 1 or p_priority_rank > 3 then
    raise exception 'p_priority_rank must be between 1 and 3' using errcode = '22023';
  end if;

  insert into public.research_gap_cases (
    gap_key,
    status,
    source_kind,
    source_ref,
    question,
    action,
    reason,
    evidence_needed,
    linked_investigation_ids,
    linked_story_ids,
    blocking_refs,
    latest_work_id,
    latest_dossier_id,
    latest_dossier_as_of,
    latest_priority_rank,
    latest_priority_score,
    first_seen_at,
    last_seen_at,
    occurrence_count
  ) values (
    btrim(p_gap_key),
    'QUEUED',
    p_source_kind,
    p_source_ref,
    nullif(btrim(coalesce(p_question, '')), ''),
    p_action,
    nullif(btrim(coalesce(p_reason, '')), ''),
    coalesce(p_evidence_needed, '[]'::jsonb),
    coalesce(p_linked_investigation_ids, '[]'::jsonb),
    coalesce(p_linked_story_ids, '[]'::jsonb),
    coalesce(p_blocking_refs, '[]'::jsonb),
    p_work_id,
    p_dossier_id,
    p_dossier_as_of,
    p_priority_rank,
    p_priority_score,
    p_observed_at,
    p_observed_at,
    0
  )
  on conflict (gap_key) do update
    set source_kind = excluded.source_kind,
        source_ref = excluded.source_ref,
        question = excluded.question,
        action = excluded.action,
        reason = excluded.reason,
        evidence_needed = excluded.evidence_needed,
        linked_investigation_ids = excluded.linked_investigation_ids,
        linked_story_ids = excluded.linked_story_ids,
        blocking_refs = excluded.blocking_refs,
        latest_work_id = excluded.latest_work_id,
        latest_dossier_id = excluded.latest_dossier_id,
        latest_dossier_as_of = excluded.latest_dossier_as_of,
        latest_priority_rank = excluded.latest_priority_rank,
        latest_priority_score = excluded.latest_priority_score,
        last_seen_at = greatest(public.research_gap_cases.last_seen_at, excluded.last_seen_at),
        status = case
          when public.research_gap_cases.status = 'NEW' then 'QUEUED'
          else public.research_gap_cases.status
        end
  returning * into v_case;

  insert into public.research_gap_case_occurrences (
    gap_case_id,
    dossier_id,
    dossier_as_of,
    work_id,
    source_kind,
    source_ref,
    priority_rank,
    priority_score,
    snapshot,
    observed_at
  ) values (
    v_case.id,
    p_dossier_id,
    p_dossier_as_of,
    p_work_id,
    p_source_kind,
    p_source_ref,
    p_priority_rank,
    p_priority_score,
    coalesce(p_snapshot, '{}'::jsonb),
    p_observed_at
  )
  on conflict (gap_case_id, dossier_id, work_id) do nothing;

  get diagnostics v_occurrence_inserted = row_count;

  if v_occurrence_inserted then
    update public.research_gap_cases
    set occurrence_count = occurrence_count + 1
    where id = v_case.id
    returning * into v_case;
  end if;

  return next v_case;
end;
$$;

create or replace function public.claim_research_gap_cases(
  p_worker_id text,
  p_batch_size integer default 1,
  p_lease_seconds integer default 600
)
returns setof public.research_gap_cases
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'p_worker_id is required' using errcode = '22023';
  end if;

  return query
  with claimable as (
    select gap.id
    from public.research_gap_cases gap
    where gap.status = 'QUEUED'
       or (
         gap.status in ('CLAIMED', 'RESEARCHING')
         and gap.claim_expires_at is not null
         and gap.claim_expires_at <= now()
       )
    order by
      gap.latest_priority_score desc nulls last,
      gap.first_seen_at asc,
      gap.id
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 1), 3))
  )
  update public.research_gap_cases gap
  set status = 'CLAIMED',
      claim_token = gen_random_uuid(),
      claimed_by = btrim(p_worker_id),
      claimed_at = now(),
      claim_expires_at = now() + make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 600), 1800))),
      attempt_count = gap.attempt_count + 1,
      updated_at = now()
  from claimable
  where gap.id = claimable.id
  returning gap.*;
end;
$$;

create or replace function public.release_research_gap_case(
  p_case_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_released boolean := false;
begin
  update public.research_gap_cases gap
  set status = 'QUEUED',
      claim_token = null,
      claimed_by = null,
      claimed_at = null,
      claim_expires_at = null,
      updated_at = now()
  where gap.id = p_case_id
    and gap.status in ('CLAIMED', 'RESEARCHING')
    and gap.claim_token = p_claim_token;

  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

alter table public.research_gap_cases enable row level security;
alter table public.research_gap_case_occurrences enable row level security;

revoke all on table public.research_gap_cases from public, anon, authenticated;
revoke all on table public.research_gap_case_occurrences from public, anon, authenticated;
grant select, insert, update on table public.research_gap_cases to service_role;
grant select, insert on table public.research_gap_case_occurrences to service_role;

revoke all on function public.upsert_research_gap_case(
  text, uuid, timestamptz, text, text, text, text, text, text,
  jsonb, jsonb, jsonb, jsonb, integer, integer, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.upsert_research_gap_case(
  text, uuid, timestamptz, text, text, text, text, text, text,
  jsonb, jsonb, jsonb, jsonb, integer, integer, jsonb, timestamptz
) to service_role;

revoke all on function public.claim_research_gap_cases(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_research_gap_cases(text, integer, integer)
  to service_role;

revoke all on function public.release_research_gap_case(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_research_gap_case(uuid, uuid)
  to service_role;

comment on table public.research_gap_cases is
  'Operational Research Gap lifecycle. Canonical Live/Dossier remains authoritative for analytical conclusions and Story/Regime mutation.';

comment on table public.research_gap_case_occurrences is
  'Append-only record of each selected Dossier occurrence for a stable Research Gap case.';

comment on function public.claim_research_gap_cases(text, integer, integer) is
  'Atomically claims up to three queued Research Gap cases with SKIP LOCKED and stale-lease recovery.';

commit;
