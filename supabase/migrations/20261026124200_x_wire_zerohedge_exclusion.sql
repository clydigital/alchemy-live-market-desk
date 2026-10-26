-- Source-specific X Wire exclusion requested 26 October 2026.
-- Preserve historical rows for audit; do not affect other ZeroHedge research feeds.
update public.x_wire_posts
set intake_status = 'rejected', original_verified = false
where lower(handle) = 'zerohedge';

update public.x_wire_accounts
set next_attempt_at = 'infinity'::timestamptz,
    page_cursor = null,
    window_start_at = null,
    lease_token = null,
    lease_expires_at = null,
    health = 'unconfigured',
    last_error = 'Explicitly excluded from X Wire source collection',
    updated_at = now()
where lower(handle) = 'zerohedge';

-- Keep old/misconfigured clients from leasing an excluded account.
-- Unchanged privileges, lease semantics and function signature.
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
    and lower(a.handle) <> 'zerohedge'
    and a.next_attempt_at <= now()
    and (a.lease_expires_at is null or a.lease_expires_at < now())
  returning a.lease_token, a.last_completed_at, a.page_cursor, a.window_start_at;
$$;
revoke all on function public.claim_x_wire_account(text) from public,anon,authenticated;
grant execute on function public.claim_x_wire_account(text) to service_role;
