-- Contract tests for persistent Regime shadow engine.

do $$
declare
  missing text[];
begin
  select array_agg(required.name)
  into missing
  from (
    values
      ('market_regimes'),
      ('market_regime_subgroups'),
      ('market_regime_story_links'),
      ('market_regime_projection_runs'),
      ('market_regime_versions'),
      ('market_regime_current')
  ) as required(name)
  where to_regclass('public.' || required.name) is null;

  if missing is not null then
    raise exception 'Missing Regime tables: %', array_to_string(missing, ', ');
  end if;
end;
$$;

do $$
declare
  regime_count integer;
  subgroup_count integer;
begin
  select count(*) into regime_count
  from public.market_regimes
  where status='active';

  select count(*) into subgroup_count
  from public.market_regime_subgroups
  where status='active';

  if regime_count <> 5 then
    raise exception 'Expected 5 active Regimes, got %', regime_count;
  end if;

  if subgroup_count <> 30 then
    raise exception 'Expected 30 active Regime subgroups, got %', subgroup_count;
  end if;
end;
$$;

do $$
declare
  insecure text[];
begin
  select array_agg(c.relname order by c.relname)
  into insecure
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'market_regimes',
      'market_regime_subgroups',
      'market_regime_story_links',
      'market_regime_projection_runs',
      'market_regime_versions',
      'market_regime_current'
    )
    and not c.relrowsecurity;

  if insecure is not null then
    raise exception 'RLS is not enabled on: %', array_to_string(insecure, ', ');
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'market_regimes',
    'market_regime_subgroups',
    'market_regime_story_links',
    'market_regime_projection_runs',
    'market_regime_versions',
    'market_regime_current'
  ]
  loop
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') then
      raise exception 'Public client can SELECT private Regime table %', table_name;
    end if;

    if not has_table_privilege('service_role', 'public.' || table_name, 'SELECT') then
      raise exception 'service_role cannot SELECT Regime table %', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.sync_market_regime_story_links_v1(uuid,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute sync_market_regime_story_links_v1';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.persist_market_regime_projection_v1(uuid,text,jsonb,text,jsonb,timestamptz,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can execute persist_market_regime_projection_v1';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.sync_market_regime_story_links_v1(uuid,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute sync_market_regime_story_links_v1';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.persist_market_regime_projection_v1(uuid,text,jsonb,text,jsonb,timestamptz,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute persist_market_regime_projection_v1';
  end if;
end;
$$;

do $$
declare
  run1 uuid;
  run2 uuid;
  run3 uuid;
  v1 uuid;
  v1_repeat uuid;
  v1_refresh uuid;
  v2 uuid;
  n integer;
  reason text;
  current_snapshot jsonb;
begin
  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash
  ) values (
    'contract:regime:1', 'shadow', 'bootstrap', 'regime-projector/1',
    'started', '{}'::jsonb, repeat('1',64)
  ) returning id into run1;

  select version_id
  into v1
  from public.persist_market_regime_projection_v1(
    run1,
    'global-cost-of-capital',
    '{"regime":{"state":"initial","pending":["a"]}}'::jsonb,
    repeat('a',64),
    '{"storyVersionIds":["v1"]}'::jsonb,
    now(),
    'Rates restrictive · broader funding partial',
    'unresolved',
    'PARTIAL',
    'shadow_change'
  );

  select materiality_reason into reason
  from public.market_regime_versions
  where id=v1;

  if reason <> 'bootstrap_current_state' then
    raise exception 'First Regime version was not labelled bootstrap_current_state: %', reason;
  end if;

  select version_id
  into v1_repeat
  from public.persist_market_regime_projection_v1(
    run1,
    'global-cost-of-capital',
    '{"regime":{"state":"initial","pending":["a"]}}'::jsonb,
    repeat('a',64),
    '{"storyVersionIds":["v1"]}'::jsonb,
    now(),
    'Rates restrictive · broader funding partial',
    'unresolved',
    'PARTIAL',
    'shadow_change'
  );

  if v1_repeat <> v1 then
    raise exception 'Same projection run did not return the same immutable version';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash
  ) values (
    'contract:regime:2', 'shadow', 'dossier', 'regime-projector/1',
    'started', '{}'::jsonb, repeat('2',64)
  ) returning id into run2;

  select version_id
  into v1_refresh
  from public.persist_market_regime_projection_v1(
    run2,
    'global-cost-of-capital',
    '{"regime":{"state":"initial","pending":["different-live-node"]}}'::jsonb,
    repeat('a',64),
    '{"storyVersionIds":["v1"],"newTelemetry":"same-material-state"}'::jsonb,
    now(),
    'Rates restrictive · broader funding partial',
    'unresolved',
    'PARTIAL',
    'shadow_change'
  );

  if v1_refresh <> v1 then
    raise exception 'Same material hash created a new Regime version';
  end if;

  select count(*) into n
  from public.market_regime_versions
  where regime_id=(select id from public.market_regimes where slug='global-cost-of-capital');

  if n <> 1 then
    raise exception 'Expected one material Regime version after live refresh, got %', n;
  end if;

  select snapshot into current_snapshot
  from public.market_regime_current
  where regime_id=(select id from public.market_regimes where slug='global-cost-of-capital')
    and projection_mode='shadow';

  if current_snapshot #>> '{regime,pending,0}' <> 'different-live-node' then
    raise exception 'Current Regime read model did not refresh non-material live projection';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash
  ) values (
    'contract:regime:3', 'shadow', 'story_engine', 'regime-projector/1',
    'started', '{}'::jsonb, repeat('3',64)
  ) returning id into run3;

  select version_id
  into v2
  from public.persist_market_regime_projection_v1(
    run3,
    'global-cost-of-capital',
    '{"regime":{"state":"material-change"}}'::jsonb,
    repeat('b',64),
    '{"storyVersionIds":["v2"]}'::jsonb,
    now(),
    'Material state changed',
    'interpreted',
    'STORY-LED',
    'shadow_change'
  );

  if v2 = v1 then
    raise exception 'Changed material hash did not create a new Regime version';
  end if;

  select count(*) into n
  from public.market_regime_versions
  where regime_id=(select id from public.market_regimes where slug='global-cost-of-capital');

  if n <> 2 then
    raise exception 'Expected two material Regime versions after change, got %', n;
  end if;

  begin
    update public.market_regime_versions
    set state='should fail'
    where id=v1;
    raise exception 'Append-only Regime version update unexpectedly succeeded';
  exception
    when sqlstate '55000' then
      null;
  end;
