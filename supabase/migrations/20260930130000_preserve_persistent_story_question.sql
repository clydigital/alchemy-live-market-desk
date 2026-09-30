-- Persistent Story identity hardening: existing Story updates may change the
-- live thesis and evidence state, but they must not casually rename the durable
-- Story title or replace an established market question with the latest event.
--
-- Explicit evidence-gated Story maintenance/reframe remains the route for
-- changing title or market_question intentionally.

create or replace function public.persist_canonical_story_reasoning(
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
  durable_market_question text;
  normalised_story jsonb := p_story;
begin
  if p_story_id is not null then
    select
      existing_story.title,
      existing_story.market_question
    into
      durable_title,
      durable_market_question
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
      normalised_story,
      '{title}',
      to_jsonb(durable_title),
      true
    );

    if nullif(btrim(durable_market_question), '') is not null then
      normalised_story := jsonb_set(
        normalised_story,
        '{market_question}',
        to_jsonb(durable_market_question),
        true
      );
    end if;
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

comment on function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb) is
  'Canonical Story persistence boundary. Existing Story updates preserve durable title and established market question; append-only events carry the latest development wording.';
