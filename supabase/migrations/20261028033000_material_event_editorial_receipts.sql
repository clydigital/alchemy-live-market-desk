-- Material original-source → editorial decision audit, reusing the EXISTING
-- private blue_desk_editorial_slates row. No new database table, engine, cron,
-- canonical Story creator, evidence table, or public grants.
--
-- Historical slates remain valid. Starting 2026-10-28 MYT, a slate marked
-- SOURCE_CHECKED must explicitly account for every *admitted, pre-cutoff*
-- high-impact original-source filing/news row (capped at twelve).
-- PARTIAL slates remain publishable; the owner reader marks missing decisions.
alter table public.blue_desk_editorial_slates
 add column if not exists material_event_receipts jsonb not null default '[]'::jsonb;

alter table public.blue_desk_editorial_slates
 drop constraint if exists blue_desk_editorial_slates_material_receipts_check;
alter table public.blue_desk_editorial_slates
 add constraint blue_desk_editorial_slates_material_receipts_check check (
   jsonb_typeof(material_event_receipts)='array'
   and jsonb_array_length(material_event_receipts)<=30
   and octet_length(material_event_receipts::text)<=20000
 );

create or replace function public.bluebelly_assert_material_event_receipts()
returns trigger language plpgsql
set search_path=public,pg_temp
as $$
declare
 source_row record;
 receipt jsonb;
 disposition text;
 explanation text;
 selected_url boolean;
begin
 if NEW.day_myt < date '2026-10-28' then return NEW; end if;
 -- Reject malformed claims even for PARTIAL; don't reject PARTIAL for missing
 -- evidence. The selected slate and source runner remain separate authorities.
 for receipt in select value from jsonb_array_elements(NEW.material_event_receipts)
 loop
   if jsonb_typeof(receipt) <> 'object'
     or coalesce(receipt->>'item_key','') !~ '^[a-z0-9][a-z0-9:._-]{4,190}$'
     or coalesce(receipt->>'source_url','') !~ '^https://[^ ]+
     or coalesce(receipt->>'disposition','') not in
       ('SELECTED','EXCLUDED','NEEDS_SOURCE')
   then
     raise exception 'MATERIAL_RECEIPT_MALFORMED' using errcode='23514';
   end if;
   explanation:=btrim(coalesce(receipt->>'reason',''));
   if char_length(explanation)<20 or char_length(explanation)>800 then
     raise exception 'MATERIAL_RECEIPT_REASON_REQUIRED' using errcode='23514';
   end if;
 end loop;
 if NEW.verification_status <> 'source_checked' then return NEW; end if;
 for source_row in
   select item_key,url,title from (
     select distinct on (item_key) item_key,url,title,materiality,created_at
     from public.research_intake_items
     where item_type='news' and status='accepted'
       and source_quality>=90 and materiality>=80
       and (item_key like 'official-edgar:%' or item_key like 'official-press:%')
       and published_at > NEW.produced_at - interval '72 hours'
       and published_at <= NEW.produced_at
       and created_at <= NEW.produced_at
     order by item_key,created_at desc
   ) deduped
   order by materiality desc,created_at desc
   limit 12
 loop
   select r.value into receipt
   from jsonb_array_elements(NEW.material_event_receipts) as r(value)
   where r.value->>'item_key'=source_row.item_key
     and r.value->>'source_url'=source_row.url
   limit 1;
   if receipt is null then
     raise exception 'MATERIAL_EVENT_NOT_ACKNOWLEDGED: %',source_row.item_key
       using errcode='23514';
   end if;
   disposition:=receipt->>'disposition';
   if disposition='SELECTED' then
     select exists(
       select 1 from jsonb_array_elements(NEW.ideas) as idea(value)
       where (idea.value->'sourceUrls') ? source_row.url
     ) into selected_url;
     if not selected_url then
       raise exception 'MATERIAL_EVENT_SELECTION_NEEDS_SOURCE_URL: %',
         source_row.item_key using errcode='23514';
     end if;
   end if;
 end loop;
 return NEW;
end;
$$;
drop trigger if exists bluebelly_editorial_material_receipts on public.blue_desk_editorial_slates;
create trigger bluebelly_editorial_material_receipts
 before insert or update of ideas,sources,notes,verification_status,material_event_receipts,produced_at
 on public.blue_desk_editorial_slates
 for each row execute function public.bluebelly_assert_material_event_receipts();

revoke all on function public.bluebelly_assert_material_event_receipts() from public,anon,authenticated;
alter table public.blue_desk_editorial_slates enable row level security;
revoke all on public.blue_desk_editorial_slates from public,anon,authenticated;

     or char_length(coalesce(receipt->>'source_url',''))>1500
     or coalesce(receipt->>'disposition','') not in
       ('SELECTED','EXCLUDED','NEEDS_SOURCE')
   then
     raise exception 'MATERIAL_RECEIPT_MALFORMED' using errcode='23514';
   end if;
   explanation:=btrim(coalesce(receipt->>'reason',''));
   if char_length(explanation)<20 or char_length(explanation)>800 then
     raise exception 'MATERIAL_RECEIPT_REASON_REQUIRED' using errcode='23514';
   end if;
 end loop;
 if NEW.verification_status <> 'source_checked' then return NEW; end if;
 for source_row in
   select distinct on (item_key) item_key,url,title
   from public.research_intake_items
   where item_type='news' and status='accepted'
     and source_quality>=90 and materiality>=80
     and (item_key like 'official-edgar:%' or item_key like 'official-press:%')
     and published_at > NEW.produced_at - interval '72 hours'
     and published_at <= NEW.produced_at
     and created_at <= NEW.produced_at
   order by item_key,created_at desc
   limit 12
 loop
   select r.value into receipt
   from jsonb_array_elements(NEW.material_event_receipts) as r(value)
   where r.value->>'item_key'=source_row.item_key
     and r.value->>'source_url'=source_row.url
   limit 1;
   if receipt is null then
     raise exception 'MATERIAL_EVENT_NOT_ACKNOWLEDGED: %',source_row.item_key
       using errcode='23514';
   end if;
   disposition:=receipt->>'disposition';
   if disposition='SELECTED' then
     select exists(
       select 1 from jsonb_array_elements(NEW.ideas) as idea(value)
       where (idea.value->'sourceUrls') ? source_row.url
     ) into selected_url;
     if not selected_url then
       raise exception 'MATERIAL_EVENT_SELECTION_NEEDS_SOURCE_URL: %',
         source_row.item_key using errcode='23514';
     end if;
   end if;
 end loop;
 return NEW;
end;
$$;
drop trigger if exists bluebelly_editorial_material_receipts on public.blue_desk_editorial_slates;
create trigger bluebelly_editorial_material_receipts
 before insert or update of ideas,sources,notes,verification_status,material_event_receipts,produced_at
 on public.blue_desk_editorial_slates
 for each row execute function public.bluebelly_assert_material_event_receipts();

revoke all on function public.bluebelly_assert_material_event_receipts() from public,anon,authenticated;
alter table public.blue_desk_editorial_slates enable row level security;
revoke all on public.blue_desk_editorial_slates from public,anon,authenticated;
