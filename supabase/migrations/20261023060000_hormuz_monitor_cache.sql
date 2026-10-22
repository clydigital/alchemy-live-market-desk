-- Operational source cache only. Never canonical research evidence.
create table public.hormuz_monitor_cache (
  id text primary key check (id = 'crossings-v1'),
  snapshot jsonb,
  next_attempt_at timestamptz not null default '-infinity',
  lease_id uuid,
  refresh_failed boolean not null default false
);
alter table public.hormuz_monitor_cache enable row level security;
revoke all on public.hormuz_monitor_cache from public, anon, authenticated;
grant select, update on public.hormuz_monitor_cache to service_role;
insert into public.hormuz_monitor_cache (id) values ('crossings-v1');

-- One atomic lease across server instances, deployments and manual requests.
-- Failed requests also consume the interval; no force-refresh bypass.
create function public.claim_hormuz_refresh() returns uuid
language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
  update public.hormuz_monitor_cache
  set next_attempt_at = clock_timestamp() + interval '30 minutes',
      lease_id = gen_random_uuid()
  where id = 'crossings-v1' and next_attempt_at <= clock_timestamp()
  returning lease_id into claimed;
  return claimed;
end;
$$;
revoke all on function public.claim_hormuz_refresh() from public, anon, authenticated;
grant execute on function public.claim_hormuz_refresh() to service_role;

create function public.finish_hormuz_refresh(claim uuid, payload jsonb, failed boolean) returns void
language sql security definer set search_path = '' as $$
  update public.hormuz_monitor_cache
  set snapshot = case when failed then snapshot else payload end,
      refresh_failed = failed,
      next_attempt_at = greatest(next_attempt_at, clock_timestamp() + interval '30 minutes')
  where id = 'crossings-v1' and lease_id = claim;
$$;
revoke all on function public.finish_hormuz_refresh(uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.finish_hormuz_refresh(uuid,jsonb,boolean) to service_role;
