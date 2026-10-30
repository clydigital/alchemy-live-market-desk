-- 30 October 2026 owner directive: restore @zerohedge and monitor @TGLetter.
-- Previous source exclusions remain immutable migration history. Do not revive historical rejected posts.
insert into public.x_wire_accounts(handle,health,next_attempt_at)
values ('zerohedge','unconfigured','-infinity'::timestamptz),
       ('TGLetter','unconfigured','-infinity'::timestamptz)
on conflict (handle) do nothing;

update public.x_wire_accounts
set next_attempt_at = '-infinity'::timestamptz,
    page_cursor = null, window_start_at = null,
    lease_token = null, lease_expires_at = null,
    health = 'unconfigured', last_error = null, updated_at = now()
where lower(handle) = 'zerohedge'
  and last_error = 'Explicitly excluded from X Wire source collection';

-- Keep @GordianKnotDev's later owner-requested exclusion for every service-role caller.
create or replace function public.claim_x_wire_account(p_handle text)
returns table (
  claimed_token uuid, checkpoint_at timestamptz,
  resume_cursor text, resume_start_at timestamptz
)
language sql security invoker set search_path = ''
as $$
  update public.x_wire_accounts a
  set lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '100 seconds',
      last_attempt_at = now(),
      updated_at = now()
  where a.handle = p_handle
    and lower(a.handle) <> 'gordianknotdev'
    and a.next_attempt_at <= now()
    and (a.lease_expires_at is null or a.lease_expires_at < now())
  returning a.lease_token, a.last_completed_at, a.page_cursor, a.window_start_at;
$$;
revoke all on function public.claim_x_wire_account(text) from public,anon,authenticated;
grant execute on function public.claim_x_wire_account(text) to service_role;
