begin;

do $$
declare
  dossier_id uuid;
  case_id uuid;
  occurrence_count integer;
begin
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
    '2026-10-01T08:00:00Z',
    '{}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  ) returning id into dossier_id;

  select id
  into case_id
  from public.upsert_research_gap_case(
    'gap:motion:event:rates-test:branch:abc123',
    dossier_id,
    '2026-10-01T08:00:00Z',
    'gap-work:motion-1',
    'market_motion',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Does the long-end reaction confirm the rates Motion?',
    'Investigate Motion: compare 10Y/30Y real yields with DXY and growth equities.',
    'Fresh promoted Motion left one unresolved transmission test.',
    '["10Y/30Y real yields versus DXY and growth equities"]'::jsonb,
    '[]'::jsonb,
    '["story:rates"]'::jsonb,
    '["MOTION:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","STORY:story:rates"]'::jsonb,
    1,
    42,
    '{"contractVersion":"research-gap-case-snapshot/1","sourceKind":"market_motion"}'::jsonb,
    '2026-10-01T08:01:00Z'
  );

  if case_id is null then
    raise exception 'Market Motion source did not create a Research Gap case';
  end if;

  if not exists (
    select 1
    from public.research_gap_cases c
    where c.id = case_id
      and c.source_kind = 'market_motion'
      and c.source_ref = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'Market Motion source identity was not persisted';
  end if;

  select count(*)
  into occurrence_count
  from public.research_gap_case_occurrences o
  where o.gap_case_id = case_id
    and o.source_kind = 'market_motion'
    and o.source_ref = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if occurrence_count <> 1 then
    raise exception 'expected one immutable Market Motion occurrence, got %', occurrence_count;
  end if;
end
$$;

rollback;
