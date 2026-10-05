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
begin
  select count(*)
  into failed_count
  from public.live_desk_schema_invariants()
  where not healthy;

  if failed_count <> 0 then
    raise exception 'baseline production schema invariants must be healthy';
  end if;

  if (
    select count(*)
    from public.live_desk_schema_invariants()
  ) <> 2 then
    raise exception 'exactly two production schema invariants are required';
  end if;
end
$$;

reset role;

begin;

update public.research_schedule_slots
set local_time = '09:15:00'::time
where slot_key = 'morning';

set role service_role;

do $$
begin
  if (
    select healthy
    from public.live_desk_schema_invariants()
    where invariant_key = 'research_schedule_slots'
  ) is distinct from false then
    raise exception 'schedule drift must fail the invariant';
  end if;
end
$$;

reset role;
rollback;

begin;

drop trigger stories_enrich_maintenance_evidence_context on public.stories;

set role service_role;

do $$
begin
  if (
    select healthy
    from public.live_desk_schema_invariants()
    where invariant_key = 'story_maintenance_evidence_provenance'
  ) is distinct from false then
    raise exception 'missing B4n trigger must fail the invariant';
  end if;
end
$$;

reset role;
rollback;
