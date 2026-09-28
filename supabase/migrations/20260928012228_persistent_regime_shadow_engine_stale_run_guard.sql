-- Prevent stale Regime shadow workers from overwriting newer projections.
-- Production migration version: 20260928012228.

create or replace function public.sync_market_regime_story_links_v1(
  p_projection_run_id uuid,
  p_links jsonb
)
returns table(active_count integer, inserted_count integer, expired_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_active integer := 0;
  v_inserted integer := 0;
  v_expired integer := 0;
  v_expected integer := 0;
  v_resolved integer := 0;
  v_run_started_at timestamptz;
  v_latest_link_run_at timestamptz;
begin
  select started_at into v_run_started_at
  from public.market_regime_projection_runs
  where id = p_projection_run_id
    and projection_mode = 'shadow';

  if v_run_started_at is null then
    raise exception 'Unknown or non-shadow Regime projection run %', p_projection_run_id;
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'p_links must be a JSON array';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('market_regime_story_links:shadow', 0));

  select max(run.started_at)
  into v_latest_link_run_at
  from public.market_regime_story_links link
  join public.market_regime_projection_runs run
    on run.id = link.last_projection_run_id
  where link.effective_to is null
    and link.assignment_origin = 'deterministic_runtime';

  if v_latest_link_run_at is not null and v_latest_link_run_at > v_run_started_at then
    select count(*) into v_active
    from public.market_regime_story_links
    where effective_to is null;
    return query select v_active, 0, 0;
    return;
  end if;

  create temporary table tmp_market_regime_links (
    story_id uuid not null,
    regime_id uuid not null,
    subgroup_id uuid not null,
    role text not null,
    confidence numeric(5,2) not null
  ) on commit drop;

  select jsonb_array_length(coalesce(p_links, '[]'::jsonb)) into v_expected;

  insert into tmp_market_regime_links(story_id, regime_id, subgroup_id, role, confidence)
  select
    x.story_id,
    r.id,
    sg.id,
    x.role,
    greatest(0, least(100, x.confidence))
  from jsonb_to_recordset(coalesce(p_links, '[]'::jsonb))
    as x(story_id uuid, regime_slug text, subgroup_key text, role text, confidence numeric)
  join public.stories s on s.id = x.story_id
  join public.market_regimes r on r.slug = x.regime_slug and r.status = 'active'
  join public.market_regime_subgroups sg
    on sg.regime_id = r.id
   and sg.subgroup_key = x.subgroup_key
   and sg.status = 'active'
  where x.role in ('core','supporting','bridge','countercase');

  select count(*) into v_resolved from tmp_market_regime_links;
  if v_resolved <> v_expected then
    raise exception 'Regime Story link resolution mismatch: expected %, resolved %', v_expected, v_resolved;
  end if;

  update public.market_regime_story_links link
  set effective_to = now(),
      last_projection_run_id = p_projection_run_id,
      metadata = link.metadata || jsonb_build_object('expiredByProjectionRunId', p_projection_run_id),
      updated_at = now()
  where link.effective_to is null
    and link.assignment_origin = 'deterministic_runtime'
    and not link.locked
    and not exists (
      select 1
      from tmp_market_regime_links desired
      where desired.story_id = link.story_id
        and desired.regime_id = link.regime_id
        and desired.subgroup_id = link.subgroup_id
        and desired.role = link.role
    );
  get diagnostics v_expired = row_count;

  update public.market_regime_story_links link
  set confidence = desired.confidence,
      last_projection_run_id = p_projection_run_id,
      updated_at = now()
  from tmp_market_regime_links desired
  where link.effective_to is null
    and link.story_id = desired.story_id
    and link.regime_id = desired.regime_id
    and link.subgroup_id = desired.subgroup_id
    and link.role = desired.role;

  insert into public.market_regime_story_links(
    regime_id, subgroup_id, story_id, role, confidence,
    assignment_origin, last_projection_run_id, effective_from, metadata
  )
  select
    desired.regime_id,
    desired.subgroup_id,
    desired.story_id,
    desired.role,
    desired.confidence,
    'deterministic_runtime',
    p_projection_run_id,
    now(),
    jsonb_build_object('origin','regime-projector/1')
  from tmp_market_regime_links desired
  where not exists (
    select 1
    from public.market_regime_story_links link
    where link.effective_to is null
      and link.story_id = desired.story_id
      and link.regime_id = desired.regime_id
      and link.subgroup_id = desired.subgroup_id
      and link.role = desired.role
  );
  get diagnostics v_inserted = row_count;

  select count(*) into v_active
  from public.market_regime_story_links
  where effective_to is null;

  return query select v_active, v_inserted, v_expired;
end;
$$;

create or replace function public.persist_market_regime_projection_v1(
  p_projection_run_id uuid,
  p_regime_slug text,
  p_snapshot jsonb,
  p_snapshot_hash text,
  p_input_manifest jsonb,
  p_as_of timestamptz,
  p_state text,
  p_state_kind text,
  p_confidence_label text,
  p_materiality_reason text
)
returns table(version_id uuid, version_number integer, created boolean)
language plpgsql
set search_path = public
as $$
declare
  v_regime_id uuid;
  v_run_mode text;
  v_run_started_at timestamptz;
  v_existing_id uuid;
  v_existing_number integer;
  v_current public.market_regime_current%rowtype;
  v_current_run_started_at timestamptz;
  v_new_id uuid;
  v_new_number integer;
  v_reason text;
