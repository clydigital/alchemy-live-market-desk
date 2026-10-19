-- Restrict raw canonical Story event and thesis-version ledgers to
-- approved owners while keeping source-backed public projections intact.
-- Depends on server-side read migration #840 and app_access_allowlist.
-- Live migration history version: 20261019220537.
BEGIN;

ALTER TABLE public.story_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_story_events ON public.story_events;
REVOKE ALL PRIVILEGES ON TABLE public.story_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.story_events TO authenticated;
CREATE POLICY approved_presenter_read_story_events
  ON public.story_events
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.app_access_allowlist AS allowlist
      WHERE allowlist.active = true
        AND allowlist.email = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
    )
  );

ALTER TABLE public.story_thesis_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_story_thesis_versions ON public.story_thesis_versions;
REVOKE ALL PRIVILEGES ON TABLE public.story_thesis_versions FROM anon, authenticated;
GRANT SELECT ON TABLE public.story_thesis_versions TO authenticated;
CREATE POLICY approved_presenter_read_story_thesis_versions
  ON public.story_thesis_versions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.app_access_allowlist AS allowlist
      WHERE allowlist.active = true
        AND allowlist.email = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
    )
  );

COMMENT ON POLICY approved_presenter_read_story_events ON public.story_events
IS 'Raw canonical Story events are owner-only. Public clients consume bounded projected publication routes.';
COMMENT ON POLICY approved_presenter_read_story_thesis_versions ON public.story_thesis_versions
IS 'Raw immutable thesis snapshots are owner-only. Server projections read using service credentials.';
COMMIT;
