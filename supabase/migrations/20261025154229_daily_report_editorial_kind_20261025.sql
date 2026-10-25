-- Add reviewed Daily Reports to the existing immutable editorial publication library.
-- No new writer, raw public records, Dossier, Story mutations or auto-publication.
alter table public.editorial_publications
  drop constraint if exists editorial_publications_kind_check;
alter table public.editorial_publications
  add constraint editorial_publications_kind_check
  check (kind in ('COTD','OB','DAILY_REPORT'));
-- Public RLS policy, owner-only upload route, PDF bucket and restricted column
-- grants remain unchanged. The new kind uses those existing controls.
