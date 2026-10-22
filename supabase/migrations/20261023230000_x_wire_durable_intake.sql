-- Operational X discovery ledger only. No Story/Evidence or research-run writer.
-- Private service-role ingress, fail closed for public API identities.
create table if not exists public.x_wire_accounts (
  handle text primary key check (handle ~ '^[A-Za-z0-9_]{1,15}$'),
  last_attempt_at timestamptz,
  last_completed_at timestamptz,
  last_observed_post_at timestamptz,
  uncovered_before timestamptz,
  window_start_at timestamptz,
  page_cursor text,
  next_attempt_at timestamptz not null default '-infinity'::timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  health text not null default 'unconfigured'
    check (health in ('unconfigured','healthy','partial','blocked','unavailable')),
  last_error text,
  last_fetched integer not null default 0 check (last_fetched >= 0),
  updated_at timestamptz not null default now(),
  check (length(coalesce(page_cursor,'')) <= 2048)
);

create table if not exists public.x_wire_posts (
  post_id text primary key check (post_id ~ '^[0-9]{6,25}$'),
  handle text not null references public.x_wire_accounts(handle),
  original_url text not null unique,
  published_at timestamptz not null,
  retrieved_at timestamptz not null,
  body text not null check (char_length(body) between 1 and 2000),
  quote_url text,
  media_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(media_urls)='array'),
  intake_status text not null default 'discovery'
    check (intake_status in ('discovery','deferred','reviewed','rejected')),
  original_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists x_wire_posts_published_at_idx on public.x_wire_posts(published_at desc);
create index if not exists x_wire_posts_handle_published_idx on public.x_wire_posts(handle,published_at desc);
create index if not exists x_wire_posts_status_idx on public.x_wire_posts(intake_status,published_at desc);

alter table public.x_wire_accounts enable row level security;
alter table public.x_wire_posts enable row level security;
revoke all on table public.x_wire_accounts,public.x_wire_posts from public,anon,authenticated;
grant select,insert,update on table public.x_wire_accounts,public.x_wire_posts to service_role;

insert into public.x_wire_accounts(handle)
values ('Bluekurtic'),('HFI_Research'),('OilandEnergy'),('TheStudyofWar'),
  ('Currentreport1'),('arena'),('KobeissiLetter'),('FirstSquawk'),('zerohedge'),('GordianKnotDev')
on conflict (handle) do nothing;

-- Atomic source ownership for overlapping manual/owner requests, no new cron.
-- SECURITY INVOKER: the service role is required; never expose to anon/authenticated.
create or replace function public.claim_x_wire_account(p_handle text)
returns table (
  claimed_token uuid, checkpoint_at timestamptz,
  resume_cursor text, resume_start_at timestamptz
)
language sql security invoker set search_path = ''
as $$
  update public.x_wire_accounts a
  set lease_token=gen_random_uuid(),
      lease_expires_at=now()+interval '100 seconds',
      last_attempt_at=now(),
      updated_at=now()
  where a.handle=p_handle
    and a.next_attempt_at <= now()
    and (a.lease_expires_at is null or a.lease_expires_at < now())
  returning a.lease_token, a.last_completed_at, a.page_cursor, a.window_start_at;
$$;
revoke all on function public.claim_x_wire_account(text) from public,anon,authenticated;
grant execute on function public.claim_x_wire_account(text) to service_role;

comment on table public.x_wire_accounts is
  'Private X source checkpoints and leased pagination. Operational intake only, no canonical evidence authority.';
comment on table public.x_wire_posts is
  'Persisted attributed third-party X discovery leads, never automatically admitted as canonical facts.';
