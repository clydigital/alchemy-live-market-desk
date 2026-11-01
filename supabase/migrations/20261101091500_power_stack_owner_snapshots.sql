-- Power Stack owner portfolio is never sourced from public GitHub Pages at runtime.
-- Import via an owner-approved server-side process only after auditing old public URLs.
create table if not exists public.power_stack_owner_snapshots (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_as_of date not null,
  imported_at timestamptz not null default now(),
  legacy_source_retired boolean not null default false,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  primary key (owner_user_id, snapshot_as_of)
);
alter table public.power_stack_owner_snapshots enable row level security;
revoke all on public.power_stack_owner_snapshots from anon, authenticated;
grant select on public.power_stack_owner_snapshots to authenticated;
drop policy if exists power_stack_owner_snapshot_read on public.power_stack_owner_snapshots;
create policy power_stack_owner_snapshot_read
  on public.power_stack_owner_snapshots for select to authenticated
  using (owner_user_id = (select auth.uid()));
-- No INSERT/UPDATE/DELETE permission for authenticated or anon roles.
-- Imports and the legacy_source_retired verification flag require a privileged,
-- audited server process; the flag must not be set before the old origin is secured.
