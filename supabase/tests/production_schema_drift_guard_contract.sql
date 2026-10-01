\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure('public.live_desk_applied_migrations()') is null then
    raise exception 'live_desk_applied_migrations() is missing';
  end if;

  if (
    select prosecdef
    from pg_proc
    where oid = 'public.live_desk_applied_migrations()'::regprocedure
  ) then
    raise exception 'live_desk_applied_migrations() must remain SECURITY INVOKER';
  end if;

  if has_function_privilege('anon', 'public.live_desk_applied_migrations()', 'EXECUTE') then
    raise exception 'anon must not execute live_desk_applied_migrations()';
  end if;

  if has_function_privilege('authenticated', 'public.live_desk_applied_migrations()', 'EXECUTE') then
    raise exception 'authenticated must not execute live_desk_applied_migrations()';
  end if;

  if not has_function_privilege('service_role', 'public.live_desk_applied_migrations()', 'EXECUTE') then
    raise exception 'service_role must execute live_desk_applied_migrations()';
  end if;
end
$$;

set role service_role;

do $$
declare
  observed record;
begin
  select *
  into observed
  from public.live_desk_applied_migrations()
  where name = 'fixture_guard_migration';

  if observed.version is distinct from '20261002000000'
    or observed.name is distinct from 'fixture_guard_migration'
  then
    raise exception 'migration history RPC did not return the expected fixture row';
  end if;
end
$$;

reset role;
