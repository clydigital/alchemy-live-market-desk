-- Approved 15th X Wire discovery source: @DrJStrategy (18 Nov 2026).
-- Idempotent registration preserves existing account checkpoints.
-- Discovery is not independent verification of claims.
insert into public.x_wire_accounts (handle, health, next_attempt_at)
values ('DrJStrategy', 'unconfigured', '-infinity'::timestamptz)
on conflict (handle) do nothing;
