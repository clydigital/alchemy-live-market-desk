-- Applied in production as 20261019221108_blue_desk_owner_only_raw_motion_20261020.
-- Public Motion is a bounded server projection; the raw lifecycle and metadata
-- ledger is owner-only. The current view must obey invoker RLS.
BEGIN;
ALTER TABLE public.market_motion_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_market_motion_items ON public.market_motion_items;
REVOKE ALL PRIVILEGES ON TABLE public.market_motion_items FROM anon, authenticated;
GRANT SELECT ON TABLE public.market_motion_items TO authenticated;
CREATE POLICY approved_presenter_read_market_motion_items
 ON public.market_motion_items FOR SELECT TO authenticated
 USING (
  (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
   SELECT 1 FROM public.app_access_allowlist a
   WHERE a.active = true
     AND a.email = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
  )
 );
-- Explicit invoker semantics prevent the view owner from bypassing the raw-table RLS.
ALTER VIEW public.current_market_motion_items SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.current_market_motion_items FROM anon, authenticated;
GRANT SELECT ON TABLE public.current_market_motion_items TO authenticated;
COMMENT ON POLICY approved_presenter_read_market_motion_items ON public.market_motion_items
IS 'Raw Motion and metadata are owner-only; public News Briefs are bounded read-only projections.';
COMMIT;
