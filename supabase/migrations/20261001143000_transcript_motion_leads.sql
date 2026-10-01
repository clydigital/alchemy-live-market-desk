-- Persist deterministic Market Motion discovery leads produced by the existing creator transcript review.
-- These leads remain creator research prompts; they are not verified facts and do not promote Motion by themselves.

begin;

alter table if exists public.research_intake_items
  add column if not exists transcript_motion_leads jsonb not null default '[]'::jsonb;

do $$
begin
  if to_regclass('public.research_intake_items') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'research_intake_items_transcript_motion_leads_array'
        and conrelid = 'public.research_intake_items'::regclass
    ) then
    alter table public.research_intake_items
      add constraint research_intake_items_transcript_motion_leads_array
      check (jsonb_typeof(transcript_motion_leads) = 'array');
  end if;
end
$$;

commit;
