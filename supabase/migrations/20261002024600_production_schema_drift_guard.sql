begin;

grant usage on schema supabase_migrations to service_role;
grant select on table supabase_migrations.schema_migrations to service_role;

create or replace function public.live_desk_applied_migrations()
returns table(version text, name text)
language sql
security invoker
set search_path = ''
as $function$
  select
    migration.version::text,
    migration.name::text
  from supabase_migrations.schema_migrations as migration
  order by migration.version;
$function$;

revoke all on function public.live_desk_applied_migrations()
  from public, anon, authenticated;
grant execute on function public.live_desk_applied_migrations()
  to service_role;

comment on function public.live_desk_applied_migrations() is
  'Read-only production guard surface. Returns Supabase migration history to the server-only service role for GitHub-to-production drift verification.';

commit;
