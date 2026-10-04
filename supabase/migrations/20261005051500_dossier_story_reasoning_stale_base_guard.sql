-- B4.5: transaction-time stale-base guard for canonical Story reasoning.
--
-- Dossier reassessment is allowed to execute only when the Story is still on
-- the exact immutable thesis version that B4.2/B4.3 bound as its baseline.
-- The guard is intentionally separate from the writer: it performs no writes
-- of its own and leaves rpc/persist_canonical_story_reasoning authoritative.

alter table public.stories
  add column if not exists current_thesis_version_id uuid;

create or replace function public.guard_canonical_story_reasoning_expected_base()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reasoning_context jsonb;
  expected_base_version_id text;
begin
  begin
    reasoning_context := nullif(
      current_setting('alchemy.story_reasoning_context', true),
      ''
    )::jsonb;
  exception when others then
    reasoning_context := null;
  end;

  if reasoning_context is null
    or reasoning_context ->> 'mutationKind' <> 'existing_story_update' then
    return new;
  end if;

  expected_base_version_id := nullif(
    btrim(reasoning_context #>> '{eventMetadata,expectedBaseVersionId}'),
    ''
  );

  -- Existing canonical reasoning callers remain unchanged unless they
  -- explicitly opt into an expected immutable base version.
  if expected_base_version_id is null then
    return new;
  end if;

  if old.current_thesis_version_id is null
    or old.current_thesis_version_id::text is distinct from expected_base_version_id then
    raise exception
      'Canonical Story reasoning expected base thesis version is stale: expected %, current %',
      expected_base_version_id,
      coalesce(old.current_thesis_version_id::text, 'null');
  end if;

  return new;
end;
$$;

revoke all on function public.guard_canonical_story_reasoning_expected_base()
  from public, anon, authenticated;

drop trigger if exists stories_guard_canonical_reasoning_expected_base
  on public.stories;

create trigger stories_guard_canonical_reasoning_expected_base
before update on public.stories
for each row execute function public.guard_canonical_story_reasoning_expected_base();
