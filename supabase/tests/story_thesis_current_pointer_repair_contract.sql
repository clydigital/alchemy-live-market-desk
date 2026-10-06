\set ON_ERROR_STOP on

do $$
declare
  fixture_story_id uuid := '11111111-1111-4111-8111-111111111111';
  expected_latest_version_id uuid;
  observed_pointer uuid;
  version_count integer;
  first_snapshot jsonb;
  latest_snapshot jsonb;
begin
  select version.id
  into expected_latest_version_id
  from public.story_thesis_versions version
  where version.story_id = fixture_story_id
  order by version.version_number desc, version.created_at desc, version.id desc
  limit 1;

  select story.current_thesis_version_id
  into observed_pointer
  from public.stories story
  where story.id = fixture_story_id;

  if expected_latest_version_id is null then
    raise exception 'Partition N fixture has no immutable thesis history';
  end if;

  if observed_pointer is null then
    raise exception 'Partition N did not repair the missing current thesis pointer';
  end if;

  if observed_pointer is distinct from expected_latest_version_id then
    raise exception 'Partition N pointer % does not match latest immutable version %',
      observed_pointer,
      expected_latest_version_id;
  end if;

  if observed_pointer is distinct from '55555555-5555-4555-8555-555555555556'::uuid then
    raise exception 'Partition N did not choose the highest fixture version';
  end if;

  select count(*)
  into version_count
  from public.story_thesis_versions version
  where version.story_id = fixture_story_id;

  if version_count <> 2 then
    raise exception 'Partition N changed immutable thesis history; expected 2 versions, found %',
      version_count;
  end if;

  select version.snapshot
  into first_snapshot
  from public.story_thesis_versions version
  where version.id = '55555555-5555-4555-8555-555555555555'::uuid;

  select version.snapshot
  into latest_snapshot
  from public.story_thesis_versions version
  where version.id = '55555555-5555-4555-8555-555555555556'::uuid;

  if first_snapshot ->> 'partitionNFixture' is distinct from 'v1'
    or latest_snapshot ->> 'partitionNFixture' is distinct from 'v2' then
    raise exception 'Partition N mutated immutable thesis snapshots';
  end if;

  if exists (
    select 1
    from public.stories story
    where story.current_thesis_version_id is null
      and exists (
        select 1
        from public.story_thesis_versions version
        where version.story_id = story.id
      )
  ) then
    raise exception 'A Story with immutable thesis history still has a null current pointer';
  end if;
end
$$;
