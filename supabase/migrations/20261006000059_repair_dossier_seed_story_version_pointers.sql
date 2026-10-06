-- Forward repair for Dossier-derived seed Stories whose initial thesis version
-- existed but whose mutable current_thesis_version_id pointer was left null.
--
-- Production already received this exact repair as migration
-- 20261006000059. Keeping the migration in-repo restores schema-history parity
-- and makes the invariant reproducible on fresh/staging databases.

do $$
declare
  repaired_count integer;
begin
  with candidates as (
    select
      story.id as story_id,
      (array_agg(version.id) filter (
        where version.version_number = 1
          and version.snapshot ->> 'origin' = 'dossier_live_integration_seed'
      ))[1] as version_id
    from public.stories story
    join public.story_thesis_versions version
      on version.story_id = story.id
    where story.current_thesis_version_id is null
    group by story.id
    having count(version.id) = 1
       and count(*) filter (
         where version.version_number = 1
           and version.snapshot ->> 'origin' = 'dossier_live_integration_seed'
       ) = 1
  )
  update public.stories story
  set current_thesis_version_id = candidates.version_id
  from candidates
  where story.id = candidates.story_id
    and story.current_thesis_version_id is null;

  get diagnostics repaired_count = row_count;

  if exists (
    select 1
    from public.stories story
    join public.story_thesis_versions version
      on version.story_id = story.id
     and version.version_number = 1
     and version.snapshot ->> 'origin' = 'dossier_live_integration_seed'
    left join public.story_thesis_versions current_version
      on current_version.id = story.current_thesis_version_id
    where story.current_thesis_version_id is null
       or current_version.story_id is distinct from story.id
  ) then
    raise exception 'Dossier Live seed Story thesis-version pointer repair is incomplete';
  end if;

  raise notice 'Repaired % dossier seed Story thesis-version pointer(s)', repaired_count;
end;
$$;
