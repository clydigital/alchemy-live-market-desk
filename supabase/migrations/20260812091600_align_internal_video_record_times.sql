-- The preceding migration was already applied to production before the legacy
-- internal video record times were aligned with their parent Live cycles.

begin;

update public.research_schedule_slots
set
  local_time = case slot_key
    when 'video_midnight' then '09:15:00'::time
    when 'video_late_morning' then '21:15:00'::time
    else local_time
  end,
  updated_at = now()
where slot_key in ('video_midnight', 'video_late_morning');

commit;
