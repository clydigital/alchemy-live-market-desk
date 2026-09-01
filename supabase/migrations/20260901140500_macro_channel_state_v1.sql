-- Additive Power-Stack-inspired macro state layer.
-- Raw provider/source captures remain intact. This layer records independent
-- channel freshness so one failed or stale provider cannot freeze unrelated macro state.

create table if not exists public.macro_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.research_runs(id) on delete set null,
  parent_snapshot_id uuid references public.macro_state_snapshots(id) on delete set null,
  contract_version text not null default 'macro-state-snapshot/v1',
  methodology_version text not null default 'macro-channel-state/v1',
  generated_at timestamptz not null,
  health text not null,
  fresh_channel_count integer not null default 0,
  stale_channel_count integer not null default 0,
  unavailable_channel_count integer not null default 0,
  source_summary text,
  diagnostics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint macro_state_snapshots_health_check check (health in ('healthy','degraded','stale')),
  constraint macro_state_snapshots_counts_check check (
    fresh_channel_count >= 0 and stale_channel_count >= 0 and unavailable_channel_count >= 0
  )
);

create index if not exists macro_state_snapshots_generated_idx
  on public.macro_state_snapshots(generated_at desc);
create index if not exists macro_state_snapshots_run_idx
  on public.macro_state_snapshots(research_run_id, generated_at desc);

create table if not exists public.macro_channel_states (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.macro_state_snapshots(id) on delete cascade,
  channel_key text not null,
  label text not null,
  direction_score numeric,
  active_direction_score numeric not null default 0,
  confidence numeric not null default 0,
  regime text not null,
  observed_at timestamptz,
  stale_after_hours integer not null,
  freshness text not null,
  usable_for_reasoning boolean not null default false,
  interpretation text not null,
  positive_meaning text not null,
  negative_meaning text not null,
  evidence_refs text[] not null default '{}',
  source_refs jsonb not null default '[]'::jsonb,
  unavailable_reason text,
  created_at timestamptz not null default now(),
  constraint macro_channel_states_snapshot_channel_unique unique(snapshot_id, channel_key),
  constraint macro_channel_states_direction_check check (direction_score is null or direction_score between -2 and 2),
  constraint macro_channel_states_active_direction_check check (active_direction_score between -2 and 2),
  constraint macro_channel_states_confidence_check check (confidence between 0 and 1),
  constraint macro_channel_states_stale_after_check check (stale_after_hours > 0),
  constraint macro_channel_states_freshness_check check (freshness in ('fresh','stale','unavailable')),
  constraint macro_channel_states_reasoning_check check (
    usable_for_reasoning = false
    or (freshness = 'fresh' and direction_score is not null and cardinality(evidence_refs) > 0)
  )
);

create index if not exists macro_channel_states_key_snapshot_idx
  on public.macro_channel_states(channel_key, snapshot_id);
create index if not exists macro_channel_states_freshness_idx
  on public.macro_channel_states(freshness, usable_for_reasoning);

alter table public.macro_state_snapshots enable row level security;
alter table public.macro_channel_states enable row level security;

-- No public write policy is added. Existing server-side admin/service-role code is
-- expected to persist canonical state, consistent with the rest of Live's research runtime.
