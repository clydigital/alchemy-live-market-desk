-- PR3A: exact immutable Story-version linkage at the publication boundary.
--
-- Story publication snapshots are append-only. This trigger freezes the exact
-- current thesis version into each future Story snapshot and, when that version
-- carries CanonicalStoryReasoningV1, embeds a fully materialised V1 object in
-- the publication payload. Legacy/core-only versions remain reasoning-null.
--
-- No existing publication row is rewritten by this migration.

create or replace function public.materialise_story_reasoning_for_publication_v1(
  p_version_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  version_row public.story_thesis_versions%rowtype;
  reasoning jsonb;
  lifecycle_value text;
begin
  select *
  into version_row
  from public.story_thesis_versions version
  where version.id = p_version_id;

  if version_row.id is null then
    raise exception 'Story thesis version % does not exist', p_version_id;
  end if;

  reasoning := version_row.snapshot -> 'reasoning';
  if reasoning is null then
    return null;
  end if;

  if jsonb_typeof(reasoning) <> 'object'
    or reasoning ->> 'contractVersion' <> 'canonical-story-reasoning/v1' then
    raise exception 'Story thesis version % contains an unknown reasoning contract', p_version_id;
  end if;

  lifecycle_value := coalesce(
    nullif(btrim(reasoning ->> 'lifecycle'), ''),
    case
      when lower(version_row.status) like '%archive%' then 'archived'
      when lower(version_row.status) like '%invalid%' then 'invalidated'
      when lower(version_row.status) like '%weaken%' then 'weakening'
      when lower(version_row.status) like '%confirm%'
        or lower(version_row.status) like '%publish%' then 'confirmed'
      when lower(version_row.status) like '%develop%'
        or lower(version_row.status) like '%monitor%' then 'developing'
      else 'detected'
    end
  );

  -- Immutable direct version columns override duplicated reasoning projections.
  return reasoning || jsonb_build_object(
    'storyId', version_row.story_id::text,
    'storyVersionId', version_row.id::text,
    'versionNumber', version_row.version_number,
    'effectiveAt', version_row.effective_at,
    'title', version_row.title,
    'centralQuestion', version_row.market_question,
    'lifecycle', lifecycle_value,
    'confidence', version_row.confidence,
    'thesis', version_row.thesis
  );
end;
$$;

revoke all on function public.materialise_story_reasoning_for_publication_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.materialise_story_reasoning_for_publication_v1(uuid)
  to service_role;

create or replace function public.freeze_canonical_story_publication_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_version_id uuid;
  state_story_id text;
  state_version_text text;
  state_version_id uuid;
  version_row public.story_thesis_versions%rowtype;
  materialised_reasoning jsonb;
  exact_version_projection jsonb;
begin
  if new.snapshot_type <> 'story' then
    return new;
  end if;

  if new.story_id is null then
    raise exception 'Story publication snapshot requires story_id';
  end if;
  if jsonb_typeof(new.payload) <> 'object'
    or jsonb_typeof(new.payload -> 'canonicalStoryState') <> 'object' then
    raise exception 'Story publication snapshot requires canonicalStoryState payload';
  end if;

  state_story_id := nullif(btrim(new.payload #>> '{canonicalStoryState,id}'), '');
  if state_story_id is null or state_story_id <> new.story_id::text then
    raise exception 'Story publication canonicalStoryState.id must match story_id';
  end if;

  select story.current_thesis_version_id
  into current_version_id
  from public.stories story
  where story.id = new.story_id;

  if not found then
    raise exception 'Story % does not exist', new.story_id;
  end if;
  if current_version_id is null then
    raise exception 'Story % has no current immutable thesis version to publish', new.story_id;
  end if;

  state_version_text := nullif(btrim(new.payload #>> '{canonicalStoryState,thesisVersion,id}'), '');
  if state_version_text is not null then
    begin
      state_version_id := state_version_text::uuid;
    exception when invalid_text_representation then
      raise exception 'Story publication canonicalStoryState.thesisVersion.id is not a UUID';
    end;
    if state_version_id is distinct from current_version_id then
      raise exception 'Story publication state version % is stale; current version is %',
        state_version_id, current_version_id;
    end if;
  end if;

  if new.story_thesis_version_id is not null
    and new.story_thesis_version_id is distinct from current_version_id then
    raise exception 'Story publication version % does not match current Story version %',
      new.story_thesis_version_id, current_version_id;
  end if;

  select *
  into version_row
  from public.story_thesis_versions version
  where version.id = current_version_id
    and version.story_id = new.story_id;

  if version_row.id is null then
    raise exception 'Current thesis version % does not belong to Story %',
      current_version_id, new.story_id;
  end if;

  new.story_thesis_version_id := current_version_id;

  exact_version_projection := jsonb_build_object(
    'id', version_row.id::text,
    'version', version_row.version_number,
    'effectiveAt', version_row.effective_at,
    'changeReason', version_row.change_reason
  );
  new.payload := jsonb_set(
    new.payload,
    '{canonicalStoryState,thesisVersion}',
    exact_version_projection,
    true
  );

  materialised_reasoning := public.materialise_story_reasoning_for_publication_v1(current_version_id);
  new.payload := jsonb_set(
    new.payload,
    '{canonicalStoryReasoning}',
    coalesce(materialised_reasoning, 'null'::jsonb),
    true
  );

  return new;
end;
$$;

revoke all on function public.freeze_canonical_story_publication_v1()
  from public, anon, authenticated;
grant execute on function public.freeze_canonical_story_publication_v1()
  to service_role;

drop trigger if exists hybrid_publication_snapshots_freeze_story_version_v1
  on public.hybrid_publication_snapshots;
create trigger hybrid_publication_snapshots_freeze_story_version_v1
before insert on public.hybrid_publication_snapshots
for each row execute function public.freeze_canonical_story_publication_v1();
