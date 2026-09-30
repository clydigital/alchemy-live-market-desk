begin;

do $$
declare
  dossier_id uuid;
  case_id uuid;
  claim_token uuid;
  started_count integer;
  completed_count integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='research_gap_cases'
      and column_name='research_plan'
  ) then
    raise exception 'research_gap_cases.research_plan is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='research_gap_cases'
      and column_name='verdict'
  ) then
    raise exception 'research_gap_cases.verdict is missing';
  end if;

  insert into public.market_dossiers_v2 (
    contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload
  ) values (
    'market-dossier-v2/1', null, '2026-10-01T01:00:00Z', '{}'::jsonb, '[]'::jsonb, '{}'::jsonb
  ) returning id into dossier_id;

  select id into case_id
  from public.upsert_research_gap_case(
    'gap:investigation:inv:plan-contract',
    dossier_id,
    '2026-10-01T01:00:00Z',
    'gap-work:plan-contract',
    'investigation',
    'inv:plan-contract',
    'Is long-end stress broadening?',
    'Pull the required cross-asset evidence.',
    'Contract test.',
    '["MOVE","HY OAS"]'::jsonb,
    '["inv:plan-contract"]'::jsonb,
    '["story:rates"]'::jsonb,
    '["REGIME:CURRENT"]'::jsonb,
    1,
    90,
    '{"contract":"test"}'::jsonb,
    now()
  );

  select c.claim_token into claim_token
  from public.claim_research_gap_cases('plan-contract-worker', 1, 600) c
  where c.id = case_id;

  if claim_token is null then
    raise exception 'could not claim Research Gap case for plan contract';
  end if;

  select count(*) into started_count
  from public.start_research_gap_case(
    case_id,
    gen_random_uuid(),
    'research-gap-plan/1',
    '{"contractVersion":"research-gap-plan/1","planId":"wrong-token"}'::jsonb,
    now()
  );

  if started_count <> 0 then
    raise exception 'wrong claim token started research';
  end if;

  select count(*) into started_count
  from public.start_research_gap_case(
    case_id,
    claim_token,
    'research-gap-plan/1',
    '{"contractVersion":"research-gap-plan/1","planId":"plan-contract","requirements":[{"id":"req:1","required":true}]}'::jsonb,
    now()
  );

  if started_count <> 1 then
    raise exception 'owned claim did not transition to RESEARCHING';
  end if;

  if not exists (
    select 1 from public.research_gap_cases c
    where c.id = case_id
      and c.status = 'RESEARCHING'
      and c.research_plan_version = 'research-gap-plan/1'
      and c.research_plan->>'planId' = 'plan-contract'
      and c.research_started_at is not null
  ) then
    raise exception 'research plan was not persisted with RESEARCHING state';
  end if;

  select count(*) into completed_count
  from public.complete_research_gap_case(
    case_id,
    gen_random_uuid(),
    'CONFIRMING',
    'research-gap-verdict/1',
    '{"contractVersion":"research-gap-verdict/1","outcome":"CONFIRMING","shouldStop":true}'::jsonb,
    now()
  );

  if completed_count <> 0 then
    raise exception 'wrong claim token completed research';
  end if;

  select count(*) into completed_count
  from public.complete_research_gap_case(
    case_id,
    claim_token,
    'CONFIRMING',
    'research-gap-verdict/1',
    '{"contractVersion":"research-gap-verdict/1","outcome":"CONFIRMING","shouldStop":true}'::jsonb,
    now()
  );

  if completed_count <> 1 then
    raise exception 'owned RESEARCHING claim did not complete';
  end if;

  if not exists (
    select 1 from public.research_gap_cases c
    where c.id = case_id
      and c.status = 'COMPLETED'
      and c.research_outcome = 'CONFIRMING'
      and c.verdict_version = 'research-gap-verdict/1'
      and c.verdict->>'outcome' = 'CONFIRMING'
      and c.completed_at is not null
      and c.claim_token is null
      and c.claimed_by is null
      and c.claim_expires_at is null
  ) then
    raise exception 'completion did not persist verdict and clear claim ownership';
  end if;
end
$$;

rollback;
