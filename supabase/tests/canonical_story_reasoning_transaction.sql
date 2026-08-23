-- Executable PR #99 transaction contract. Run after all migrations in a safe
-- local/test database. Every fixture and test trigger is rolled back.

begin;

create temporary table pr99_reasoning_contract_state (
  story_id uuid not null,
  initial_event_id uuid not null,
  initial_version_id uuid not null,
  initial_snapshot jsonb not null,
  initial_event_count bigint not null,
  initial_version_count bigint not null
) on commit drop;

do $$
declare
  mutation_result record;
  initial_reasoning jsonb := jsonb_build_object(
    'contractVersion', 'canonical-story-reasoning/v1',
    'lifecycle', 'developing',
    'claims', jsonb_build_array(jsonb_build_object(
      'id', 'claim:initial',
      'type', 'thesis',
      'text', 'Initial transaction contract thesis',
      'evidenceIds', '[]'::jsonb
    )),
    'causalChain', '[]'::jsonb,
    'countercase', jsonb_build_object('strongest', null, 'evidenceIds', '[]'::jsonb, 'weakestLink', null, 'marketMayBeRight', null),
    'overlookedVariable', jsonb_build_object('text', null, 'evidenceState', null, 'evidenceIds', '[]'::jsonb),
    'assetImplications', '[]'::jsonb,
    'confirmation', '[]'::jsonb,
    'invalidation', '[]'::jsonb,
    'nextTest', null,
    'visualPlan', '[]'::jsonb
  );
  event_count bigint;
  version_count bigint;
  stored_snapshot jsonb;
begin
  select * into mutation_result
  from public.persist_canonical_story_reasoning(
    'pr99-contract-initial',
    null,
    jsonb_build_object(
      'slug', 'pr99-atomic-contract-fixture',
      'title', 'PR #99 atomic contract fixture',
      'thesis', 'Initial transaction contract thesis',
      'status', 'develop',
      'confidence', 60,
      'market_question', 'Does the atomic contract hold?',
      'dominant_narrative', 'The transaction either persists every canonical row or none.',
      'best_explanation', 'PostgreSQL executes the RPC as one transaction.',
      'strongest_support', 'The exact pointer is returned by the RPC.',
      'strongest_contradiction', 'A forced version failure must roll back the Story update.',
      'priced_assessment', 'Contract test only.',
      'confirmation_trigger', 'One event and one version persist.',
      'invalidation_trigger', 'Any partial row remains.',
      'next_catalyst', 'Forced failure test.',
      'article_angle', 'Atomic persistence contract.',
      'provisional_title', 'PR #99 atomic contract fixture',
      'article_verdict', 'research_engine',
      'assets', jsonb_build_array('TEST'),
      'created_by', 'alchemy_research_engine',
      'source_quality', 75,
      'novelty', 70,
      'persistence', 60,
      'trader_relevance', 70,
      'article_potential', 70
    ),
    initial_reasoning,
    jsonb_build_object(
      'headline', 'Original Alchemy research-engine thesis recorded',
      'detail', 'PR #99 initial transaction fixture.',
      'event_at', '2026-08-23T13:30:00.000Z',
      'metadata', jsonb_build_object('novelty_class', 'new_story')
    )
  );

  if mutation_result.created is not true or mutation_result.applied is not true then
    raise exception 'Initial canonical Story mutation did not report created/applied';
  end if;
  if mutation_result.version_number <> 1 then
    raise exception 'Initial version number was %, expected 1', mutation_result.version_number;
  end if;
  if mutation_result.story ->> 'current_thesis_version_id' is distinct from mutation_result.version_id::text then
    raise exception 'Initial Story pointer does not equal the reasoning-bearing version';
  end if;

  select count(*) into event_count
  from public.story_events event
  where event.story_id = (mutation_result.story ->> 'id')::uuid;
  select count(*)
  into version_count
  from public.story_thesis_versions version
  where version.story_id = (mutation_result.story ->> 'id')::uuid;
  select version.snapshot
  into stored_snapshot
  from public.story_thesis_versions version
  where version.story_id = (mutation_result.story ->> 'id')::uuid
  limit 1;

  if event_count <> 1 or version_count <> 1 then
    raise exception 'Initial mutation wrote % events and % versions; expected one each', event_count, version_count;
  end if;
  if stored_snapshot -> 'reasoning' is distinct from initial_reasoning then
    raise exception 'Initial immutable version did not preserve the supplied reasoning';
  end if;

  insert into pr99_reasoning_contract_state
  values (
    (mutation_result.story ->> 'id')::uuid,
    mutation_result.event_id,
    mutation_result.version_id,
    stored_snapshot,
    event_count,
    version_count
  );
