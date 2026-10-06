-- The production database already has this helper from the full intelligence history.
-- The representative DB-contract fixture does not apply that entire history, so
-- recreate only this historical dependency before the Regime migration.

create or replace function public.intelligence_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- research_debt predates the Regime subsystem in production. The compact CI
-- fixture does not replay that full intelligence history, so reproduce the
-- production contract needed by Regime routing-debt synchronisation.
create table if not exists public.research_debt (
  id uuid primary key default extensions.gen_random_uuid(),
  story_id uuid references public.stories(id) on delete cascade,
  requirement_id uuid,
  research_run_id uuid,
  debt_key text not null,
  severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','resolved','waived')),
  reason text not null,
  next_action text,
  opened_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  next_check_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists research_debt_open_key_idx
  on public.research_debt(debt_key)
  where status = 'open';

create index if not exists research_debt_story_due_idx
  on public.research_debt(story_id, status, severity, next_check_at)
  where story_id is not null and status = 'open';
