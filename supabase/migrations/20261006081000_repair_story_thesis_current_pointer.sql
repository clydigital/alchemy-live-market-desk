-- Partition N: repair the canonical Story thesis pointer from existing immutable history.
-- This is intentionally pointer-only. It does not create, rewrite, or delete thesis versions.

begin;

with latest_version as (
  select distinct on (version.story_id)
    version.story_id,
    version.id
  from public.story_thesis_versions version
  order by
    version.story_id,
    version.version_number desc,
    version.created_at desc,
    version.id desc
)
update public.stories story
set current_thesis_version_id = latest_version.id
from latest_version
where story.id = latest_version.story_id
  and story.current_thesis_version_id is null;

commit;
