BEGIN;
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS ai_price_stance text;
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS ai_price_reason text;
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS chart_series text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.evidence_reviews ADD COLUMN IF NOT EXISTS user_score integer;
ALTER TABLE public.evidence_reviews ADD COLUMN IF NOT EXISTS ai_stance text;
ALTER TABLE public.evidence_reviews ADD COLUMN IF NOT EXISTS ai_score integer;
ALTER TABLE public.evidence_reviews ADD COLUMN IF NOT EXISTS agreement boolean;
ALTER TABLE public.evidence_reviews ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.macro_series_observations (
  id text PRIMARY KEY, series_key text NOT NULL, series_id text NOT NULL, series_name text NOT NULL,
  agency text NOT NULL, observation_date date NOT NULL, value numeric NOT NULL, mom_change numeric,
  yoy_change numeric, unit text NOT NULL, frequency text NOT NULL DEFAULT 'Monthly', source_url text NOT NULL,
  is_preliminary boolean NOT NULL DEFAULT false, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS macro_series_key_date_idx ON public.macro_series_observations(series_key, observation_date);
ALTER TABLE public.macro_series_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_macro_series_observations ON public.macro_series_observations;
CREATE POLICY public_read_macro_series_observations ON public.macro_series_observations FOR SELECT TO public USING (true);
GRANT SELECT ON public.macro_series_observations TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.market_series_observations (
  id text PRIMARY KEY, series_key text NOT NULL, symbol text NOT NULL, series_name text NOT NULL,
  provider text NOT NULL, observation_date date NOT NULL, close numeric NOT NULL, currency text,
  frequency text NOT NULL DEFAULT 'Monthly end-of-period', source_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_series_key_date_idx ON public.market_series_observations(series_key, observation_date);
ALTER TABLE public.market_series_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_market_series_observations ON public.market_series_observations;
CREATE POLICY public_read_market_series_observations ON public.market_series_observations FOR SELECT TO public USING (true);
GRANT SELECT ON public.market_series_observations TO anon, authenticated;
COMMIT;