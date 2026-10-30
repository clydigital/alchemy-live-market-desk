-- 30 Oct 2026 user request: add The Macro Paper profile as X Wire DISCOVERY ONLY.
-- Author/profile and source post fetched from original X public page, no claim verification.
-- Idempotent against manual production registration, no previous checkpoint or health rewrite.
insert into public.x_wire_accounts (handle,health,next_attempt_at)
values ('macropaperr','unconfigured','-infinity'::timestamptz)
on conflict (handle) do nothing;

insert into public.x_wire_posts
 (post_id,handle,original_url,published_at,retrieved_at,body,media_urls,intake_status,original_verified)
values
 ('2116114383520845885','macropaperr',
  'https://x.com/macropaperr/status/2116114383520845885',
  '2026-10-30T10:25:59Z',now(),
  'BLACK FRIDAY IS HERE. $700 Billion has been wiped out from Gold and Silver today. $500 Billion has been wiped out from the Asian stock market today. $150 Billion has been wiped out from the crypto market following Binance''s hack. $800 Billion will be wiped out from the US stock market at open based on the current pre-market drop. This is almost $2.2 Trillion wiped out from global markets, and Friday isn''t over yet.',
  '[]'::jsonb,'discovery',false)
on conflict do nothing;
