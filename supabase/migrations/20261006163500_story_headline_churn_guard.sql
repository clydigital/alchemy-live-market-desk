-- Story headline churn hardening.
-- A visible Story headline may change only when the same immutable thesis version
-- carries a material analytical change. Persist the exact before/after headline
-- and authorising version inside the existing version snapshot; do not create a
-- parallel headline/history store.

create or replace function public.story_headline_material_signature_v1(
  p_version public.story_thesis_versions
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'thesis', p_version.thesis,
    'marketQuestion', p_version.market_question,
    'acceptedExplanation', coalesce(
      p_version.snapshot #>> '{reasoning,acceptedExplanation}',
      p_version.snapshot #>> '{canonicalStoryReasoning,acceptedExplanation}',
      p_version.best_explanation
    ),
    'dominantNarrative', p_version.dominant_narrative,
    'publicStatus', p_version.status,
    'lifecycle', coalesce(
      p_version.snapshot #>> '{reasoning,lifecycle}',
      p_version.snapshot #>> '{canonicalStoryReasoning,lifecycle}'
    ),
    'currentState', coalesce(
      p_version.snapshot #>> '{reasoning,currentState}',
      p_version.snapshot #>> '{canonicalStoryReasoning,currentState}'
    ),
    'causalChain', coalesce(
      p_version.snapshot #> '{reasoning,causalChain}',
      p_version.snapshot #> '{canonicalStoryReasoning,causalChain}',
      'null'::jsonb
    ),
    'confirmation', coalesce(
      p_version.snapshot #> '{reasoning,confirmation}',
      p_version.snapshot #> '{canonicalStoryReasoning,confirmation}',
      to_jsonb(p_version.confirmation_trigger)
    ),
    'invalidation', coalesce(
      p_version.snapshot #> '{reasoning,invalidation}',
      p_version.snapshot #> '{canonicalStoryReasoning,invalidation}',
      to_jsonb(p_version.invalidation_trigger)
    ),
    'nextTest', coalesce(
      p_version.snapshot #> '{reasoning,nextTest}',
      p_version.snapshot #> '{canonicalStoryReasoning,nextTest}',
      to_jsonb(p_version.next_catalyst)
    )
  );
$$;

create or replace function public.enforce_story_headline_change_contract_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  prior public.story_thesis_versions%rowtype;
  prior_signature jsonb;
  next_signature jsonb;
  headline_reason text;
begin
  select version.*
  into prior
  from public.story_thesis_versions version
  where version.story_id = new.story_id
    and version.version_number < new.version_number
  order by version.version_number desc, version.effective_at desc, version.created_at desc
  limit 1;

  if prior.id is null or new.title is not distinct from prior.title then
    return new;
  end if;

  prior_signature := public.story_headline_material_signature_v1(prior);
  next_signature := public.story_headline_material_signature_v1(new);

  if next_signature is not distinct from prior_signature then
    raise exception using
      errcode = '23514',
      message = 'Story headline change requires a material thesis-version change';
  end if;

  headline_reason := coalesce(
    nullif(btrim(new.snapshot #>> '{maintenanceContext,rationale}'), ''),
    nullif(btrim(new.change_reason), ''),
    'material_story_version_change'
  );

  new.snapshot := coalesce(new.snapshot, '{}'::jsonb) || jsonb_build_object(
    'headlineChange',
    jsonb_build_object(
      'contractVersion', 'story-headline-change/v1',
      'priorHeadline', prior.title,
      'newHeadline', new.title,
      'reason', headline_reason,
      'authorizingStoryThesisVersionId', new.id,
      'priorStoryThesisVersionId', prior.id
    )
  );

  return new;
end;
$$;

drop trigger if exists story_thesis_versions_headline_change_guard
  on public.story_thesis_versions;

create trigger story_thesis_versions_headline_change_guard
before insert on public.story_thesis_versions
for each row execute function public.enforce_story_headline_change_contract_v1();

revoke all on function public.story_headline_material_signature_v1(public.story_thesis_versions)
  from public, anon, authenticated;
revoke all on function public.enforce_story_headline_change_contract_v1()
  from public, anon, authenticated;

grant execute on function public.story_headline_material_signature_v1(public.story_thesis_versions)
  to service_role;

comment on function public.enforce_story_headline_change_contract_v1() is
  'Prevents headline-only Story thesis versions and records auditable before/after headline metadata on the existing immutable story_thesis_versions path.';
