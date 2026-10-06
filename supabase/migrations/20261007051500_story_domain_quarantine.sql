-- Quarantine canonical Story objects that are outside the market-domain contract.
-- Reuses research_debt; no Story thesis or lifecycle mutation occurs.

create or replace function public.sync_story_domain_debt_v1(
  p_projection_run_id uuid,
  p_evaluated_story_ids uuid[],
  p_admissible_story_ids uuid[]
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
  v_evaluated uuid[] := coalesce(p_evaluated_story_ids, '{}'::uuid[]);
  v_admissible uuid[] := coalesce(p_admissible_story_ids, '{}'::uuid[]);
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
    from unnest(v_admissible) admissible(story_id)
    where not (admissible.story_id = any(v_evaluated))
  ) then
    raise exception 'Admissible Story IDs must be a subset of evaluated Story IDs';
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
      and debt.debt_key like 'story-domain:%'
      and debt.metadata ->> 'kind' = 'story_domain_debt';

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
    'story-domain:' || story.id::text,
    case when lower(coalesce(story.status, '')) = 'publish' then 'high' else 'medium' end,
    'open',
    'The canonical Story is outside the current market-domain contract. Its immutable history is preserved, but it is quarantined from Regime routing rather than being force-mapped or falsely invalidated.',
    'Review whether this object belongs in research/operational methodology. Archive or repurpose it only through an explicit governed Story action; do not treat domain quarantine as evidence that the thesis is factually false.',
    now(),
    now() + interval '24 hours',
    jsonb_build_object(
      'kind', 'story_domain_debt',
      'contractVersion', 'story-domain/1',
      'domainStatus', 'quarantined',
      'projectionRunId', p_projection_run_id,
      'storySlug', story.slug,
      'storyStatus', story.status,
      'storyConfidence', story.confidence
    ),
    now()
  from public.stories story
  where story.id = any(v_evaluated)
    and story.status <> 'archived'
    and not (story.id = any(v_admissible))
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
        when debt.story_id = any(v_admissible)
          then 'The Story satisfies the current market-domain contract.'
        else 'The Story is no longer active in the Story-domain review universe.'
      end,
      next_check_at = null,
      metadata = debt.metadata || jsonb_build_object(
        'domainStatus',
        case when debt.story_id = any(v_admissible) then 'admissible' else 'inactive' end,
        'resolvedByProjectionRunId', p_projection_run_id,
        'resolvedAt', now()
      ),
      updated_at = now()
  where debt.status = 'open'
    and debt.debt_key like 'story-domain:%'
    and debt.metadata ->> 'kind' = 'story_domain_debt'
    and (
      debt.story_id = any(v_admissible)
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
    and debt.debt_key like 'story-domain:%'
    and debt.metadata ->> 'kind' = 'story_domain_debt';

  return query select v_active, v_upserted, v_resolved, false;
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
        when exists (
          select 1
          from public.research_debt domain_debt
          where domain_debt.story_id = debt.story_id
            and domain_debt.status = 'open'
            and domain_debt.metadata ->> 'kind' = 'story_domain_debt'
        )
          then 'The Story is quarantined from market Regime routing by the Story-domain contract.'
        else 'The Story is no longer active in the Regime routing universe.'
      end,
      next_check_at = null,
      metadata = debt.metadata || jsonb_build_object(
        'routingStatus',
        case
          when debt.story_id = any(v_routed) then 'routed'
          when exists (
            select 1
            from public.research_debt domain_debt
            where domain_debt.story_id = debt.story_id
              and domain_debt.status = 'open'
              and domain_debt.metadata ->> 'kind' = 'story_domain_debt'
          ) then 'domain_quarantined'
          else 'inactive'
        end,
        'resolvedByProjectionRunId', p_projection_run_id,
        'resolvedAt', now()
      ),
      updated_at = now()
  where debt.status = 'open'
    and debt.debt_key like 'regime-routing:%'
    and debt.metadata ->> 'kind' = 'regime_routing_debt'
    and (
      debt.story_id = any(v_routed)
      or exists (
        select 1
        from public.research_debt domain_debt
        where domain_debt.story_id = debt.story_id
          and domain_debt.status = 'open'
          and domain_debt.metadata ->> 'kind' = 'story_domain_debt'
      )
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

revoke all on function public.sync_story_domain_debt_v1(uuid,uuid[],uuid[])
  from public, anon, authenticated;
revoke all on function public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])
  from public, anon, authenticated;

grant execute on function public.sync_story_domain_debt_v1(uuid,uuid[],uuid[])
  to service_role;
grant execute on function public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[])
  to service_role;

comment on function public.sync_story_domain_debt_v1(uuid,uuid[],uuid[]) is
  'Quarantines out-of-domain active Story objects as governed debt without mutating canonical Story history; stale Regime workers cannot change domain debt.';
comment on function public.sync_regime_routing_debt_v1(uuid,uuid[],uuid[]) is
  'Keeps unrouted market-domain Stories visible as routing debt and resolves routing debt when a Story is routed, archived, or explicitly quarantined from the market routing universe.';
