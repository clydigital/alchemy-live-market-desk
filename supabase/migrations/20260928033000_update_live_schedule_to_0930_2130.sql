-- Move the canonical Live Desk slots 15 minutes later so scheduled research
-- can incorporate the 08:00 / 20:00 MacroPulse handoff before publication.

begin;

update public.research_schedule_slots
set
  local_time = case slot_key
    when 'morning' then '09:30:00'::time
    when 'evening' then '21:30:00'::time
    else local_time
  end,
  updated_at = now()
where slot_key in ('morning', 'evening');

comment on table public.research_schedule_slots is
  'Canonical two-slot Asia/Kuala_Lumpur Live Desk schedule: 09:30 and 21:30. Video intake remains separate/internal.';

commit;
