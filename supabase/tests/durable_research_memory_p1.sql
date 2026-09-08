-- Read-only verification for the durable research memory P1 migration.
-- Run after 20260908101500_durable_research_memory_p1.sql in a safe database.

begin read only;

do $$
declare
  missing_tables text[];
  macro_release_count bigint;
  baseline_vintage_count bigint;
begin
  select array_agg(required.name order by required.name)
  into missing_tables
  from (
    values
      ('derived_metric_versions'),
      ('macro_release_vintages'),
      ('record_revisions')
  ) as required(name)
  where to_regclass('public.' || required.name) is null;

  if missing_tables is not null then
    raise exception 'Missing durable-memory tables: %', array_to_string(missing_tables, ', ');
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'derived_metric_versions_append_only'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname = 'macro_release_vintages_append_only'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname = 'record_revisions_append_only'
      and not tgisinternal
  ) then
    raise exception 'At least one durable-memory append-only trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'macro_releases_capture_vintage'
      and not tgisinternal
  ) then
    raise exception 'Macro release vintage capture trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'macro_releases_mark_revision'
      and not tgisinternal
  ) then
    raise exception 'Macro release revision detector is missing';
  end if;

  select count(*) into macro_release_count from public.macro_releases;
  select count(*) into baseline_vintage_count
  from public.macro_release_vintages
  where vintage_number = 1 and is_initial;

  if baseline_vintage_count < macro_release_count then
    raise exception 'Macro release baseline backfill incomplete: % vintages for % releases', baseline_vintage_count, macro_release_count;
  end if;

  if exists (
    select 1
    from public.macro_release_vintages replacement
    join public.macro_release_vintages previous
      on previous.id = replacement.supersedes_vintage_id
    where replacement.macro_release_id is distinct from previous.macro_release_id
  ) then
    raise exception 'At least one macro release vintage supersedes a different release';
  end if;

  if exists (
    select 1
    from public.macro_release_vintages
    group by macro_release_id, vintage_number
    having count(*) > 1
  ) then
    raise exception 'Duplicate macro release vintage number detected';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'derived_metric_versions'
      and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'macro_release_vintages'
      and cmd = 'SELECT'
  ) then
    raise exception 'Presentation-safe durable-memory tables lack read policies';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'record_revisions'
      and roles @> array['anon']::name[]
  ) then
    raise exception 'record_revisions must not be anonymously readable';
  end if;
end
$$;

select
  release.id as macro_release_id,
  count(vintage.id) as vintage_count,
  max(vintage.vintage_number) as latest_vintage_number,
  max(vintage.received_at) as latest_received_at
from public.macro_releases release
left join public.macro_release_vintages vintage
  on vintage.macro_release_id = release.id
group by release.id
order by release.id;

select
  entity_table,
  action,
  count(*) as revision_count
from public.record_revisions
group by entity_table, action
order by entity_table, action;

commit;
