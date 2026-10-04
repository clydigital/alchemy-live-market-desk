\set ON_ERROR_STOP on

begin;

insert into public.stories (
  id, slug, title, thesis, status, confidence, current_thesis_version_id
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'b45-stale-base-fixture',
  'B4.5 stale-base fixture',
  'Initial thesis',
  'develop',
  70,
  '11111111-1111-4111-8111-111111111111'
);

select set_config(
  'alchemy.story_reasoning_context',
  jsonb_build_object(
    'mutationKey', 'b45-matching-base',
    'mutationKind', 'existing_story_update',
    'reasoning', jsonb_build_object('contractVersion', 'canonical-story-reasoning/v1'),
    'eventMetadata', jsonb_build_object(
      'expectedBaseVersionId', '11111111-1111-4111-8111-111111111111'
    )
  )::text,
  true
);

update public.stories
set thesis = 'Matching-base update succeeds'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
begin
  perform set_config(
    'alchemy.story_reasoning_context',
    jsonb_build_object(
      'mutationKey', 'b45-stale-base',
      'mutationKind', 'existing_story_update',
      'reasoning', jsonb_build_object('contractVersion', 'canonical-story-reasoning/v1'),
      'eventMetadata', jsonb_build_object(
        'expectedBaseVersionId', '22222222-2222-4222-8222-222222222222'
      )
    )::text,
    true
  );

  begin
    update public.stories
    set thesis = 'This stale update must not commit'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    raise exception 'Expected stale-base guard to reject the Story update';
  exception
    when others then
      if sqlerrm not like 'Canonical Story reasoning expected base thesis version is stale:%' then
        raise;
      end if;
  end;
end;
$$;

if exists (
  select 1
  from public.stories
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and thesis = 'This stale update must not commit'
) then
  raise exception 'Stale-base Story mutation committed unexpectedly';
end if;

select set_config('alchemy.story_reasoning_context', '', true);

update public.stories
set current_thesis_version_id = '33333333-3333-4333-8333-333333333333'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

if not exists (
  select 1
  from public.stories
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and current_thesis_version_id = '33333333-3333-4333-8333-333333333333'
) then
  raise exception 'Context-free Story pointer update was blocked unexpectedly';
end if;

rollback;
