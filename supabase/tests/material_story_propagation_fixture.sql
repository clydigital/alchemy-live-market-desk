-- Minimal post-P2 additions required to execute the material propagation repair
-- against the representative MRU fixture.

alter table public.stories
  add column article_verdict text,
  add column next_catalyst text;

create table public.intelligence_engine_runs (
  id uuid primary key default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.intelligence_story_states (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null unique references public.stories(id) on delete cascade,
  last_evaluated_at timestamptz,
  last_material_update_at timestamptz,
  next_catalysts text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.intelligence_story_assessments (
  id uuid primary key default gen_random_uuid(),
  engine_run_id uuid not null references public.intelligence_engine_runs(id) on delete cascade,
  market_belief_stage_run_id uuid not null,
  story_id uuid not null references public.stories(id) on delete cascade,
  disposition text not null,
  rationale text not null,
  evidence_ids uuid[] not null default '{}',
  eligible_evidence_ids uuid[] not null default '{}',
  proposed_updates jsonb not null default '{}'::jsonb,
  selected_at timestamptz not null default now(),
  material_change_applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique(engine_run_id, story_id)
);

create table public.story_updates (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  update_type text not null,
  headline text not null,
  detail text not null,
  observed_at timestamptz not null,
  suppress_event_mirror boolean not null default false
);

create or replace function public.story_maintenance_catalyst_candidate_is_valid(
  p_current_label text,
  p_proposed_label text,
  p_proposed_ref text,
  p_review_context jsonb,
  p_require_due boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from jsonb_array_elements(coalesce(p_review_context -> 'catalystCandidates', '[]'::jsonb)) candidate
    where nullif(btrim(candidate ->> 'label'), '') = nullif(btrim(p_proposed_label), '')
      and nullif(btrim(candidate ->> 'catalystRef'), '')
        is not distinct from nullif(btrim(p_proposed_ref), '')
  ), false);
$$;

create or replace function public.story_maintenance_next_test_for_candidate(
  p_story_id uuid,
  p_candidate_label text,
  p_candidate_ref text,
  p_review_context jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when public.story_maintenance_catalyst_candidate_is_valid(
    null, p_candidate_label, p_candidate_ref, p_review_context, false
  ) then jsonb_build_object(
    'id', 'fixture-next-test',
    'label', p_candidate_label,
    'status', 'upcoming',
    'catalystRef', p_candidate_ref,
    'evidenceIds', '[]'::jsonb,
    'resolutionEvidenceIds', '[]'::jsonb
  ) else null end;
$$;

-- The production function performs the canonical Story mutation. This fixture
-- models only its externally observable assessment result so the repair's
-- evidence filter, wrapper and timestamp trigger execute as a real transaction.
create or replace function public.apply_intelligence_story_assessment(
  p_assessment_id uuid
)
returns table(applied boolean, effective_disposition text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assessment public.intelligence_story_assessments%rowtype;
  material_allowed boolean;
begin
  select * into assessment
  from public.intelligence_story_assessments
  where id = p_assessment_id
  for update;

  if assessment.applied_at is not null then
    return query select false, assessment.disposition;
    return;
  end if;

  material_allowed := assessment.disposition <> 'unchanged'
    and cardinality(assessment.eligible_evidence_ids) > 0;

  update public.intelligence_story_assessments
  set disposition = case when material_allowed then assessment.disposition else 'unchanged' end,
      material_change_applied = material_allowed,
      applied_at = now()
  where id = assessment.id;

  return query select true, case when material_allowed then assessment.disposition else 'unchanged' end;
end;
$$;
