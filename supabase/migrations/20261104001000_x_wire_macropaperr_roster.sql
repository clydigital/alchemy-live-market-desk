-- Approved 12th X Wire source. Preserve any manually registered account and all checkpoints.
-- Roster membership does not verify posts or underlying market claims.
insert into public.x_wire_accounts (handle, health, next_attempt_at)
values ('macropaperr','unconfigured','-infinity'::timestamptz)
on conflict (handle) do nothing;
