-- Read-only SQL contract test for Market Dossiers V2 schema invariants and behavioral assertions.

begin;

do $$
declare
  missing_columns text[];
  fk_delete_action char;
  legacy_fk_count integer;
  rls_enabled boolean;
  trigger_count integer;
  client_write_policy_count integer;
  dossier_1_id uuid := gen_random_uuid();
  dossier_2_id uuid := gen_random_uuid();
  update_failed_as_expected boolean := false;
  delete_failed_as_expected boolean := false;
  predecessor_delete_failed_as_expected boolean := false;
begin
  -- 1. Table existence
  if to_regclass('public.market_dossiers_v2') is null then
    raise exception 'public.market_dossiers_v2 table does not exist';
  end if;

  -- 2. Required columns verification
  select array_agg(required.col order by required.col)
  into missing_columns
  from (
    values
      ('id'),
      ('contract_version'),
      ('previous_dossier_id'),
      ('as_of'),
      ('freshness'),
      ('research_gaps'),
      ('payload'),
      ('created_at')
  ) as required(col)
  where not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'market_dossiers_v2'
      and column_name = required.col
  );

  if missing_columns is not null then
    raise exception 'Missing columns in public.market_dossiers_v2: %', array_to_string(missing_columns, ', ');
  end if;

  -- 3. Self-referential FK on previous_dossier_id with ON DELETE RESTRICT ('r')
  select confdeltype
  into fk_delete_action
  from pg_constraint
  where conrelid = 'public.market_dossiers_v2'::regclass
    and contype = 'f'
    and confrelid = 'public.market_dossiers_v2'::regclass;

  if fk_delete_action is null or fk_delete_action <> 'r' then
    raise exception 'previous_dossier_id constraint missing or not ON DELETE RESTRICT (action code: %)', fk_delete_action;
  end if;

  -- 4. Verify no foreign keys from market_dossiers_v2 to legacy tables
  select count(*)
  into legacy_fk_count
  from pg_constraint
  where conrelid = 'public.market_dossiers_v2'::regclass
    and contype = 'f'
    and confrelid <> 'public.market_dossiers_v2'::regclass;

  if legacy_fk_count > 0 then
    raise exception 'market_dossiers_v2 contains % invalid foreign key links to legacy tables', legacy_fk_count;
  end if;

  -- 5. Append-only trigger verification
  select count(*)
  into trigger_count
  from pg_trigger
  where tgrelid = 'public.market_dossiers_v2'::regclass
    and tgname = 'market_dossiers_v2_append_only'
    and not tgisinternal;

  if trigger_count < 1 then
    raise exception 'market_dossiers_v2_append_only trigger is missing';
  end if;

  -- 6. RLS enabled verification
  select relrowsecurity
  into rls_enabled
  from pg_class
  where oid = 'public.market_dossiers_v2'::regclass;

  if not rls_enabled then
    raise exception 'Row Level Security (RLS) is not enabled on public.market_dossiers_v2';
  end if;

  -- 7. Database security: ensure no client write policies exist for anon / authenticated roles
  select count(*)
  into client_write_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'market_dossiers_v2'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (roles @> array['anon']::name[] or roles @> array['authenticated']::name[] or roles @> array['public']::name[]);

  if client_write_policy_count > 0 then
    raise exception 'Unintended client write policy detected on market_dossiers_v2 (count: %)', client_write_policy_count;
  end if;

  -- 8. Behavioral Behavioral Proof: Insert initial dossier in privileged server context
  insert into public.market_dossiers_v2 (
    id,
    contract_version,
    previous_dossier_id,
    as_of,
    freshness,
    research_gaps,
    payload
  ) values (
    dossier_1_id,
    'market-dossier-v2/1',
    null,
    now(),
    '{"cutoff": "2026-09-15T00:00:00Z"}'::jsonb,
    '[]'::jsonb,
    '{"regime": "disinflationary_growth"}'::jsonb
  );

  -- 9. Prove UPDATE of persisted dossier is rejected
  begin
    update public.market_dossiers_v2
    set payload = '{"mutated": true}'::jsonb
    where id = dossier_1_id;
  exception
    when sqlstate '55000' or others then
      update_failed_as_expected := true;
  end;

  if not update_failed_as_expected then
    raise exception 'UPDATE on market_dossiers_v2 was NOT rejected by append-only protection';
  end if;

  -- 10. Prove DELETE of persisted dossier is rejected
  begin
    delete from public.market_dossiers_v2
    where id = dossier_1_id;
  exception
    when sqlstate '55000' or others then
      delete_failed_as_expected := true;
  end;

  if not delete_failed_as_expected then
    raise exception 'DELETE on market_dossiers_v2 was NOT rejected by append-only protection';
  end if;

  -- 11. Prove a successor can reference a previous dossier
  insert into public.market_dossiers_v2 (
    id,
    contract_version,
    previous_dossier_id,
    as_of,
    freshness,
    research_gaps,
    payload
  ) values (
    dossier_2_id,
    'market-dossier-v2/1',
    dossier_1_id,
    now(),
    '{"cutoff": "2026-09-15T12:00:00Z"}'::jsonb,
    '[]'::jsonb,
    '{"regime": "disinflationary_growth", "successor": true}'::jsonb
  );

  if not exists (
    select 1 from public.market_dossiers_v2
    where id = dossier_2_id and previous_dossier_id = dossier_1_id
  ) then
    raise exception 'Successor dossier was not properly persisted with previous_dossier_id link';
  end if;

  -- 12. Prove deleting a referenced predecessor is rejected and lineage preserved
  begin
    delete from public.market_dossiers_v2
    where id = dossier_1_id;
  exception
    when sqlstate '55000' or sqlstate '23503' or others then
      predecessor_delete_failed_as_expected := true;
  end;

  if not predecessor_delete_failed_as_expected then
    raise exception 'Deleting referenced predecessor dossier was NOT rejected';
  end if;

end
$$;

rollback;
