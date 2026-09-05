-- Persistent Stories are durable research objects, not the latest headline.
--
-- The existing atomic persistence RPC is intentionally retained as the full
-- implementation. This migration moves it behind a narrow wrapper that enforces
-- one invariant before any existing-Story mutation reaches the implementation:
--
--   parent Story title = current durable Story title
--   append-only event headline = latest candidate/development headline
--
-- New Stories still use the candidate title supplied by Story Synthesis. The
-- Story Synthesis schema separately instructs the model to choose a durable
-- thematic identity for those new parents.
--
-- Normalising p_story before delegating is important for retry safety. The v1
-- implementation's mutation-key replay check compares the persisted Story
-- payload against p_story. A trigger that silently changed title after that
-- comparison would make retries non-idempotent; this wrapper does not.

alter function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb)
  rename to persist_canonical_story_reasoning_v1;

create function public.persist_canonical_story_reasoning(
  p_mutation_key text,
  p_story_id uuid,
  p_story jsonb,
  p_reasoning jsonb,
  p_event jsonb
)
returns table(
  story jsonb,
  version_id uuid,
  event_id uuid,
  version_number integer,
  created boolean,
  applied boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  durable_title text;
  normalised_story jsonb := p_story;
begin
  if p_story_id is not null then
    -- Lock the parent before normalising its title. The delegated implementation
    -- later acquires the same row lock in this transaction, so concurrent Story
    -- updates cannot swap identity between the normalisation and persistence steps.
    select existing_story.title
    into durable_title
    from public.stories existing_story
    where existing_story.id = p_story_id
    for update;

    if not found then
      raise exception 'Canonical Story % was not found', p_story_id;
    end if;
    if nullif(btrim(durable_title), '') is null then
      raise exception 'Canonical Story % has no durable title', p_story_id;
    end if;

    normalised_story := jsonb_set(
      p_story,
      '{title}',
      to_jsonb(durable_title),
      true
    );
  end if;

  return query
  select *
  from public.persist_canonical_story_reasoning_v1(
    p_mutation_key,
    p_story_id,
    normalised_story,
    p_reasoning,
    p_event
  );
end;
$$;

revoke all on function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb)
  to service_role;

-- The implementation remains service-role callable because the wrapper is
-- SECURITY INVOKER and delegates under the caller's identity. No client role is
-- granted access to either persistence function.
revoke all on function public.persist_canonical_story_reasoning_v1(text, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_canonical_story_reasoning_v1(text, uuid, jsonb, jsonb, jsonb)
  to service_role;

comment on function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb) is
  'Canonical Story persistence boundary. Existing Story updates preserve the durable parent title while append-only events carry new development headlines.';

comment on function public.persist_canonical_story_reasoning_v1(text, uuid, jsonb, jsonb, jsonb) is
  'Internal atomic Story reasoning implementation retained from 20260823183129. Call through persist_canonical_story_reasoning so persistent Story identity is normalised first.';
