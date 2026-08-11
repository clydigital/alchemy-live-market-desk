-- Complete the reusable divergence -> competing hypotheses -> Challenger ->
-- asset scenarios -> original Story vertical slice without replacing legacy
-- Story/UI tables.

alter table public.intelligence_engine_runs
  add column if not exists run_key text;

create unique index if not exists intelligence_engine_runs_run_key_idx
  on public.intelligence_engine_runs(run_key)
  where run_key is not null;

alter table public.intelligence_hypotheses
  add column if not exists question text,
  add column if not exists market_belief text,
  add column if not exists divergence_summary text,
  add column if not exists evidence_for_ids uuid[] not null default '{}',
  add column if not exists evidence_against_ids uuid[] not null default '{}',
  add column if not exists causal_chain jsonb not null default '[]'::jsonb,
  add column if not exists decision_state text not null default 'watch';

alter table public.intelligence_hypotheses
  drop constraint if exists intelligence_hypotheses_decision_state_check;
alter table public.intelligence_hypotheses
  add constraint intelligence_hypotheses_decision_state_check
  check (decision_state in ('publish', 'watch', 'dormant', 'rejected'));

alter table public.intelligence_challenger_assessments
  drop constraint if exists intelligence_challenger_assessments_verdict_check;
alter table public.intelligence_challenger_assessments
  add constraint intelligence_challenger_assessments_verdict_check
  check (verdict in ('promote', 'downgrade', 'watch', 'reject'));

alter table public.intelligence_challenger_assessments
  add column if not exists weakest_link text,
  add column if not exists conflicting_evidence_ids uuid[] not null default '{}',
  add column if not exists pricing_confirmation text,
  add column if not exists cross_asset_confirmation text,
  add column if not exists timing_risk text,
  add column if not exists next_resolving_evidence text,
  add column if not exists confidence_adjustment numeric(6,3) not null default 0
    check (confidence_adjustment between -100 and 100);

create table if not exists public.intelligence_scenarios (
  id uuid primary key default gen_random_uuid(),
  engine_run_id uuid not null references public.intelligence_engine_runs(id) on delete cascade,
  hypothesis_id uuid not null references public.intelligence_hypotheses(id) on delete cascade,
  asset text not null,
  bias text not null check (bias in (
    'bullish', 'slightly_bullish', 'neutral', 'slightly_bearish', 'bearish', 'unscored'
  )),
  conviction numeric(5,2) check (conviction is null or conviction between 0 and 100),
  base_case jsonb not null,
  bull_case jsonb not null,
  bear_case jsonb not null,
  tail_case jsonb,
  confirmation text not null,
  invalidation text not null,
  explanatory_evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(engine_run_id, hypothesis_id, asset),
  check (
    (bias = 'unscored' and conviction is null)
    or (bias <> 'unscored' and conviction is not null)
  )
);

create index if not exists intelligence_scenarios_hypothesis_idx
  on public.intelligence_scenarios(hypothesis_id, created_at desc);

alter table public.intelligence_scenarios enable row level security;
revoke all on table public.intelligence_scenarios from anon, authenticated;
grant all on table public.intelligence_scenarios to service_role;

drop trigger if exists intelligence_scenarios_updated_at on public.intelligence_scenarios;
create trigger intelligence_scenarios_updated_at
before update on public.intelligence_scenarios
for each row execute function public.intelligence_set_updated_at();

alter table public.intelligence_story_candidates
  add column if not exists question text,
  add column if not exists market_belief text,
  add column if not exists divergence_summary text,
  add column if not exists bias text,
  add column if not exists conviction numeric(5,2),
  add column if not exists base_case text,
  add column if not exists bull_case text,
  add column if not exists bear_case text,
  add column if not exists tail_case text,
  add column if not exists strongest_support text,
  add column if not exists strongest_contradiction text,
  add column if not exists novelty_rationale text;

alter table public.intelligence_story_candidates
  drop constraint if exists intelligence_story_candidates_bias_check;
alter table public.intelligence_story_candidates
  add constraint intelligence_story_candidates_bias_check
  check (bias is null or bias in (
    'bullish', 'slightly_bullish', 'neutral', 'slightly_bearish', 'bearish', 'unscored'
  ));
alter table public.intelligence_story_candidates
  drop constraint if exists intelligence_story_candidates_conviction_check;
alter table public.intelligence_story_candidates
  add constraint intelligence_story_candidates_conviction_check
  check (conviction is null or conviction between 0 and 100);

alter table public.intelligence_story_states
  add column if not exists bias text,
  add column if not exists conviction numeric(5,2),
  add column if not exists base_case text,
  add column if not exists bull_case text,
  add column if not exists bear_case text,
  add column if not exists tail_case text,
  add column if not exists market_belief text,
  add column if not exists divergence_summary text,
  add column if not exists strongest_support text,
  add column if not exists strongest_contradiction text;

alter table public.intelligence_story_states
  drop constraint if exists intelligence_story_states_bias_check;
alter table public.intelligence_story_states
  add constraint intelligence_story_states_bias_check
  check (bias is null or bias in (
    'bullish', 'slightly_bullish', 'neutral', 'slightly_bearish', 'bearish', 'unscored'
  ));
alter table public.intelligence_story_states
  drop constraint if exists intelligence_story_states_conviction_check;
alter table public.intelligence_story_states
  add constraint intelligence_story_states_conviction_check
  check (conviction is null or conviction between 0 and 100);

alter table public.stories
  add column if not exists created_by text not null default 'human_or_legacy';

alter table public.stories
  drop constraint if exists stories_created_by_check;
alter table public.stories
  add constraint stories_created_by_check
  check (created_by in ('human_or_legacy', 'alchemy_research_engine'));

update public.intelligence_prompt_versions
set is_active = false, retired_at = coalesce(retired_at, now())
where stage_key in ('hypothesis', 'challenger', 'story_synthesis')
  and is_active;

insert into public.intelligence_prompt_versions (
  stage_key, version, prompt_text, output_schema, model_hint, is_active
)
values
  ('hypothesis', 2, 'Generate genuinely competing causal hypotheses with labelled causal links, supporting and conflicting evidence, confirmation, invalidation and next resolving evidence.', '{}'::jsonb, 'gpt-5-mini', true),
  ('challenger', 2, 'Audit pricing, cross-assets, positioning, fundamentals, causal-chain activity, weakest link, timing risk and resolving evidence without inventing counterevidence.', '{}'::jsonb, 'gpt-5-mini', true),
  ('scenario', 1, 'Create asset-specific base, bull, bear and optional tail scenarios. Use unscored and null conviction when evidence is insufficient.', '{}'::jsonb, 'gpt-5-mini', true),
  ('story_synthesis', 2, 'Create an original Alchemy Story from a promoted hypothesis and its scenarios. External canonical article URL is optional.', '{}'::jsonb, 'gpt-5-mini', true)
on conflict (stage_key, version) do update
set prompt_text = excluded.prompt_text,
    output_schema = excluded.output_schema,
    model_hint = excluded.model_hint,
    is_active = excluded.is_active,
    retired_at = null;

comment on table public.intelligence_scenarios is
  'Asset-specific scenario and bias output generated only for promoted hypotheses.';
comment on column public.stories.created_by is
  'Identifies original Alchemy research-engine Stories without requiring an external canonical article.';
