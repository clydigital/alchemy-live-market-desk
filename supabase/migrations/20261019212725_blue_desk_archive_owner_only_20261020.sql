-- Production-applied 2026-10-19 21:27:25 UTC, Supabase migration
-- blue_desk_archive_owner_only_20261020.
-- Raw immutable publication JSON is not a public Data API contract.
-- Public Blue Desk pages are backed by server-only, bounded projections.
BEGIN;
ALTER TABLE public.hybrid_publication_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_hybrid_publication_snapshots ON public.hybrid_publication_snapshots;
REVOKE ALL PRIVILEGES ON TABLE public.hybrid_publication_snapshots FROM anon, authenticated;
GRANT SELECT ON TABLE public.hybrid_publication_snapshots TO authenticated;
CREATE POLICY approved_presenter_read_hybrid_publication_snapshots
  ON public.hybrid_publication_snapshots
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.app_access_allowlist allowlist
      WHERE allowlist.active = true
        AND allowlist.email = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
    )
  );
COMMENT ON POLICY approved_presenter_read_hybrid_publication_snapshots
  ON public.hybrid_publication_snapshots
  IS 'Raw immutable publication JSON is private. Public Blue Desk pages use server-only curated projections; owner raw reads require Google allowlist.';
COMMIT;
