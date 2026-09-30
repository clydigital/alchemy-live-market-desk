begin;

do $$
declare
  dossier_one uuid;
  dossier_two uuid;
  case_id uuid;
  case_count integer;
  occurrence_count integer;
  occurrence_rows integer;
  claimed_count integer;
  claim_token uuid;
  released boolean;
begin
  if to_regclass('public.research_gap_cases') is null then
    raise exception 'research_gap_cases table is missing';
  end if;
  if to_regclass('public.research_gap_case_occurrences') is null then
    raise exception 'research_gap_case_occurrences table is missing';
  end if;

  insert into public.market_dossiers_v2 (
    contract_version,
    previous_dossier_id,
    as_of,
    freshness,
    research_gaps,
    payload
  ) values (
    'market-dossier-v2/1',
    null,
    '2026-10-01T00:00:00Z',
    '{}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  ) returning id into dossier_one;

  insert into public.market_dossiers_v2 (
    contract_version,
    previous_dossier_id,
    as_of,
    freshness,
    research_gaps,
    payload
  ) values (
    'market-dossier-v2/1',
    dossier_one,
    '2026-10-01T12:00:00Z',
    '{}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  ) returning id into dossier_two;

  select id
  into case_id
  from public.upsert_research_gap_case(
    'gap:investigation:inv:duration',
    dossier_one,
    '2026-10-01T00:00:00Z',
    'gap-work:first',
    'investigation',
    'inv:duration',
    'Is duration stress broadening?',
    'Pull credit and volatility confirmation.',
    'Tests transmission.',
    '["MOVE","VIX"]'::jsonb,
    '["inv:duration"]'::jsonb,
    '["story:rates"]'::jsonb,
    '[]'::jsonb,
    1,
    72,
    '{"version":"test"}'::jsonb,
    '2026-10-01T00:05:00Z'
  );

  perform *
  from public.upsert_research_gap_case(
    'gap:investigation:inv:duration',
    dossier_two,
    '2026-10-01T12:00:00Z',
    'gap-work:second',
    'investigation',
    'inv:duration',
    'Is duration stress broadening?',
    'Pull updated credit and volatility confirmation.',
    'Tests transmission.',
    '["MOVE","VIX","HY"]'::jsonb,
    '["inv:duration"]'::jsonb,
    '["story:rates"]'::jsonb,
    '[]'::jsonb,
    2,
    66,
    '{"version":"test-2"}'::jsonb,
    '2026-10-01T12:05:00Z'
  );

  select count(*), max(c.occurrence_count)
  into case_count, occurrence_count
  from public.research_gap_cases c
  where c.gap_key = 'gap:investigation:inv:duration';

  if case_count <> 1 or occurrence_count <> 2 then
    raise exception 'stable gap key did not carry forward into one case with two occurrences';
  end if;

  select count(*)
  into occurrence_rows
  from public.research_gap_case_occurrences o
  where o.gap_case_id = case_id;

  if occurrence_rows <> 2 then
    raise exception 'expected two immutable occurrence rows, got %', occurrence_rows;
  end if;

  -- Exact replay of the same Dossier/work occurrence is idempotent.
  perform *
  from public.upsert_research_gap_case(
    'gap:investigation:inv:duration',
    dossier_two,
    '2026-10-01T12:00:00Z',
    'gap-work:second',
    'investigation',
    'inv:duration',
    'Is duration stress broadening?',
    'Pull updated credit and volatility confirmation.',
    'Tests transmission.',
    '["MOVE","VIX","HY"]'::jsonb,
    '["inv:duration"]'::jsonb,
    '["story:rates"]'::jsonb,
    '[]'::jsonb,
    2,
    66,
    '{"version":"test-2"}'::jsonb,
    '2026-10-01T12:06:00Z'
  );

  select occurrence_count
  into occurrence_count
  from public.research_gap_cases
  where id = case_id;

  if occurrence_count <> 2 then
    raise exception 'replayed occurrence incremented occurrence_count';
  end if;

  select count(*), (array_agg(c.claim_token))[1]
  into claimed_count, claim_token
  from public.claim_research_gap_cases('contract-test-worker', 1, 600) c;

  if claimed_count <> 1 or claim_token is null then
    raise exception 'queued case was not atomically claimed';
  end if;

  select count(*)
  into claimed_count
  from public.claim_research_gap_cases('second-worker', 1, 600);

  if claimed_count <> 0 then
    raise exception 'active lease allowed a duplicate claim';
  end if;

  select public.release_research_gap_case(case_id, gen_random_uuid())
  into released;

  if released then
    raise exception 'wrong claim token released a case';
  end if;

  select public.release_research_gap_case(case_id, claim_token)
  into released;

  if not released then
    raise exception 'owned claim could not be released';
  end if;

  if not exists (
    select 1
    from public.research_gap_cases
    where id = case_id
      and status = 'QUEUED'
      and claim_token is null
      and attempt_count = 1
  ) then
    raise exception 'release did not restore the operational queue safely';
  end if;

  begin
    update public.research_gap_case_occurrences
    set priority_score = priority_score + 1
    where gap_case_id = case_id;
    raise exception 'append-only occurrence update unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'append-only occurrence update unexpectedly succeeded' then
        raise;
      end if;
  end;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'research_gap_cases'
      and c.relrowsecurity
  ) then
    raise exception 'research_gap_cases RLS is not enabled';
  end if;
end;
$$;

rollback;
