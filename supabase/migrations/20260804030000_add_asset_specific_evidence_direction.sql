BEGIN;
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS judged_asset text;
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS evidence_story_active_idx ON public.evidence(story_id,is_active,strength DESC);
ALTER TABLE public.evidence_reviews DROP CONSTRAINT IF EXISTS evidence_reviews_stance_check;
UPDATE public.evidence_reviews SET stance=CASE stance WHEN 'supports' THEN 'bullish' WHEN 'challenges' THEN 'bearish' WHEN 'supportive' THEN 'bullish' WHEN 'negative' THEN 'bearish' ELSE stance END, ai_stance=CASE ai_stance WHEN 'supports' THEN 'bullish' WHEN 'challenges' THEN 'bearish' WHEN 'supportive' THEN 'bullish' WHEN 'negative' THEN 'bearish' ELSE ai_stance END;
ALTER TABLE public.evidence_reviews ADD CONSTRAINT evidence_reviews_stance_check CHECK (stance = ANY (ARRAY['bullish'::text,'bearish'::text,'neutral'::text,'unclear'::text]));
COMMIT;