end;
$$;

do $$
declare
  run_id uuid;
  active_count integer;
begin
  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash
  ) values (
    'contract:links:empty', 'shadow', 'manual', 'regime-projector/1',
    'started', '{}'::jsonb, repeat('4',64)
  ) returning id into run_id;

  select result.active_count
  into active_count
  from public.sync_market_regime_story_links_v1(run_id, '[]'::jsonb) result;

  if active_count <> 0 then
    raise exception 'Empty Regime routing unexpectedly produced active links: %', active_count;
  end if;
end;
$$;


-- A stale worker that finishes after a newer run must never overwrite current.
do $$
declare
  newer_run uuid;
  older_run uuid;
  newer_version uuid;
  stale_return_version uuid;
  current_version uuid;
  current_hash text;
  fixture_story uuid;
  fiscal_subgroup text := 'treasury-fiscal';
  link_payload jsonb;
  active_links integer;
begin
  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:stale:newer', 'shadow', 'dossier', 'regime-projector/1',
    'started', '{}'::jsonb, repeat('5',64), now() + interval '1 minute'
  ) returning id into newer_run;

  select version_id
  into newer_version
  from public.persist_market_regime_projection_v1(
    newer_run,
    'global-cost-of-capital',
    '{"regime":{"state":"newest"}}'::jsonb,
    repeat('c',64),
    '{"storyVersionIds":["newest"]}'::jsonb,
    now(),
    'Newest state',
    'interpreted',
    'STORY-LED',
    'shadow_change'
  );

  select id into fixture_story
  from public.stories
  order by created_at, id
  limit 1;

  if fixture_story is null then
    raise exception 'Regime contract fixture has no Story row for stale-link test';
  end if;

  link_payload := jsonb_build_array(jsonb_build_object(
    'story_id', fixture_story,
    'regime_slug', 'global-cost-of-capital',
    'subgroup_key', fiscal_subgroup,
    'role', 'core',
    'confidence', 90
  ));

  perform * from public.sync_market_regime_story_links_v1(newer_run, link_payload);

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:stale:older', 'shadow', 'story_engine', 'regime-projector/1',
    'started', '{}'::jsonb, repeat('6',64), now() - interval '1 hour'
  ) returning id into older_run;

  select version_id
  into stale_return_version
  from public.persist_market_regime_projection_v1(
    older_run,
    'global-cost-of-capital',
    '{"regime":{"state":"stale-worker"}}'::jsonb,
    repeat('d',64),
    '{"storyVersionIds":["stale"]}'::jsonb,
    now(),
    'Stale worker state',
    'interpreted',
    'STORY-LED',
    'shadow_change'
  );

  select version_id, snapshot_hash
  into current_version, current_hash
  from public.market_regime_current
  where regime_id=(select id from public.market_regimes where slug='global-cost-of-capital')
    and projection_mode='shadow';

  if current_version <> newer_version
     or stale_return_version <> newer_version
     or current_hash <> repeat('c',64) then
    raise exception 'Stale Regime worker overwrote newer current projection';
  end if;

  perform * from public.sync_market_regime_story_links_v1(older_run, '[]'::jsonb);

  select count(*) into active_links
  from public.market_regime_story_links link
  join public.market_regimes regime on regime.id=link.regime_id
  join public.market_regime_subgroups subgroup on subgroup.id=link.subgroup_id
  where link.story_id=fixture_story
    and regime.slug='global-cost-of-capital'
    and subgroup.subgroup_key=fiscal_subgroup
    and link.role='core'
    and link.effective_to is null;

  if active_links <> 1 then
    raise exception 'Stale Regime worker expired newer active Story link';
  end if;
end;
$$;
