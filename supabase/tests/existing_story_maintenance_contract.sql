-- Executable PR #2 contract. Run after the Existing-Story maintenance migration.
-- No persistent data is written.

begin;

do $$
declare
  dispositions text[] := array['unchanged','reinforced','weakened','reframed','invalidated'];
  categories text[] := array['title','thesis','marketQuestion','confirmation','invalidation','nextCatalyst'];
  expected jsonb := jsonb_build_object(
    'unchanged', jsonb_build_array('nextCatalyst'),
    'reinforced', jsonb_build_array('confirmation','invalidation','nextCatalyst'),
    'weakened', jsonb_build_array('confirmation','invalidation','nextCatalyst'),
    'reframed', jsonb_build_array('title','thesis','marketQuestion','confirmation','invalidation','nextCatalyst'),
    'invalidated', '[]'::jsonb
  );
  disposition text;
  category text;
  allowed text[];
  expected_allowed boolean;
begin
  foreach disposition in array dispositions loop
    allowed := public.story_maintenance_allowed_fields(disposition);
    foreach category in array categories loop
      expected_allowed := (expected -> disposition) ? category;
      if (category = any(allowed)) is distinct from expected_allowed then
        raise exception 'Mutation matrix mismatch for disposition %, category %', disposition, category;
      end if;
    end loop;
  end loop;

  if public.story_maintenance_allowed_fields('invalidated') <> array[]::text[] then
    raise exception 'Invalidated Story maintenance must not rewrite any of the six maintenance fields';
  end if;
  if not ('nextCatalyst' = any(public.story_maintenance_allowed_fields('unchanged'))) then
    raise exception 'Unchanged must retain the conditional next-catalyst category';
  end if;
  if 'title' = any(public.story_maintenance_allowed_fields('reinforced')) then
    raise exception 'Reinforced must not rewrite title';
  end if;
  if 'thesis' = any(public.story_maintenance_allowed_fields('weakened')) then
    raise exception 'Weakened must not rewrite thesis';
  end if;
end;
$$;

do $$
begin
  if not public.story_maintenance_reframe_is_lightweight(
    'AI capex remains supportive while funding conditions stay loose and demand holds.',
    'AI capex currently remains supportive while funding conditions stay loose and demand holds.',
    'Fresh evidence narrows the time scope of the existing thesis.'
  ) then
    raise exception 'A wording/scope-only reframe should remain eligible';
  end if;

  if public.story_maintenance_reframe_is_lightweight(
    'AI capex remains supportive while funding conditions stay loose and demand holds.',
    'Oil supply disruption is now the main driver of the equity risk premium.',
    'The evidence requires a new causal mechanism and new asset transmission.'
  ) then
    raise exception 'A mechanism-changing reframe must fail closed';
  end if;

  if public.story_maintenance_reframe_is_lightweight(
    'AI capex remains supportive while funding conditions stay loose and demand holds.',
    'AI capex remains supportive while funding conditions stay loose and supply holds.',
    'Fresh evidence narrows the existing setup.'
  ) then
    raise exception 'A supply rather than demand driver swap must fail closed';
  end if;

  if public.story_maintenance_reframe_is_lightweight(
    'Lower rates transmit into easier funding conditions for growth equities.',
    'Lower credit transmits into easier funding conditions for growth equities.',
    'Fresh evidence narrows the existing setup.'
  ) then
    raise exception 'A credit rather than rates transmission swap must fail closed';
  end if;

  if public.story_maintenance_reframe_is_lightweight(
    'AI capex remains supportive while demand holds.',
    'AI capex remains supportive while export licensing becomes the explanation.',
    'The overlooked variable becomes the accepted explanation.'
  ) then
    raise exception 'An overlooked variable becoming the explanation must fail closed';
  end if;

  if public.story_maintenance_reframe_is_lightweight(
    'Lower yields support gold through lower opportunity cost.',
    'Lower yields support equities through higher valuation multiples.',
    'The asset transmission changes while the macro backdrop remains similar.'
  ) then
    raise exception 'An asset transmission change must fail closed';
  end if;

  if public.story_maintenance_reframe_is_lightweight(
    'AI capex remains supportive while funding conditions stay loose and demand holds.',
    null,
    'No replacement thesis was supplied.'
  ) then
    raise exception 'A reframe without proposed thesis must fail closed';
  end if;
end;
$$;

