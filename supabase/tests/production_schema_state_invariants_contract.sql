\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure('public.live_desk_schema_invariants()') is null then
    raise exception 'live_desk_schema_invariants() is missing';
  end if;

  if (
    select prosecdef
    from pg_proc
    where oid = 'public.live_desk_schema_invariants()'::regprocedure
  ) then
    raise exception 'live_desk_schema_invariants() must remain SECURITY INVOKER';
  end if;

  if has_function_privilege('anon', 'public.live_desk_schema_invariants()', 'EXECUTE') then
    raise exception 'anon must not execute live_desk_schema_invariants()';
  end if;

  if has_function_privilege('authenticated', 'public.live_desk_schema_invariants()', 'EXECUTE') then
    raise exception 'authenticated must not execute live_desk_schema_invariants()';
  end if;

  if not has_function_privilege('service_role', 'public.live_desk_schema_invariants()', 'EXECUTE') then
    raise exception 'service_role must execute live_desk_schema_invariants()';
  end if;
end
$$;

set role service_role;

do $$
declare
  failed_count integer;
  observed_count integer;
begin
  select count(*), count(*) filter (where not healthy)
  into observed_count, failed_count
  from public.live_desk_schema_invariants();

  if observed_count <> 2 then
    raise exception 'exactly two production schema invariants are required';
  end if;

  if failed_count <> 0 then
    raise exception 'baseline production schema invariants must be healthy';
  end if;
end
$$;

reset role;
