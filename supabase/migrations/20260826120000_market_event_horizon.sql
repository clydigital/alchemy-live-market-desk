-- Canonical scheduled/known market events. This is intentionally separate from
-- story_events and research_intake_items: events have stable identity, timing
-- precision, verification state and update history.
create table if not exists public.market_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in (
    'economic_release', 'central_bank_decision', 'central_bank_speech',
    'conference_or_symposium', 'geopolitical_meeting',
    'sanctions_or_policy_deadline', 'energy_policy_meeting',
    'treasury_or_fiscal_event', 'earnings', 'regulatory_or_legal_event',
    'other_verified_market_event'
  )),
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  time_label text,
  time_precision text not null check (time_precision in ('exact', 'date', 'window', 'tbc')),
  status text not null check (status in ('scheduled', 'reported', 'confirmed', 'completed', 'cancelled', 'postponed')),
  verification_state text not null check (verification_state in ('official', 'corroborated', 'reported', 'unverified')),
  participants text[] not null default '{}',
  geography text[] not null default '{}',
  affected_assets text[] not null default '{}',
  linked_story_ids uuid[] not null default '{}',
  linked_story_slugs text[] not null default '{}',
  decisive_variable text not null default '',
  transmission text not null default '',
  expected_stage text,
  expectation text,
  source_name text not null,
  source_url text not null,
  source_record_refs text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_events_start_at_idx on public.market_events(start_at asc nulls last);
create index if not exists market_events_status_idx on public.market_events(status, verification_state);
create index if not exists market_events_story_slugs_idx on public.market_events using gin(linked_story_slugs);
create index if not exists market_events_assets_idx on public.market_events using gin(affected_assets);

alter table public.market_events enable row level security;
revoke all on table public.market_events from anon, authenticated;
grant all on table public.market_events to service_role;

drop trigger if exists market_events_updated_at on public.market_events;
create trigger market_events_updated_at
before update on public.market_events
for each row execute function public.intelligence_set_updated_at();

comment on table public.market_events is
  'Canonical Event Horizon registry for scheduled or known future market-moving events; not a Story event ledger.';