do $$
declare
  review_context jsonb := jsonb_build_object(
    'dueCatalysts', jsonb_build_array('2026-08-23 Earnings call'),
    'catalystCandidates', jsonb_build_array(
      jsonb_build_object('label','2026-08-23 Earnings call','catalystRef',null),
      jsonb_build_object('label','2026-08-28 PCE release','catalystRef','calendar:pce')
    )
  );
begin
  if public.story_maintenance_catalyst_candidate_is_valid(
    '2026-08-24 CPI release', '2026-08-28 PCE release', 'calendar:pce', review_context, true
  ) then
    raise exception 'A not-yet-due catalyst must not roll';
  end if;
  if public.story_maintenance_catalyst_candidate_is_valid(
    '2026-08-23 Earnings call', '2026-08-28 PCE release', 'calendar:cpi', review_context, true
  ) then
    raise exception 'A candidate with the wrong catalystRef must not roll';
  end if;
  if public.story_maintenance_catalyst_candidate_is_valid(
    '2026-08-23 Earnings call', '2026-08-28 PCE release', null, review_context, true
  ) then
    raise exception 'A candidate with a null catalystRef must not match a referenced candidate';
  end if;
  if public.story_maintenance_catalyst_candidate_is_valid(
    '2026-08-23 Earnings call', '2026-09-01 Invented event', null, review_context, true
  ) then
    raise exception 'An invented candidate must not roll';
  end if;
  if public.story_maintenance_catalyst_candidate_is_valid(
    '2026-08-23 Earnings call', null, null, review_context, true
  ) then
    raise exception 'A null proposed label must not roll';
  end if;
  if not public.story_maintenance_catalyst_candidate_is_valid(
    '2026-08-23 Earnings call', '2026-08-28 PCE release', 'calendar:pce', review_context, true
  ) then
    raise exception 'A legitimate due candidate must roll';
  end if;
end;
$$;

do $$
declare
  prior_reasoning jsonb := jsonb_build_object(
    'contractVersion','canonical-story-reasoning/v1',
    'lifecycle','developing',
    'confirmation',jsonb_build_array('Old confirmation'),
    'invalidation',jsonb_build_array('Old invalidation'),
    'nextTest',jsonb_build_object('id','test-1','catalystRef','calendar:pce'),
    'causalChain',jsonb_build_array(jsonb_build_object('id','edge-1','evidenceIds',jsonb_build_array('ev-1'))),
    'assetImplications',jsonb_build_array(jsonb_build_object('asset','SPX','evidenceIds',jsonb_build_array('ev-1'))),
    'countercase',jsonb_build_object('strongest','Countercase','evidenceIds',jsonb_build_array('ev-2')),
    'overlookedVariable',jsonb_build_object('text','Variable','evidenceIds',jsonb_build_array('ev-3')),
    'claims',jsonb_build_array(jsonb_build_object('id','claim-1','evidenceIds',jsonb_build_array('ev-1'))),
    'visualPlan',jsonb_build_array(jsonb_build_object('id','visual-1','edgeIds',jsonb_build_array('edge-1')))
  );
  maintained jsonb;
  component text;
begin
  if public.story_maintenance_reasoning_for_version(
    null,
    jsonb_build_object('lifecycle','confirmed')
  ) is not null then
    raise exception 'Legacy maintenance must leave reasoning absent';
  end if;

  maintained := public.story_maintenance_reasoning_for_version(
    prior_reasoning,
    jsonb_build_object(
      'lifecycle','weakening',
      'confirmation',jsonb_build_array('New confirmation'),
      'invalidation',jsonb_build_array('New invalidation')
    )
  );

  foreach component in array array[
    'causalChain','assetImplications','countercase','overlookedVariable','claims','visualPlan','nextTest'
  ] loop
    if maintained -> component is distinct from prior_reasoning -> component then
      raise exception 'Protected V1 % changed during maintenance', component;
    end if;
  end loop;
  if maintained ->> 'lifecycle' <> 'weakening'
    or maintained -> 'confirmation' <> jsonb_build_array('New confirmation')
    or maintained -> 'invalidation' <> jsonb_build_array('New invalidation') then
    raise exception 'Permitted V1 maintenance projections were not applied';
  end if;

  -- Stable message anchors keep every protected component visible to the
  -- repository-level contract test without duplicating the fixture there.
  perform 'Protected V1 causalChain';
  perform 'Protected V1 assetImplications';
  perform 'Protected V1 countercase';
  perform 'Protected V1 overlookedVariable';
  perform 'Protected V1 claims';
  perform 'Protected V1 visualPlan';
  perform 'Protected V1 nextTest';
end;
$$;

rollback;
