-- Executable PR3A contract test. Run only against a disposable/test database
-- with all repository migrations applied. Every fixture is rolled back.

begin;

set local lock_timeout = '2s';
set local statement_timeout = '20s';

DO $$
declare
  v1_story_id uuid := '31000000-0000-4000-8000-000000000001';
  v1_version_id uuid := '31000000-0000-4000-8000-000000000011';
  v2_version_id uuid := '31000000-0000-4000-8000-000000000012';
  legacy_story_id uuid := '31000000-0000-4000-8000-000000000002';
  legacy_version_id uuid := '31000000-0000-4000-8000-000000000021';
  v1_snapshot_id uuid;
  legacy_snapshot_id uuid;
  before_payload jsonb;
  after_payload jsonb;
  row_version_id uuid;
  mismatch_rejected boolean := false;
begin
  insert into public.stories(
    id,slug,title,thesis,status,confidence,market_question,
    confirmation_trigger,invalidation_trigger,next_catalyst,assets,created_by
  ) values (
    v1_story_id,'pr3a-v1-fixture','PR3A V1 Story','Fixture thesis','develop',67,
    'Fixture question?','Confirm fixture','Invalidate fixture','Fixture catalyst',array['DXY'],'test'
  );

  insert into public.story_thesis_versions(
    id,story_id,version_number,title,thesis,status,confidence,market_question,
    confirmation_trigger,invalidation_trigger,next_catalyst,assets,snapshot,change_reason,effective_at
  ) values (
    v1_version_id,v1_story_id,1,'PR3A V1 Story','Fixture thesis','develop',67,'Fixture question?',
    'Confirm fixture','Invalidate fixture','Fixture catalyst',array['DXY'],
    jsonb_build_object(
      'reasoning', jsonb_build_object(
        'contractVersion','canonical-story-reasoning/v1',
        'lifecycle','developing',
        'whatChanged','Fixture changed',
        'previousState','Old fixture state',
        'currentState','Current fixture state',
        'marketReaction','Fixture reaction',
        'acceptedExplanation','Fixture explanation',
        'claims','[]'::jsonb,
        'causalChain','[]'::jsonb,
        'countercase',jsonb_build_object('summary','Fixture countercase'),
        'overlookedVariable',jsonb_build_object('summary','Fixture variable'),
        'assetImplications','[]'::jsonb,
        'confirmation',jsonb_build_array('Confirm fixture'),
        'invalidation',jsonb_build_array('Invalidate fixture'),
        'nextTest',null,
        'visualPlan','[]'::jsonb
      )
    ),
    'fixture_v1','2026-08-24T00:00:00Z'
  );

  update public.stories
  set current_thesis_version_id=v1_version_id
  where id=v1_story_id;

  insert into public.hybrid_publication_snapshots(
    story_id,story_thesis_version_id,snapshot_type,public_summary,payload,confidence
  ) values (
    v1_story_id,null,'story','PR3A V1 Story',
    jsonb_build_object(
      'canonicalStoryState', jsonb_build_object(
        'id',v1_story_id::text,
        'title','PR3A V1 Story',
        'thesis','Fixture thesis',
        'thesisVersion',null
      )
    ),
    67
  ) returning id into v1_snapshot_id;

  select story_thesis_version_id,payload
  into row_version_id,before_payload
  from public.hybrid_publication_snapshots
  where id=v1_snapshot_id;

  if row_version_id is distinct from v1_version_id then
    raise exception 'V1 Story snapshot did not freeze exact current thesis version';
  end if;
  if before_payload #>> '{canonicalStoryState,thesisVersion,id}' <> v1_version_id::text then
    raise exception 'canonicalStoryState thesisVersion was not frozen to exact version';
  end if;
  if before_payload #>> '{canonicalStoryReasoning,storyVersionId}' <> v1_version_id::text then
    raise exception 'Materialised V1 storyVersionId does not match snapshot FK';
  end if;
  if before_payload #>> '{canonicalStoryReasoning,storyId}' <> v1_story_id::text
    or before_payload #>> '{canonicalStoryReasoning,title}' <> 'PR3A V1 Story'
    or (before_payload #>> '{canonicalStoryReasoning,confidence}')::integer <> 67 then
    raise exception 'Materialised V1 did not use immutable direct version projections';
  end if;
  if before_payload #> '{canonicalStoryReasoning,visualPlan}' <> '[]'::jsonb then
    raise exception 'Empty V1 visual plan must remain exactly empty';
  end if;

  -- Advance current state after publication. The prior append-only publication
  -- row must remain byte/deep-equal and must not consult current Story state.
  insert into public.story_thesis_versions(
    id,story_id,version_number,title,thesis,status,confidence,market_question,
    confirmation_trigger,invalidation_trigger,next_catalyst,assets,snapshot,change_reason,effective_at
  ) values (
    v2_version_id,v1_story_id,2,'PR3A V1 Story newer','New fixture thesis','develop',72,'New fixture question?',
    'New confirmation','New invalidation','New catalyst',array['DXY'],
    jsonb_build_object('reasoning', jsonb_build_object(
      'contractVersion','canonical-story-reasoning/v1',
      'lifecycle','developing',
      'whatChanged','New fixture change',
      'previousState','Fixture prior',
      'currentState','Fixture newer',
      'marketReaction','New reaction',
      'acceptedExplanation','New explanation',
      'claims','[]'::jsonb,
      'causalChain','[]'::jsonb,
      'countercase',jsonb_build_object('summary','New countercase'),
      'overlookedVariable',jsonb_build_object('summary','New variable'),
      'assetImplications','[]'::jsonb,
      'confirmation',jsonb_build_array('New confirmation'),
      'invalidation',jsonb_build_array('New invalidation'),
      'nextTest',null,
      'visualPlan','[]'::jsonb
    )),
    'fixture_v2','2026-08-24T01:00:00Z'
  );
  update public.stories set current_thesis_version_id=v2_version_id where id=v1_story_id;

  select payload into after_payload
  from public.hybrid_publication_snapshots
  where id=v1_snapshot_id;
  if after_payload is distinct from before_payload then
    raise exception 'Historical Story publication changed after current Story advanced';
  end if;

  begin
    insert into public.hybrid_publication_snapshots(
      story_id,story_thesis_version_id,snapshot_type,public_summary,payload,confidence
    ) values (
      v1_story_id,v1_version_id,'story','Stale fixture publication',
      jsonb_build_object('canonicalStoryState',jsonb_build_object(
        'id',v1_story_id::text,
        'thesisVersion',jsonb_build_object('id',v1_version_id::text)
      )),67
    );
  exception when others then
    mismatch_rejected := true;
  end;
  if not mismatch_rejected then
    raise exception 'Stale/non-current Story thesis version must be rejected';
  end if;

  insert into public.stories(
    id,slug,title,thesis,status,confidence,market_question,
    confirmation_trigger,invalidation_trigger,next_catalyst,assets,created_by
  ) values (
    legacy_story_id,'pr3a-legacy-fixture','PR3A Legacy Story','Legacy thesis','monitor',55,
    'Legacy question?','Legacy confirm','Legacy invalidate','Legacy catalyst',array['SPX'],'test'
  );
  insert into public.story_thesis_versions(
    id,story_id,version_number,title,thesis,status,confidence,market_question,
    confirmation_trigger,invalidation_trigger,next_catalyst,assets,snapshot,change_reason,effective_at
  ) values (
    legacy_version_id,legacy_story_id,1,'PR3A Legacy Story','Legacy thesis','monitor',55,'Legacy question?',
    'Legacy confirm','Legacy invalidate','Legacy catalyst',array['SPX'],'{}'::jsonb,
    'legacy_fixture','2026-08-24T00:00:00Z'
  );
  update public.stories set current_thesis_version_id=legacy_version_id where id=legacy_story_id;

  insert into public.hybrid_publication_snapshots(
    story_id,story_thesis_version_id,snapshot_type,public_summary,payload,confidence
  ) values (
    legacy_story_id,null,'story','PR3A Legacy Story',
    jsonb_build_object('canonicalStoryState',jsonb_build_object('id',legacy_story_id::text)),55
  ) returning id into legacy_snapshot_id;

  select story_thesis_version_id,payload
  into row_version_id,after_payload
  from public.hybrid_publication_snapshots
  where id=legacy_snapshot_id;

  if row_version_id is distinct from legacy_version_id then
    raise exception 'Legacy Story snapshot did not freeze exact immutable thesis version';
  end if;
  if jsonb_typeof(after_payload -> 'canonicalStoryReasoning') <> 'null' then
    raise exception 'Legacy/core-only Story publication must not manufacture V1 reasoning';
  end if;
end;
$$;

rollback;
