-- Read-only verification for the PR2 persistence migrations.
-- Run only after applying both PR2 migrations in a safe environment.

begin read only;

do $$
declare
  missing_tables text[];
  missing_views text[];
  stories_count bigint;
  baseline_versions_count bigint;
  legacy_updates_count bigint;
  backfilled_events_count bigint;
  canonical_slots_count bigint;
begin
  select array_agg(required.name order by required.name)
  into missing_tables
  from (
    values
      ('raw_source_records'),
      ('normalised_observations'),
      ('story_events'),
      ('story_thesis_versions'),
      ('derived_metric_versions'),
      ('macro_release_vintages'),
      ('record_revisions'),
      ('research_schedule_slots'),
      ('research_slot_runs'),
      ('research_slot_events'),
      ('creator_claims'),
      ('claim_verifications'),
      ('causal_edges'),
      ('asset_impacts'),
      ('fiscal_supply_snapshots'),
      ('treasury_auction_results'),
      ('hybrid_publication_snapshots')
  ) as required(name)
  where to_regclass('public.' || required.name) is null;

  if missing_tables is not null then
    raise exception 'Missing PR2 tables: %', array_to_string(missing_tables, ', ');
  end if;

  select array_agg(required.name order by required.name)
  into missing_views
  from (
    values
      ('current_story_thesis_versions'),
      ('latest_claim_verifications'),
      ('current_causal_edges'),
      ('current_asset_impacts'),
      ('current_fiscal_supply_snapshots')
  ) as required(name)
  where to_regclass('public.' || required.name) is null;

  if missing_views is not null then
    raise exception 'Missing PR2 views: %', array_to_string(missing_views, ', ');
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'current_thesis_version_id'
  ) then
    raise exception 'stories.current_thesis_version_id is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'stories_capture_thesis_version'
      and not tgisinternal
  ) then
    raise exception 'Story thesis capture trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'story_thesis_versions_append_only'
      and not tgisinternal
  ) then
    raise exception 'Story thesis immutability trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'creator_claims_append_only'
      and not tgisinternal
  ) then
    raise exception 'Creator claim immutability trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'hybrid_publication_snapshots_append_only'
      and not tgisinternal
  ) then
    raise exception 'Hybrid snapshot immutability trigger is missing';
  end if;

  select count(*) into stories_count from public.stories;
  select count(*) into baseline_versions_count
  from public.story_thesis_versions
  where version_number = 1;

  if baseline_versions_count < stories_count then
    raise exception 'Baseline thesis versions incomplete: % versions for % Stories', baseline_versions_count, stories_count;
  end if;

  if exists (
    select 1
    from public.stories s
    left join public.story_thesis_versions v on v.id = s.current_thesis_version_id
    where s.current_thesis_version_id is null
       or v.story_id is distinct from s.id
  ) then
    raise exception 'At least one Story lacks a valid current thesis pointer';
  end if;

  select count(*) into legacy_updates_count from public.story_updates;
  select count(*) into backfilled_events_count
  from public.story_events
  where legacy_update_id is not null;

  if backfilled_events_count < legacy_updates_count then
    raise exception 'Legacy Story update backfill incomplete: % events for % updates', backfilled_events_count, legacy_updates_count;
  end if;

  select count(*) into canonical_slots_count
  from public.research_schedule_slots
  where timezone = 'Asia/Kuala_Lumpur'
    and (
      (slot_key = 'video_midnight' and local_time = time '00:40') or
      (slot_key = 'full_desk' and local_time = time '08:30') or
      (slot_key = 'video_refresh' and local_time = time '11:30') or
      (slot_key = 'evening_delta' and local_time = time '22:00')
    );

  if canonical_slots_count <> 4 then
    raise exception 'Canonical research schedule is incomplete or mismatched: % valid slots', canonical_slots_count;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'research_slot_runs'
      and column_name = 'verification_status'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'research_slot_runs'
      and column_name = 'hybrid_handoff_status'
  ) then
    raise exception 'Research slot health states are incomplete';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_claims'
      and roles @> array['public']::name[]
  ) then
    raise exception 'Creator claims must not have a public read policy';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hybrid_publication_snapshots'
      and cmd = 'SELECT'
  ) then
    raise exception 'Hybrid publication snapshots lack a read policy';
  end if;
end
$$;

select
  s.id as story_id,
  s.slug,
  s.current_thesis_version_id,
  v.version_number,
  v.effective_at
from public.stories s
join public.current_story_thesis_versions v on v.story_id = s.id
order by s.rank nulls last, s.slug;

select
  event_type,
  count(*) as event_count,
  min(event_at) as first_event_at,
  max(event_at) as latest_event_at
from public.story_events
group by event_type
order by event_type;

select
  slot_key,
  local_time,
  timezone,
  purpose,
  is_enabled
from public.research_schedule_slots
order by local_time;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'creator_claims',
    'claim_verifications',
    'causal_edges',
    'asset_impacts',
    'fiscal_supply_snapshots',
    'treasury_auction_results',
    'hybrid_publication_snapshots'
  )
order by tablename, policyname;

commit;
