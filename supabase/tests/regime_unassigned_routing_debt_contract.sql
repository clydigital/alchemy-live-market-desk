-- Contract tests for governed unassigned Story routing debt and zero-link stale ownership.

do $$
begin
  if to_regprocedure('public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])') is null then
    raise exception 'Missing sync_regime_routing_debt_v1';
  end if;

  if has_function_privilege(
    'anon',
    'public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])',
    'EXECUTE'
  ) then
    raise exception 'Public client can execute Regime routing-debt sync';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute Regime routing-debt sync';
  end if;
end;
$$;

-- A newer projection that legitimately has zero Story links owns that state.
-- A late older worker must not recreate a link after the zero-link projection.
do $$
declare
  fixture_story uuid;
  newer_run uuid;
  older_run uuid;
  link_payload jsonb;
  active_links integer;
begin
  select id into fixture_story
  from public.stories
  order by created_at, id
  limit 1;

  if fixture_story is null then
    raise exception 'Regime routing contract fixture has no Story row';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:routing-zero:newer', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('7',64), now() + interval '4 hours'
  ) returning id into newer_run;

  perform * from public.sync_market_regime_story_links_v1(newer_run, '[]'::jsonb);

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:routing-zero:older', 'shadow', 'story_engine', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('8',64), now() + interval '3 hours'
  ) returning id into older_run;

  link_payload := jsonb_build_array(jsonb_build_object(
    'story_id', fixture_story,
    'regime_slug', 'global-cost-of-capital',
    'subgroup_key', 'treasury-fiscal',
    'role', 'core',
    'confidence', 90
  ));

  perform * from public.sync_market_regime_story_links_v1(older_run, link_payload);

  select count(*) into active_links
  from public.market_regime_story_links link
  join public.market_regimes regime on regime.id = link.regime_id
  join public.market_regime_subgroups subgroup on subgroup.id = link.subgroup_id
  where link.story_id = fixture_story
    and regime.slug = 'global-cost-of-capital'
    and subgroup.subgroup_key = 'treasury-fiscal'
    and link.role = 'core'
    and link.effective_to is null;

  if active_links <> 0 then
    raise exception 'Older Regime worker resurrected a Story link after a newer zero-link projection';
  end if;
end;
$$;

-- Unrouted active Stories stay visible through research_debt rather than being
-- forced into a weak Regime. Routing restoration resolves the debt, and an
-- older worker cannot reopen it.
do $$
declare
  fixture_story uuid;
  unassigned_run uuid;
  routed_run uuid;
  stale_run uuid;
  debt_result record;
  open_debt integer;
  resolved_debt integer;
begin
  select id into fixture_story
  from public.stories
  order by created_at, id
  limit 1;

  if fixture_story is null then
    raise exception 'Regime routing debt fixture has no Story row';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:routing-debt:unassigned', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('9',64), now() + interval '6 hours'
  ) returning id into unassigned_run;

  select * into debt_result
  from public.sync_regime_routing_debt_v1(
    unassigned_run,
    array[fixture_story],
    '{}'::uuid[]
  );

  if debt_result.stale then
    raise exception 'Newest Regime routing-debt sync was incorrectly treated as stale';
  end if;

  select count(*) into open_debt
  from public.research_debt
  where story_id = fixture_story
    and debt_key = 'regime-routing:' || fixture_story::text
    and status = 'open'
    and metadata ->> 'kind' = 'regime_routing_debt'
    and metadata ->> 'routingStatus' = 'unassigned'
    and metadata ->> 'contractVersion' = 'regime-routing-debt/1';

  if open_debt <> 1 then
    raise exception 'Unassigned Story did not produce exactly one open routing debt row';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:routing-debt:routed', 'shadow', 'story_engine', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('a',64), now() + interval '8 hours'
  ) returning id into routed_run;

  perform * from public.sync_regime_routing_debt_v1(
    routed_run,
    array[fixture_story],
    array[fixture_story]
  );

  select count(*) into resolved_debt
  from public.research_debt
  where story_id = fixture_story
    and debt_key = 'regime-routing:' || fixture_story::text
    and status = 'resolved'
    and resolution_note like 'A governed Regime route was restored%'
    and metadata ->> 'routingStatus' = 'routed'
    and metadata ->> 'resolvedByProjectionRunId' = routed_run::text
    and metadata ? 'resolvedAt';

  if resolved_debt <> 1 then
    raise exception 'Routing restoration did not resolve the Story routing debt with routed metadata';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:routing-debt:stale', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('b',64), now() + interval '7 hours'
  ) returning id into stale_run;

  select * into debt_result
  from public.sync_regime_routing_debt_v1(
    stale_run,
    array[fixture_story],
    '{}'::uuid[]
  );

  if not debt_result.stale then
    raise exception 'Older Regime routing-debt worker was not rejected as stale';
  end if;

  select count(*) into open_debt
  from public.research_debt
  where story_id = fixture_story
    and debt_key = 'regime-routing:' || fixture_story::text
    and status = 'open';

  if open_debt <> 0 then
    raise exception 'Stale Regime routing-debt worker reopened resolved routing debt';
  end if;
end;
$$;

-- Routed IDs must come from the exact considered Story set.
do $$
declare
  fixture_story uuid;
  run_id uuid;
begin
  select id into fixture_story
  from public.stories
  order by created_at, id
  limit 1;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:routing-debt:subset', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('c',64), now() + interval '10 hours'
  ) returning id into run_id;

  begin
    perform * from public.sync_regime_routing_debt_v1(
      run_id,
      '{}'::uuid[],
      array[fixture_story]
    );
    raise exception 'Routing-debt sync accepted a routed Story outside the considered set';
  exception
    when raise_exception then
      if sqlerrm not like 'Routed Story IDs must be a subset%' then
        raise;
      end if;
  end;
end;
$$;
