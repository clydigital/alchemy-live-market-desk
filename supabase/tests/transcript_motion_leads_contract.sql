-- Transcript Motion lead persistence contract.

begin;

do $$
declare
  default_expr text;
begin
  if to_regclass('public.research_intake_items') is null then
    raise exception 'public.research_intake_items table does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'research_intake_items'
      and column_name = 'transcript_motion_leads'
      and data_type = 'jsonb'
  ) then
    raise exception 'research_intake_items.transcript_motion_leads jsonb column is missing';
  end if;

  select pg_get_expr(adbin, adrelid)
  into default_expr
  from pg_attrdef
  where adrelid = 'public.research_intake_items'::regclass
    and adnum = (
      select attnum
      from pg_attribute
      where attrelid = 'public.research_intake_items'::regclass
        and attname = 'transcript_motion_leads'
        and not attisdropped
    );

  if default_expr is null or default_expr not like '%[]%' then
    raise exception 'transcript_motion_leads must default to an empty JSON array, got %', default_expr;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'research_intake_items_transcript_motion_leads_array'
      and conrelid = 'public.research_intake_items'::regclass
  ) then
    raise exception 'transcript_motion_leads JSON-array constraint is missing';
  end if;
end
$$;

rollback;
