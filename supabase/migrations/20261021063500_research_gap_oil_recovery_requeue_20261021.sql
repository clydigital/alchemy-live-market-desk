begin;

-- This is operational retry history, NOT a second reasoning table or Evidence path.
alter table public.research_gap_cases
  add column if not exists oil_recovery_attempt_history jsonb not null default '[]'::jsonb;

alter table public.research_gap_cases
  drop constraint if exists research_gap_oil_recovery_history_shape;
alter table public.research_gap_cases
  add constraint research_gap_oil_recovery_history_shape
  check (jsonb_typeof(oil_recovery_attempt_history) = 'array');

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
  v_prior public.research_gap_cases%rowtype;
  v_should_requeue boolean := false;
  v_recovery_after timestamptz;

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

  /*
   * Only a fresh, later Dossier occurrence can wake a terminal UNRESOLVED
   * exact-oil access investigation. The Recovery policy was calculated by
   * the existing server-side Research Gap evaluation, not by a web source.
   * The row lock and following upsert execute in this single RPC transaction.
   */
  select * into v_prior
  from public.research_gap_cases
  where gap_key = btrim(p_gap_key)
  for update;

  if found
     and v_prior.status in ('COMPLETED','HANDED_OFF')
     and v_prior.research_outcome = 'UNRESOLVED'
     and v_prior.attempt_count < 3
     and p_dossier_id <> v_prior.latest_dossier_id
     and p_dossier_as_of > v_prior.latest_dossier_as_of
     and p_dossier_as_of > v_prior.completed_at
     and p_observed_at <= now() + interval '5 minutes'
     and v_prior.verdict #>> '{sourceRecovery,contractVersion}' = 'research-gap-oil-source-recovery/1'
     and v_prior.verdict #>> '{sourceRecovery,decision}' = 'RETRY_ON_NEW_DOSSIER'
     and nullif(v_prior.verdict #>> '{sourceRecovery,nextEligibleAt}', '') is not null
  then
    begin
      v_recovery_after := (v_prior.verdict #>> '{sourceRecovery,nextEligibleAt}')::timestamptz;
      v_should_requeue := v_recovery_after <= p_observed_at;
    exception when invalid_datetime_format or datetime_field_overflow then
      v_should_requeue := false;
    end;
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

  if v_should_requeue then
    -- Preserve the *previous* complete analytical/operational attempt
    -- before clearing the latest-attempt fields for the new claim.
    update public.research_gap_cases
    set status = 'QUEUED',
        oil_recovery_attempt_history = oil_recovery_attempt_history || jsonb_build_array(
          jsonb_build_object(
            'status', v_prior.status,
            'researchOutcome', v_prior.research_outcome,
            'attemptCount', v_prior.attempt_count,
            'completedAt', v_prior.completed_at,
            'dossierId', v_prior.latest_dossier_id,
            'dossierAsOf', v_prior.latest_dossier_as_of,
            'planVersion', v_prior.research_plan_version,
            'researchPlan', v_prior.research_plan,
            'verdictVersion', v_prior.verdict_version,
            'verdict', v_prior.verdict,
            'handoffRunKey', v_prior.handoff_run_key,
            'handoffAt', v_prior.handed_off_at,
            'handoffCanonicalStatus', v_prior.handoff_canonical_status
          )
        ),
        research_outcome = null,
        claim_token = null,
        claimed_by = null,
        claimed_at = null,
        claim_expires_at = null,
        completed_at = null,
        handed_off_at = null,
        research_plan_version = null,
        research_plan = null,
        research_started_at = null,
        verdict_version = null,
        verdict = null,
        handoff_run_key = null,
        handoff_canonical_status = null,
        updated_at = now()
    where id = v_case.id and status = v_prior.status and research_outcome = 'UNRESOLVED'
    returning * into v_case;

    if not found then
      raise exception 'oil recovery lifecycle changed while case was requeued';
    end if;
  end if;

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

  get diagnostics v_occurrence_rows = row_count;

  if v_occurrence_rows > 0 then
    update public.research_gap_cases
    set occurrence_count = occurrence_count + 1
    where id = v_case.id
    returning * into v_case;
  end if;

  return next v_case;
end;
$$;


comment on column public.research_gap_cases.oil_recovery_attempt_history is
  'Bounded prior UNRESOLVED original-oil source attempts; retains prior verdict and handoff before an authorised new-Dossier retry.';

comment on function public.upsert_research_gap_case(
  text, uuid, timestamptz, text, text, text, text, text, text,
  jsonb, jsonb, jsonb, jsonb, integer, integer, jsonb, timestamptz
) is
  'Idempotent Research Gap occurrence upsert; only new post-completion Dossiers may requeue exact-oil UNRESOLVED cases after server-classified cooldown and attempt cap, with prior attempt preserved.';

commit;
