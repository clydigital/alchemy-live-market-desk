begin;

do $$
declare
  dossier_one uuid;
  dossier_two uuid;
  case_id uuid;
  claim_token uuid;
  transitioned integer;
  stale_plan jsonb;
  current_plan jsonb;
begin
  insert into public.market_dossiers_v2 (
    contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload
  ) values (
    'market-dossier-v2/1', null, '2026-10-01T03:00:00Z', '{}'::jsonb, '[]'::jsonb, '{}'::jsonb
  ) returning id into dossier_one;

  select id into case_id
  from public.upsert_research_gap_case(
    'gap:investigation:inv:context-fence',
    dossier_one,
    '2026-10-01T03:00:00Z',
    'gap-work:context-one',
    'investigation',
    'inv:context-fence',
    'Did the first Dossier leave a material gap?',
    'Collect the required evidence.',
    'Context fence contract.',
    '["MOVE"]'::jsonb,
    '["inv:context-fence"]'::jsonb,
    '["story:rates"]'::jsonb,
    '[]'::jsonb,
    1,
    90,
    '{"contract":"context-fence-one"}'::jsonb,
    '2026-10-01T03:01:00Z'
  );

  select c.claim_token into claim_token
  from public.claim_research_gap_cases('context-fence-worker', 1, 600) c
  where c.id = case_id;

  if claim_token is null then
    raise exception 'could not claim Research Gap case for context fence contract';
  end if;

  stale_plan := jsonb_build_object(
    'contractVersion', 'research-gap-plan/1',
    'planId', 'context-plan-stale',
    'caseId', case_id::text,
    'gapKey', 'gap:investigation:inv:context-fence',
    'requirements', jsonb_build_array(jsonb_build_object('id', 'req:1', 'required', true)),
    'context', jsonb_build_object(
      'sourceWorkId', 'gap-work:context-one',
      'authoritativeDossierId', dossier_one::text
    )
  );

  -- Refresh the same durable case after the worker froze its first context.
  insert into public.market_dossiers_v2 (
    contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload
  ) values (
    'market-dossier-v2/1', dossier_one, '2026-10-01T04:00:00Z', '{}'::jsonb, '[]'::jsonb, '{}'::jsonb
  ) returning id into dossier_two;

  perform *
  from public.upsert_research_gap_case(
    'gap:investigation:inv:context-fence',
    dossier_two,
    '2026-10-01T04:00:00Z',
    'gap-work:context-two',
    'investigation',
    'inv:context-fence',
    'Did the refreshed Dossier leave a material gap?',
    'Collect the refreshed evidence.',
    'Context fence contract refresh.',
    '["MOVE","HY OAS"]'::jsonb,
    '["inv:context-fence"]'::jsonb,
    '["story:rates"]'::jsonb,
    '[]'::jsonb,
    1,
    92,
    '{"contract":"context-fence-two"}'::jsonb,
    '2026-10-01T04:01:00Z'
  );

  select count(*) into transitioned
  from public.start_research_gap_case(
    case_id,
    claim_token,
    'research-gap-plan/1',
    stale_plan,
    now()
  );

  if transitioned <> 0 then
    raise exception 'stale work and Dossier identity started Research Gap execution';
  end if;

  current_plan := jsonb_set(
    jsonb_set(
      stale_plan,
      '{context,sourceWorkId}',
      to_jsonb('gap-work:context-two'::text)
    ),
    '{context,authoritativeDossierId}',
    to_jsonb(dossier_two::text)
  ) || '{"planId":"context-plan-current"}'::jsonb;

  select count(*) into transitioned
  from public.start_research_gap_case(
    case_id,
    claim_token,
    'research-gap-plan/1',
    current_plan,
    now()
  );

  if transitioned <> 1 then
    raise exception 'current work and Dossier identity did not start Research Gap execution';
  end if;

  if not exists (
    select 1
    from public.research_gap_cases gap
    where gap.id = case_id
      and gap.status = 'RESEARCHING'
      and gap.research_plan ->> 'planId' = 'context-plan-current'
      and gap.research_plan #>> '{context,sourceWorkId}' = 'gap-work:context-two'
      and gap.research_plan #>> '{context,authoritativeDossierId}' = dossier_two::text
  ) then
    raise exception 'current context-aware plan was not persisted exactly';
  end if;
end
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.start_research_gap_case(uuid,uuid,text,jsonb,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute start_research_gap_case';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.start_research_gap_case(uuid,uuid,text,jsonb,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can execute start_research_gap_case';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.start_research_gap_case(uuid,uuid,text,jsonb,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute start_research_gap_case';
  end if;
end
$$;

rollback;
