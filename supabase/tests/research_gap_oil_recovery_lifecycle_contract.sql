begin;

do $$
declare
  first_dossier uuid;
  next_dossier uuid;
  case_id uuid;
  blocked_case uuid;
  lease uuid;
  previous_run text := 'oil-recovery-contract:handoff:1';
  earlier timestamptz := now() - interval '5 hours';
  later timestamptz := now() - interval '1 minute';
  now_stamp timestamptz := now();
  recovery jsonb := jsonb_build_object(
    'contractVersion','research-gap-oil-source-recovery/1',
    'decision','RETRY_ON_NEW_DOSSIER',
    'reason','TRANSIENT_ACCESS',
    'nextEligibleAt', to_char(now()-interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'attemptCount',1,
    'statuses',jsonb_build_array(jsonb_build_object('benchmark','WTI','status','FETCH_FAILED'))
  );
begin
  insert into public.market_dossiers_v2
    (contract_version,previous_dossier_id,as_of,freshness,research_gaps,payload)
  values ('market-dossier-v2/1',null,earlier,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb)
  returning id into first_dossier;
  insert into public.market_dossiers_v2
    (contract_version,previous_dossier_id,as_of,freshness,research_gaps,payload)
  values ('market-dossier-v2/1',first_dossier,later,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb)
  returning id into next_dossier;

  select id into case_id from public.upsert_research_gap_case(
    'gap:investigation:inv:oil-recovery-atomic-test',first_dossier,earlier,
    'gap-work:original','investigation','inv:oil-recovery-atomic-test',
    'Original NYMEX WTI F1/F2 settle needed','Find exact dated final source',
    'Missing original records','["WTI F1/F2"]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
    1,90,'{"test":"original"}'::jsonb,earlier
  );

  select c.claim_token into lease
  from public.claim_research_gap_cases('oil-recovery-worker',1,600) c
  where c.id = case_id;
  if lease is null then raise exception 'oil test case could not be claimed'; end if;

  perform * from public.start_research_gap_case(
    case_id,lease,'research-gap-plan/1',
    '{"contractVersion":"research-gap-plan/1","planId":"oil-recovery-test"}'::jsonb,now_stamp
  );
  perform * from public.complete_research_gap_case(
    case_id,lease,'UNRESOLVED','research-gap-verdict/1',
    jsonb_build_object('contractVersion','research-gap-verdict/1','outcome','UNRESOLVED',
      'shouldStop',true,'sourceRecovery',recovery),now()-interval '2 hours'
  );
  perform * from public.mark_research_gap_case_handed_off(
    case_id,'UNRESOLVED',previous_run,202,now()-interval '110 minutes'
  );

  -- Same dossier replay must never reopen terminal state.
  perform * from public.upsert_research_gap_case(
    'gap:investigation:inv:oil-recovery-atomic-test',first_dossier,earlier,
    'gap-work:original','investigation','inv:oil-recovery-atomic-test',
    'Original NYMEX WTI F1/F2 settle needed','Find exact dated final source',
    'Missing original records','["WTI F1/F2"]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
    1,90,'{"test":"same"}'::jsonb,now_stamp
  );
  if (select status from public.research_gap_cases where id=case_id) <> 'HANDED_OFF' then
    raise exception 'same-Dossier replay reopened terminal oil case';
  end if;

  -- New, later Dossier plus cooled-down TRANSIENT access can reopen once.
  perform * from public.upsert_research_gap_case(
    'gap:investigation:inv:oil-recovery-atomic-test',next_dossier,later,
    'gap-work:next','investigation','inv:oil-recovery-atomic-test',
    'Original NYMEX WTI F1/F2 settle needed','Find exact dated final source',
    'Missing original records','["WTI F1/F2"]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
    1,91,'{"test":"new-occurrence"}'::jsonb,now_stamp
  );
  if not exists (
    select 1 from public.research_gap_cases
    where id=case_id and status='QUEUED' and research_outcome is null
      and verdict is null and handoff_run_key is null
      and attempt_count=1 and jsonb_array_length(oil_recovery_attempt_history)=1
      and oil_recovery_attempt_history->0->>'handoffRunKey'=previous_run
      and oil_recovery_attempt_history->0->'verdict'->'sourceRecovery'->>'decision'='RETRY_ON_NEW_DOSSIER'
  ) then
    raise exception 'retry did not preserve previous attempt or reset current ownership';
  end if;

  -- Replayed new Dossier cannot append another recovery history item.
  perform * from public.upsert_research_gap_case(
    'gap:investigation:inv:oil-recovery-atomic-test',next_dossier,later,
    'gap-work:next','investigation','inv:oil-recovery-atomic-test',
    'Original NYMEX WTI F1/F2 settle needed','Find exact dated final source',
    'Missing original records','["WTI F1/F2"]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
    1,91,'{"test":"new-occurrence-replay"}'::jsonb,now_stamp
  );
  if (select jsonb_array_length(oil_recovery_attempt_history)
      from public.research_gap_cases where id=case_id) <> 1 then
    raise exception 'idempotent requeue appended duplicate history';
  end if;

  -- Permanent rights hold: new Dossier must not awaken the same key.
  select id into blocked_case from public.upsert_research_gap_case(
    'gap:investigation:inv:oil-recovery-rights-test',first_dossier,earlier,
    'gap-work:hold','investigation','inv:oil-recovery-rights-test',
    'ICE Brent final settles license missing','Check licensed ICE access','',
    '["ICE Brent"]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
    2,80,'{}'::jsonb,earlier
  );
  update public.research_gap_cases
  set status='HANDED_OFF',research_outcome='UNRESOLVED',attempt_count=2,
    completed_at=now()-interval '2 hours',
    handoff_run_key='oil-recovery-rights:previous',handoff_canonical_status=200,
    handed_off_at=now()-interval '110 minutes',
    verdict_version='research-gap-verdict/1',
    verdict=jsonb_build_object('sourceRecovery',jsonb_build_object(
      'contractVersion','research-gap-oil-source-recovery/1',
      'decision','HOLD_FOR_OPERATOR','nextEligibleAt',null))
  where id=blocked_case;
  perform * from public.upsert_research_gap_case(
    'gap:investigation:inv:oil-recovery-rights-test',next_dossier,later,
    'gap-work:hold-next','investigation','inv:oil-recovery-rights-test',
    'ICE Brent final settles license missing','Check licensed ICE access','',
    '["ICE Brent"]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
    2,81,'{}'::jsonb,now_stamp
  );
  if not exists (select 1 from public.research_gap_cases where id=blocked_case
    and status='HANDED_OFF' and jsonb_array_length(oil_recovery_attempt_history)=0)
  then raise exception 'rights-held source was requeued'; end if;
end
$$;

rollback;
