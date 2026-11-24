-- User-approved 16th X discovery source: @SaraEisen (24 Nov 2026).
-- Register only; no fabricated collection or verification status.
insert into public.x_wire_accounts (handle, health, next_attempt_at)
values ('SaraEisen', 'unconfigured', '-infinity'::timestamptz)
on conflict (handle) do nothing;
