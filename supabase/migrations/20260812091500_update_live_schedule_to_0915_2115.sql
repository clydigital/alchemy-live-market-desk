-- Canonical unattended cadence for the Live Desk. Video intake remains an
-- internal child step of each full research cycle, not an independently
-- scheduled publication slot.

begin;

update public.research_schedule_slots
set
  local_time = case slot_key
    when 'morning' then '09:15:00'::time
    when 'evening' then '21:15:00'::time
    when 'video_midnight' then '09:15:00'::time
    when 'video_late_morning' then '21:15:00'::time
    else local_time
  end,
  purpose = case slot_key
    when 'morning' then 'Full Live Desk acquisition, canonical reasoning and read-only Hybrid handoff'
    when 'evening' then 'Evening Live Desk delta acquisition, canonical reasoning and read-only Hybrid handoff'
    when 'video_midnight' then 'Legacy video-intake record key; now invoked inside the 09:15 Live Desk cycle'
    when 'video_late_morning' then 'Legacy video-intake record key; now invoked inside the 21:15 Live Desk cycle'
    else purpose
  end,
  is_enabled = case
    when slot_key in ('morning', 'evening') then true
    when slot_key in ('video_midnight', 'video_late_morning') then false
    else is_enabled
  end,
  updated_at = now()
where slot_key in ('morning', 'evening', 'video_midnight', 'video_late_morning');

comment on table public.research_schedule_slots is
  'Canonical two-slot Asia/Kuala_Lumpur Live Desk schedule: 09:15 and 21:15. Video intake is an internal child step.';

commit;
