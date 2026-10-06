-- Make unrouted Stories explicit and make zero-link Regime projections stale-safe.
-- Reuses research_debt and the existing shadow projection/link path.

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
  v_latest_shadow_run_at timestamptz;
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

  -- Ownership belongs to the newest shadow run even when it legitimately
  -- projects zero Story links. Looking only at currently-active links lets a
  -- late older worker resurrect links after a newer zero-link projection.
  select max(run.started_at)
  into v_latest_shadow_run_at
  from public.market_regime_projection_runs run
  where run.projection_mode = 'shadow';

  if v_latest_shadow_run_at is not null and v_latest_shadow_run_at > v_run_started_at then
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

create or replace function public.sync_regime_routing_debt_v1(
  p_projection_run_id uuid,
  p_considered_story_ids uuid[],
  p_routed_story_ids uuid[]
)
returns table(
  active_count integer,
  upserted_count integer,
  resolved_count integer,
  stale boolean
)
language plpgsql
set search_path = public
as $$
declare
  v_run_started_at timestamptz;
  v_latest_shadow_run_at timestamptz;
  v_active integer := 0;
  v_upserted integer := 0;
  v_resolved integer := 0;
  v_considered uuid[] := coalesce(p_considered_story_ids, '{}'::uuid[]);
  v_routed uuid[] := coalesce(p_routed_story_ids, '{}'::uuid[]);
begin
  select started_at into v_run_started_at
  from public.market_regime_projection_runs
  where id = p_projection_run_id
    and projection_mode = 'shadow';

  if v_run_started_at is null then
    raise exception 'Unknown or non-shadow Regime projection run %', p_projection_run_id;
  end if;

  if exists (
    select 1
    from unnest(v_routed) routed(story_id)
    where not (routed.story_id = any(v_considered))
  ) then
    raise exception 'Routed Story IDs must be a subset of considered Story IDs';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('market_regime_story_links:shadow', 0));

  select max(run.started_at)
  into v_latest_shadow_run_at
  from public.market_regime_projection_runs run
  where run.projection_mode = 'shadow';

  if v_latest_shadow_run_at is not null and v_latest_shadow_run_at > v_run_started_at then
    select count(*) into v_active
    from public.research_debt debt
    where debt.status = 'open'
      and debt.debt_key like 'regime-routing:%'
      and debt.metadata ->> 'kind' = 'regime_routing_debt';

    return query select v_active, 0, 0, true;
    return;
  end if;

  insert into public.research_debt(
    story_id,
    debt_key,
    severity,
    status,
    reason,
    next_action,
    last_attempt_at,
    next_check_at,
    metadata,
    updated_at
  )
  select
    story.id,
    'regime-routing:' || story.id::text,
    case when lower(coalesce(story.status, '')) = 'publish' then 'high' else 'medium' end,
    'open',
    'No governed Regime route cleared the current deterministic routing contract. The Story remains visible but unassigned; no weak mapping was forced.',
    'Review the Story causal question against the active Regime taxonomy. Add or approve a route only when the mechanism is sufficiently supported.',
    now(),
    now() + interval '24 hours',
    jsonb_build_object(
      'kind', 'regime_routing_debt',
      'contractVersion', 'regime-routing-debt/1',
      'routingStatus', 'unassigned',
      'projectionRunId', p_projection_run_id,
      'storySlug', story.slug,
      'storyStatus', story.status,
      'storyConfidence', story.confidence
    ),
    now()
  from public.stories story
  where story.id = any(v_considered)
    and story.status <> 'archived'
    and not (story.id = any(v_routed))
  on conflict (debt_key) where status = 'open'
  do update set
    story_id = excluded.story_id,
    severity = excluded.severity,
    reason = excluded.reason,
    next_action = excluded.next_action,
    last_attempt_at = excluded.last_attempt_at,
    next_check_at = excluded.next_check_at,
    metadata = excluded.metadata,
    updated_at = excluded.updated_at;
  get diagnostics v_upserted = row_count;

  update public.research_debt debt
  set status = 'resolved',
      resolved_at = now(),
      resolution_note = case
        when debt.story_id = any(v_routed)
          then 'A governed Regime route was restored by projection ' || p_projection_run_id::text || '.'
        else 'The Story is no longer active in the Regime routing universe.'
      end,
      next_check_at = null,
      updated_at = now()
  where debt.status = 'open'
    and debt.debt_key like 'regime-routing:%'
    and debt.metadata ->> 'kind' = 'regime_routing_debt'
    and (
      debt.story_id = any(v_routed)
      or exists (
        select 1
        from public.stories story
        where story.id = debt.story_id
          and story.status = 'archived'
      )
    );
  get diagnostics v_resolved = row_count;

  select count(*) into v_active
  from public.research_debt debt
  where debt.status = 'open'
    and debt.debt_key like 'regime-routing:%'
    and debt.metadata ->> 'kind' = 'regime_routing_debt';

  return query select v_active, v_upserted, v_resolved, false;
end;
$$;

revoke all on function public.sync_market_regime_story_links_v1(uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])
  from public, anon, authenticated;

grant execute on function public.sync_market_regime_story_links_v1(uuid,jsonb)
  to service_role;
grant execute on function public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])
  to service_role;

comment on function public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[]) is
  'Keeps unrouted active Stories visible as governed research debt and resolves that debt when routing is restored; stale shadow workers cannot change routing debt.';
