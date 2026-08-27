begin;

alter table public.research_intake_items
  drop constraint if exists research_intake_items_transcript_provider_check;

alter table public.research_intake_items
  add constraint research_intake_items_transcript_provider_check
  check (
    transcript_provider is null
    or transcript_provider = any (
      array[
        'transcriptapi'::text,
        'supadata'::text,
        'youtubetotranscript.com'::text,
        'official'::text,
        'other'::text
      ]
    )
  );

commit;
