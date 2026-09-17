-- Read-only SQL contract test for Market Dossiers V2 schema invariants.

begin read only;

do $$
declare
  missing_columns text[];
  fk_delete_action char;
  legacy_fk_count integer;
  rls_enabled boolean;
  trigger_count integer;
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

end
$$;

commit;
