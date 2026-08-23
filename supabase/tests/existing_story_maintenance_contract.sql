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
    'AI capex remains supportive while funding conditions stay loose, but the demand condition is now narrower.',
    'Fresh evidence narrows the scope of the existing thesis without changing its mechanism.'
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
    null,
    'No replacement thesis was supplied.'
  ) then
    raise exception 'A reframe without proposed thesis must fail closed';
  end if;
end;
$$;

rollback;