-- 29 Oct 2026: owner withdrew the earlier X account exclusion.
-- This is a new forward migration; preserve the historical source decision
-- and original post rows for audit rather than editing applied SQL history.
-- Do not revive previously rejected posts as verified market evidence.
update public.x_wire_accounts
set next_attempt_at = now(),
    last_error = null,
    updated_at = now()
where lower(handle) = 'zerohedge'
  and last_error = 'Explicitly excluded from X Wire source collection';

-- Restore the original lease predicate without the obsolete explicit ban.
-- This makes accounts eligible when registered by the existing approved
-- roster/collector; it does NOT create a new scheduled source or auto-verify.
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
