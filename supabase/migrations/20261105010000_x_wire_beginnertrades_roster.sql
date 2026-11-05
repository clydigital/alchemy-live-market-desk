-- Approved 13th X Wire discovery source: @BeginnerTrades (5 Nov 2026).
-- Idempotent registration; preserves manually registered accounts and all prior checkpoints.
-- This does not verify the profile, posts, data coverage or underlying market claims.
insert into public.x_wire_accounts (handle, health, next_attempt_at)
values ('BeginnerTrades','unconfigured','-infinity'::timestamptz)
on conflict (handle) do nothing;
