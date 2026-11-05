-- Approved 14th X Wire discovery source: @OddStats (6 Nov 2026).
-- Registration is idempotent and preserves existing account checkpoints.
-- Discovery is not verification of the profile, posts, statistics or market claims.
insert into public.x_wire_accounts (handle, health, next_attempt_at)
values ('OddStats', 'unconfigured', '-infinity'::timestamptz)
on conflict (handle) do nothing;
