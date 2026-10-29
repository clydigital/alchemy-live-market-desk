-- Add a user-approved tenth X discovery account. Does not alter research authority or schedules.
-- KobeissiLetter was already registered; avoid duplicating its checkpoint.
insert into public.x_wire_accounts(handle,health,next_attempt_at)
values ('HormuzReport','unconfigured','-infinity'::timestamptz)
on conflict (handle) do nothing;

comment on table public.x_wire_accounts is
  'Private ten-source X discovery checkpoints, including HormuzReport and KobeissiLetter; operational leads only.';