end;
$$;

create or replace function pg_temp.fail_pr99_reasoning_version()
returns trigger
language plpgsql
as $$
begin
  if new.snapshot ->> 'canonicalMutationKey' = 'pr99-contract-forced-failure' then
    raise exception 'simulated canonical version persistence failure';
  end if;
  return new;
end;
$$;

create trigger pr99_fail_reasoning_version
before insert on public.story_thesis_versions
for each row execute function pg_temp.fail_pr99_reasoning_version();

do $$
declare
  fixture pr99_reasoning_contract_state%rowtype;
  story_before public.stories%rowtype;
  story_after public.stories%rowtype;
  failure_reasoning jsonb := jsonb_build_object(
    'contractVersion', 'canonical-story-reasoning/v1',
    'lifecycle', 'developing',
    'claims', '[]'::jsonb,
    'causalChain', '[]'::jsonb,
    'countercase', '{}'::jsonb,
    'overlookedVariable', '{}'::jsonb,
    'assetImplications', '[]'::jsonb,
    'confirmation', '[]'::jsonb,
    'invalidation', '[]'::jsonb,
    'nextTest', null,
    'visualPlan', '[]'::jsonb
  );
  event_count bigint;
  version_count bigint;
  failed_as_expected boolean := false;
begin
  select * into fixture from pr99_reasoning_contract_state;
  select * into story_before from public.stories story where story.id = fixture.story_id;

  begin
    perform *
    from public.persist_canonical_story_reasoning(
      'pr99-contract-forced-failure',
      fixture.story_id,
      to_jsonb(story_before) || jsonb_build_object(
        'title', 'This title must roll back',
        'thesis', 'This thesis must roll back',
        'confidence', 72
      ),
      failure_reasoning,
      jsonb_build_object(
        'headline', 'Forced failure must roll back',
        'detail', 'The version trigger raises after the event insert.',
        'event_at', '2026-08-23T13:31:00.000Z',
        'metadata', '{}'::jsonb
      )
    );
  exception when others then
    if position('simulated canonical version persistence failure' in sqlerrm) = 0 then
      raise;
    end if;
    failed_as_expected := true;
  end;

  if not failed_as_expected then
    raise exception 'Forced version failure did not propagate';
  end if;

  select * into story_after from public.stories story where story.id = fixture.story_id;
  select count(*) into event_count from public.story_events event where event.story_id = fixture.story_id;
  select count(*) into version_count from public.story_thesis_versions version where version.story_id = fixture.story_id;

  if story_after.title is distinct from story_before.title
    or story_after.thesis is distinct from story_before.thesis
    or story_after.confidence is distinct from story_before.confidence
    or story_after.current_thesis_version_id is distinct from story_before.current_thesis_version_id then
    raise exception 'Story was partially mutated after the forced version failure';
  end if;
  if event_count <> fixture.initial_event_count or version_count <> fixture.initial_version_count then
    raise exception 'Forced failure left an orphan event or version';
  end if;
end;
$$;

drop trigger pr99_fail_reasoning_version on public.story_thesis_versions;
drop function pg_temp.fail_pr99_reasoning_version();

do $$
declare
  fixture pr99_reasoning_contract_state%rowtype;
  story_before public.stories%rowtype;
  mutation_result record;
  retry_result record;
  revision_reasoning jsonb := jsonb_build_object(
    'contractVersion', 'canonical-story-reasoning/v1',
    'lifecycle', 'confirmed',
    'claims', jsonb_build_array(jsonb_build_object(
      'id', 'claim:revision',
      'type', 'thesis',
      'text', 'Revised transaction contract thesis',
      'evidenceIds', '[]'::jsonb
    )),
    'causalChain', '[]'::jsonb,
    'countercase', '{}'::jsonb,
    'overlookedVariable', '{}'::jsonb,
    'assetImplications', '[]'::jsonb,
    'confirmation', '[]'::jsonb,
    'invalidation', '[]'::jsonb,
    'nextTest', null,
    'visualPlan', '[]'::jsonb
  );
  revision_story jsonb;
  revision_event jsonb := jsonb_build_object(
    'headline', 'PR #99 exact revision',
    'detail', 'One canonical event and version must persist.',
    'event_at', '2026-08-23T13:32:00.000Z',
    'metadata', jsonb_build_object('novelty_class', 'existing_story_update')
  );
  event_count_before bigint;
  version_count_before bigint;
  update_count_before bigint;
  event_count_after bigint;
  version_count_after bigint;
  update_count_after bigint;
  reasoning_version_count bigint;
  preserved_snapshot jsonb;