begin
  select projection_mode, started_at
  into v_run_mode, v_run_started_at
  from public.market_regime_projection_runs
  where id = p_projection_run_id;

  if v_run_mode is null then
    raise exception 'Unknown Regime projection run %', p_projection_run_id;
  end if;
  if v_run_mode <> 'shadow' then
    raise exception 'persist_market_regime_projection_v1 only accepts shadow runs';
  end if;
  if p_state_kind not in ('system1','interpreted','unresolved') then
    raise exception 'Invalid Regime state_kind %', p_state_kind;
  end if;
  if coalesce(length(trim(p_snapshot_hash)),0) < 16 then
    raise exception 'Regime snapshot hash is missing or too short';
  end if;

  select id into v_regime_id
  from public.market_regimes
  where slug = p_regime_slug and status = 'active';

  if v_regime_id is null then
    raise exception 'Unknown active Regime %', p_regime_slug;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_regime_slug || ':shadow', 0));

  select id, market_regime_versions.version_number
  into v_existing_id, v_existing_number
  from public.market_regime_versions
  where projection_run_id = p_projection_run_id
    and regime_id = v_regime_id
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, v_existing_number, false;
    return;
  end if;

  select *
  into v_current
  from public.market_regime_current
  where regime_id = v_regime_id
    and projection_mode = 'shadow'
  for update;

  if v_current.regime_id is not null then
    select started_at into v_current_run_started_at
    from public.market_regime_projection_runs
    where id = v_current.projection_run_id;

    if v_current_run_started_at is not null and v_current_run_started_at > v_run_started_at then
      select market_regime_versions.version_number
      into v_existing_number
      from public.market_regime_versions
      where id = v_current.version_id;

      return query select v_current.version_id, v_existing_number, false;
      return;
    end if;
  end if;

  if v_current.regime_id is not null and v_current.snapshot_hash = p_snapshot_hash then
    update public.market_regime_current
    set projection_run_id = p_projection_run_id,
        state = p_state,
        state_kind = p_state_kind,
        confidence_label = p_confidence_label,
        as_of = p_as_of,
        input_manifest = coalesce(p_input_manifest, '{}'::jsonb),
        snapshot = p_snapshot,
        updated_at = now()
    where regime_id = v_regime_id
      and projection_mode = 'shadow';

    select market_regime_versions.version_number
    into v_existing_number
    from public.market_regime_versions
    where id = v_current.version_id;

    return query select v_current.version_id, v_existing_number, false;
    return;
  end if;

  select coalesce(max(market_regime_versions.version_number), 0) + 1
  into v_new_number
  from public.market_regime_versions
  where regime_id = v_regime_id
    and projection_mode = 'shadow';

  v_reason := case
    when v_new_number = 1 then 'bootstrap_current_state'
    else coalesce(nullif(trim(p_materiality_reason),''),'shadow_change')
  end;

  insert into public.market_regime_versions(
    regime_id,
    projection_run_id,
    version_number,
    projection_mode,
    state,
    state_kind,
    confidence_label,
    as_of,
    input_manifest,
    snapshot,
    snapshot_hash,
    materiality_reason,
    supersedes_version_id
  ) values (
    v_regime_id,
    p_projection_run_id,
    v_new_number,
    'shadow',
    p_state,
    p_state_kind,
    p_confidence_label,
    p_as_of,
    coalesce(p_input_manifest, '{}'::jsonb),
    p_snapshot,
    p_snapshot_hash,
    v_reason,
    case when v_current.regime_id is null then null else v_current.version_id end
  )
  returning id into v_new_id;

  insert into public.market_regime_current(
    regime_id,
    projection_mode,
    version_id,
    projection_run_id,
    state,
    state_kind,
    confidence_label,
    as_of,
    input_manifest,
    snapshot,
    snapshot_hash,
    updated_at
  ) values (
    v_regime_id,
    'shadow',
    v_new_id,
    p_projection_run_id,
    p_state,
    p_state_kind,
    p_confidence_label,
    p_as_of,
    coalesce(p_input_manifest, '{}'::jsonb),
    p_snapshot,
    p_snapshot_hash,
    now()
  )
  on conflict (regime_id, projection_mode)
  do update set
    version_id = excluded.version_id,
    projection_run_id = excluded.projection_run_id,
    state = excluded.state,
    state_kind = excluded.state_kind,
    confidence_label = excluded.confidence_label,
    as_of = excluded.as_of,
    input_manifest = excluded.input_manifest,
    snapshot = excluded.snapshot,
    snapshot_hash = excluded.snapshot_hash,
    updated_at = excluded.updated_at;

  return query select v_new_id, v_new_number, true;
end;
$$;

revoke all on function public.sync_market_regime_story_links_v1(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.persist_market_regime_projection_v1(uuid,text,jsonb,text,jsonb,timestamptz,text,text,text,text) from public, anon, authenticated;
grant execute on function public.sync_market_regime_story_links_v1(uuid,jsonb) to service_role;
grant execute on function public.persist_market_regime_projection_v1(uuid,text,jsonb,text,jsonb,timestamptz,text,text,text,text) to service_role;
