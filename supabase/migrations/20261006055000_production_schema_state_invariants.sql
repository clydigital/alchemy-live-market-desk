begin;

create or replace function public.live_desk_schema_invariants()
returns table(invariant_key text, healthy boolean, detail jsonb)
language sql
security invoker
set search_path = ''
as $function$
  with schedule as (
    select
      count(*) = 2
      and bool_and(
        (slot_key = 'morning' and local_time = '09:30:00'::time)
        or (slot_key = 'evening' and local_time = '21:30:00'::time)
      ) as healthy,
      jsonb_build_object(
        'expected',
        jsonb_build_object('morning', '09:30:00', 'evening', '21:30:00'),
        'observed',
        coalesce(
          jsonb_object_agg(slot_key, local_time::text order by slot_key),
          '{}'::jsonb
        )
      ) as detail
    from public.research_schedule_slots
    where slot_key in ('morning', 'evening')
  ),
  evidence_provenance as (
    select
      pg_catalog.to_regprocedure(
        'public.enrich_story_maintenance_evidence_context()'
      ) is not null
      and exists (
        select 1
        from pg_catalog.pg_trigger trigger_row
        join pg_catalog.pg_class table_row
          on table_row.oid = trigger_row.tgrelid
        join pg_catalog.pg_namespace namespace_row
          on namespace_row.oid = table_row.relnamespace
        where namespace_row.nspname = 'public'
          and table_row.relname = 'stories'
          and trigger_row.tgname = 'stories_enrich_maintenance_evidence_context'
          and not trigger_row.tgisinternal
          and trigger_row.tgenabled <> 'D'
      ) as healthy,
      jsonb_build_object(
        'functionExists',
        pg_catalog.to_regprocedure(
          'public.enrich_story_maintenance_evidence_context()'
        ) is not null,
        'triggerExists',
        exists (
          select 1
          from pg_catalog.pg_trigger trigger_row
          join pg_catalog.pg_class table_row
            on table_row.oid = trigger_row.tgrelid
          join pg_catalog.pg_namespace namespace_row
            on namespace_row.oid = table_row.relnamespace
          where namespace_row.nspname = 'public'
            and table_row.relname = 'stories'
            and trigger_row.tgname = 'stories_enrich_maintenance_evidence_context'
            and not trigger_row.tgisinternal
            and trigger_row.tgenabled <> 'D'
        )
      ) as detail
  )
  select
    'research_schedule_slots'::text,
    schedule.healthy,
    schedule.detail
  from schedule
  union all
  select
    'story_maintenance_evidence_provenance'::text,
    evidence_provenance.healthy,
    evidence_provenance.detail
  from evidence_provenance
  order by 1;
$function$;

revoke all on function public.live_desk_schema_invariants()
  from public, anon, authenticated;
grant select on table public.research_schedule_slots
  to service_role;
grant execute on function public.live_desk_schema_invariants()
  to service_role;

comment on function public.live_desk_schema_invariants() is
  'Read-only production drift guard for canonical Live Desk slot times and B4n Story maintenance Evidence provenance wiring.';

commit;
