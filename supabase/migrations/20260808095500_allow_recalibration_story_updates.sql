-- The research publisher already emits `recalibration` for a gated Story update.
-- Preserve the legacy values while allowing the publisher's canonical update type.

begin;

alter table public.story_updates
  drop constraint if exists story_updates_update_type_check;

alter table public.story_updates
  add constraint story_updates_update_type_check
  check (update_type in (
    'new',
    'confirmation',
    'contradiction',
    'background',
    'invalidation',
    'status',
    'recalibration'
  ));

comment on column public.story_updates.update_type is
  'Legacy/public update category. Recalibration is allowed for validated research-publisher Story changes and is mirrored into story_events.';

commit;