begin
  select * into fixture from pr99_reasoning_contract_state;
  select * into story_before from public.stories story where story.id = fixture.story_id;
  revision_story := to_jsonb(story_before) || jsonb_build_object(
    'title', 'PR #99 revised atomic contract fixture',
    'thesis', 'Revised transaction contract thesis',
    'status', 'publish',
    'confidence', 72
  );

  select count(*) into event_count_before from public.story_events event where event.story_id = fixture.story_id;
  select count(*) into version_count_before from public.story_thesis_versions version where version.story_id = fixture.story_id;
  select count(*) into update_count_before from public.story_updates update_row where update_row.story_id = fixture.story_id;

  select * into mutation_result
  from public.persist_canonical_story_reasoning(
    'pr99-contract-revision', fixture.story_id, revision_story, revision_reasoning, revision_event
  );

  select count(*) into event_count_after from public.story_events event where event.story_id = fixture.story_id;
  select count(*) into version_count_after from public.story_thesis_versions version where version.story_id = fixture.story_id;
  select count(*) into update_count_after from public.story_updates update_row where update_row.story_id = fixture.story_id;
  select count(*) into reasoning_version_count
  from public.story_thesis_versions version
  where version.story_id = fixture.story_id
    and version.snapshot ->> 'canonicalMutationKey' = 'pr99-contract-revision'
    and version.snapshot -> 'reasoning' = revision_reasoning;

  if mutation_result.created is not false or mutation_result.applied is not true then
    raise exception 'Revision did not report existing/applied';
  end if;
  if event_count_after - event_count_before <> 1
    or version_count_after - version_count_before <> 1
    or update_count_after - update_count_before <> 1
    or reasoning_version_count <> 1 then
    raise exception 'Revision deltas were events %, versions %, updates %, reasoning versions %',
      event_count_after - event_count_before,
      version_count_after - version_count_before,
      update_count_after - update_count_before,
      reasoning_version_count;
  end if;
  if mutation_result.story ->> 'current_thesis_version_id' is distinct from mutation_result.version_id::text then
    raise exception 'Revision pointer does not equal the exact reasoning-bearing version';
  end if;
  if mutation_result.version_number <> 2 then
    raise exception 'Revision version number was %, expected 2', mutation_result.version_number;
  end if;

  select version.snapshot into preserved_snapshot
  from public.story_thesis_versions version
  where version.id = fixture.initial_version_id;
  if preserved_snapshot is distinct from fixture.initial_snapshot then
    raise exception 'Prior immutable version changed during revision';
  end if;

  select * into retry_result
  from public.persist_canonical_story_reasoning(
    'pr99-contract-revision', fixture.story_id, revision_story, revision_reasoning, revision_event
  );
  if retry_result.applied is not false
    or retry_result.version_id is distinct from mutation_result.version_id
    or retry_result.event_id is distinct from mutation_result.event_id then
    raise exception 'Idempotent retry did not return the original canonical history';
  end if;

  if (select count(*) from public.story_events event where event.story_id = fixture.story_id) <> event_count_after
    or (select count(*) from public.story_thesis_versions version where version.story_id = fixture.story_id) <> version_count_after
    or (select count(*) from public.story_updates update_row where update_row.story_id = fixture.story_id) <> update_count_after then
    raise exception 'Idempotent retry created duplicate history';
  end if;

  update public.stories story
  set updated_at = '2026-08-23T13:33:00.000Z'
  where story.id = fixture.story_id;
  if (select count(*) from public.story_thesis_versions version where version.story_id = fixture.story_id) <> version_count_after then
    raise exception 'Freshness-only update unexpectedly created a thesis version';
  end if;
end;
$$;

rollback;
