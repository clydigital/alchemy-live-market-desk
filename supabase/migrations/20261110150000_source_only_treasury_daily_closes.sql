-- Source-only, official Treasury daily close ledger.
-- Independent of retired automated Dossier and public editorial publication.
BEGIN;

CREATE TABLE IF NOT EXISTS public.treasury_daily_closes (
  id text PRIMARY KEY,
  tenor_id text NOT NULL CHECK (tenor_id IN ('us2y','us5y-fred','us10y-fred','us20y-fred','us30y-fred')),
  observation_date date NOT NULL,
  yield_percent numeric(7,4) NOT NULL CHECK (yield_percent >= 0 AND yield_percent <= 30),
  source_updated_at timestamptz,
  source_url text NOT NULL CHECK (source_url LIKE 'https://home.treasury.gov/%'),
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treasury_daily_closes_id_length CHECK (length(id) BETWEEN 14 AND 150)
);
CREATE INDEX IF NOT EXISTS treasury_daily_closes_tenor_date_idx
  ON public.treasury_daily_closes (tenor_id, observation_date DESC, collected_at DESC);
ALTER TABLE public.treasury_daily_closes ENABLE ROW LEVEL SECURITY;
-- The scheduled server writer uses service-role only; no client-facing raw-table access.
REVOKE ALL ON public.treasury_daily_closes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.treasury_daily_closes TO service_role;
COMMENT ON TABLE public.treasury_daily_closes IS
  'Append-only published Treasury nominal par yield observations, with provider-date provenance; independent from Dossier decisions.';
COMMIT;
