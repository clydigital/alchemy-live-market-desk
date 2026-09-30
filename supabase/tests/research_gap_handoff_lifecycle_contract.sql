begin;

do $$
declare
  dossier_id uuid;
  case_id uuid;
  claim_token uuid;
  transitioned integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='research_gap_cases'
      and column_name='handoff_run_key'
  ) then
    raise exception 'research_gap_cases.handoff_run_key is missing';
  end if;

  insert into public.market_dossiers_v2 (
    contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload
  ) values (
    'market-dossier-v2/1', null, '2026-10-01T02:00:00Z', '{}'::jsonb, '[]'::jsonb, '{}'::jsonb
  ) returning id into dossier_id;

  select id into case_id
  from public.upsert_research_gap_case(
    'gap:investigation:inv:handoff-contract',
    dossier_id,
    '2026-10-01T02:00:00Z',
    'gap-work:handoff-contract',
    'investigation',
    'inv:handoff-contract',
    'Did the evidence resolve the gap?',
    'Complete the canonical handoff.',
    'Contract test.',
    '["verified evidence"]'::jsonb,
    '["inv:handoff-contract"]'::jsonb,
    '["story:rates"]'::jsonb,
    '[]'::jsonb,
    1,
    95,
    '{"contract":"handoff-test"}'::jsonb,
    now()
  );

  select c.claim_token into claim_token
  from public.claim_research_gap_cases('handoff-contract-worker', 1, 600) c
  where c.id = case_id;

  perform *
  from public.start_research_gap_case(
    case_id,
    claim_token,
    'research-gap-plan/1',
    '{"contractVersion":"research-gap-plan/1","planId":"handoff-plan","requirements":[{"id":"req:1","required":true}]}'::jsonb,
    now()
  );

  perform *
  from public.complete_research_gap_case(
    case_id,
    claim_token,
    'CONFIRMING',
    'research-gap-verdict/1',
    '{"contractVersion":"research-gap-verdict/1","outcome":"CONFIRMING","shouldStop":true}'::jsonb,
    now()
  );

  select count(*) into transitioned
  from public.mark_research_gap_case_handed_off(
    case_id,
    'CONTRADICTING',
    'gap-gate:test:wrong',
    202,
    now()
  );

  if transitioned <> 0 then
    raise exception 'mismatched verdict outcome advanced lifecycle handoff';
  end if;

  select count(*) into transitioned
  from public.mark_research_gap_case_handed_off(
    case_id,
    'CONFIRMING',
    'gap-gate:test:correct',
    202,
    now()
  );

  if transitioned <> 1 then
    raise exception 'completed case did not advance to HANDED_OFF';
  end if;

  if not exists (
    select 1 from public.research_gap_cases c
    where c.id = case_id
      and c.status = 'HANDED_OFF'
      and c.research_outcome = 'CONFIRMING'
      and c.handoff_run_key = 'gap-gate:test:correct'
      and c.handoff_canonical_status = 202
      and c.handed_off_at is not null
  ) then
    raise exception 'handoff metadata was not persisted';
  end if;

  -- Exact replay of the same deterministic handoff identity remains idempotent.
  select count(*) into transitioned
  from public.mark_research_gap_case_handed_off(
    case_id,
    'CONFIRMING',
    'gap-gate:test:correct',
    200,
    now()
  );

  if transitioned <> 1 then
    raise exception 'same-run handoff replay was not idempotent';
  end if;

  if exists (
    select 1 from public.research_gap_cases c
    where c.id = case_id and c.handoff_run_key <> 'gap-gate:test:correct'
  ) then
    raise exception 'handoff replay changed deterministic run identity';
  end if;
end
$$;

rollback;
