-- R4: public reviewed editorial report library. Additive: no Story, Motion or Dossier mutation.
-- A report only becomes publicly readable after an explicit signed-in owner approval.
create table if not exists public.editorial_publications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('COTD','OB')),
  title text not null check (char_length(title) between 5 and 63),
  meta_description text not null default '' check (char_length(meta_description) <= 150),
  body text not null check (char_length(body) between 200 and 15000),
  excerpt text not null check (char_length(excerpt) <= 260),
  source_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_urls)='array' and jsonb_array_length(source_urls) between 1 and 12),
  pdf_path text not null unique check (pdf_path ~ '^reports/[0-9a-f-]{36}/[0-9a-f-]{36}[.]pdf$'),
  pdf_sha256 text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'published' check (status='published'),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists editorial_publications_recent_idx
  on public.editorial_publications (published_at desc,id desc) where status='published';
alter table public.editorial_publications enable row level security;
-- Only public records may be read, never written or revised by browser clients.
drop policy if exists editorial_publications_public_read on public.editorial_publications;
create policy editorial_publications_public_read
  on public.editorial_publications for select to anon,authenticated
  using (status='published');
revoke all on public.editorial_publications from anon,authenticated;
grant select (id,kind,title,meta_description,body,excerpt,source_urls,status,published_at)
  on public.editorial_publications to anon,authenticated;
-- Private bucket: PDF delivery only via Vercel GET /reports/{id}/pdf after
-- the approved publication record is confirmed. Anonymous storage reads denied.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('editorial-pdfs','editorial-pdfs',false,3145728,array['application/pdf'])
on conflict (id) do nothing;
