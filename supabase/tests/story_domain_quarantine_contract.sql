-- Contract tests for Story-domain quarantine and routing-debt handoff.

do $$
begin
  if to_regprocedure('public.sync_story_domain_debt_v1(uuid,uuid[],uuid[])') is null then
    raise exception 'Missing sync_story_domain_debt_v1';
  end if;

  if has_function_privilege(
    'anon',
    'public.sync_story_domain_debt_v1(uuid,uuid[],uuid[])',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.sync_story_domain_debt_v1(uuid,uuid[],uuid[])',
    'EXECUTE'
  ) then
    raise exception 'Public client can execute Story-domain debt sync';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.sync_story_domain_debt_v1(uuid,uuid[],uuid[])',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute Story-domain debt sync';
  end if;
end;
$$;

do $$
declare
  fixture_story uuid;
  quarantine_run uuid;
  restored_run uuid;
  stale_run uuid;
  result_row record;
  open_domain integer;
  resolved_domain integer;
  resolved_routing integer;
begin
  select id into fixture_story
  from public.stories
  order by created_at, id
  limit 1;

  if fixture_story is null then
    raise exception 'Story-domain contract fixture has no Story row';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:story-domain:quarantine', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('d',64), now() + interval '12 hours'
  ) returning id into quarantine_run;

  -- Establish the pre-quarantine routing debt this governance handoff replaces.
  perform * from public.sync_regime_routing_debt_v1(
    quarantine_run,
    array[fixture_story],
    '{}'::uuid[]
  );

  select * into result_row
  from public.sync_story_domain_debt_v1(
    quarantine_run,
    array[fixture_story],
    '{}'::uuid[]
  );

  if result_row.stale then
    raise exception 'Newest Story-domain sync was incorrectly treated as stale';
  end if;

  select count(*) into open_domain
  from public.research_debt
  where story_id = fixture_story
    and debt_key = 'story-domain:' || fixture_story::text
    and status = 'open'
    and metadata ->> 'kind' = 'story_domain_debt'
    and metadata ->> 'domainStatus' = 'quarantined'
    and metadata ->> 'contractVersion' = 'story-domain/1';

  if open_domain <> 1 then
    raise exception 'Out-of-domain Story did not produce exactly one quarantine debt row';
  end if;

  -- Once domain quarantine is explicit, the same object is no longer a Regime
  -- taxonomy failure and its routing debt must close as domain_quarantined.
  perform * from public.sync_regime_routing_debt_v1(
    quarantine_run,
    '{}'::uuid[],
    '{}'::uuid[]
  );

  select count(*) into resolved_routing
  from public.research_debt
  where story_id = fixture_story
    and debt_key = 'regime-routing:' || fixture_story::text
    and status = 'resolved'
    and metadata ->> 'routingStatus' = 'domain_quarantined'
    and metadata ->> 'resolvedByProjectionRunId' = quarantine_run::text;

  if resolved_routing <> 1 then
    raise exception 'Domain quarantine did not resolve the prior Regime routing debt';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:story-domain:restored', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('e',64), now() + interval '14 hours'
  ) returning id into restored_run;

  perform * from public.sync_story_domain_debt_v1(
    restored_run,
    array[fixture_story],
    array[fixture_story]
  );

  select count(*) into resolved_domain
  from public.research_debt
  where story_id = fixture_story
    and debt_key = 'story-domain:' || fixture_story::text
    and status = 'resolved'
    and metadata ->> 'domainStatus' = 'admissible'
    and metadata ->> 'resolvedByProjectionRunId' = restored_run::text
    and metadata ? 'resolvedAt';

  if resolved_domain <> 1 then
    raise exception 'Restored market-domain eligibility did not resolve quarantine debt';
  end if;

  insert into public.market_regime_projection_runs(
    run_key, projection_mode, trigger_kind, contract_version,
    status, input_manifest, input_hash, started_at
  ) values (
    'contract:story-domain:stale', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('f',64), now() + interval '13 hours'
  ) returning id into stale_run;

  select * into result_row
  from public.sync_story_domain_debt_v1(
    stale_run,
    array[fixture_story],
    '{}'::uuid[]
  );

  if not result_row.stale then
    raise exception 'Older Story-domain worker was not rejected as stale';
  end if;

  select count(*) into open_domain
  from public.research_debt
  where story_id = fixture_story
    and debt_key = 'story-domain:' || fixture_story::text
    and status = 'open';

  if open_domain <> 0 then
    raise exception 'Stale Story-domain worker reopened resolved quarantine debt';
  end if;
end;
$$;

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
    'contract:story-domain:subset', 'shadow', 'manual', 'regime-projector/3',
    'started', '{}'::jsonb, repeat('1',64), now() + interval '16 hours'
  ) returning id into run_id;

  begin
    perform * from public.sync_story_domain_debt_v1(
      run_id,
      '{}'::uuid[],
      array[fixture_story]
    );
    raise exception 'Story-domain sync accepted an admissible Story outside the evaluated set';
  exception
    when raise_exception then
      if sqlerrm not like 'Admissible Story IDs must be a subset%' then
        raise;
      end if;
  end;
end;
$$;
