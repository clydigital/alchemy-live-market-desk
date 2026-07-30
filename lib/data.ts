const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function query<T>(table: string, params = ""): Promise<T[]> {
  if (!url || !key) return [];
  const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return [];
  return response.json();
}

export type Story = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  rank: number | null;
  market_question: string | null;
  dominant_narrative: string | null;
  best_explanation: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  priced_assessment: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  article_angle: string | null;
  provisional_title: string | null;
  article_verdict: string | null;
  assets: string[];
  source_quality: number;
  novelty: number;
  persistence: number;
  trader_relevance: number;
  article_potential: number;
};

export type EarningsCall = {
  id: string;
  ticker: string;
  company_name: string;
  fiscal_period: string;
  call_date: string | null;
  transcript_status: string;
  relevance_reason: string | null;
  summary: string | null;
  guidance: string | null;
  capex: string | null;
  demand: string | null;
  prior_quarter_change: string | null;
};

export type Update = {
  id: string;
  story_id: string;
  update_type: string;
  headline: string;
  detail: string | null;
  observed_at: string | null;
  created_at: string;
};

export type ChartRequest = {
  id: string;
  story_id: string | null;
  instrument: string;
  timeframe: string;
  overlay: string | null;
  question: string;
  confirmation_area: string | null;
  invalidation_area: string | null;
  status: string;
};

export async function getDeskData() {
  const [stories, calls, updates, charts] = await Promise.all([
    query<Story>("stories", "select=*&status=neq.archived&order=rank.asc.nullslast,updated_at.desc"),
    query<EarningsCall>("earnings_calls", "select=*&order=call_date.desc.nullslast&limit=12"),
    query<Update>("story_updates", "select=*&order=created_at.desc&limit=20"),
    query<ChartRequest>("chart_requests", "select=*&order=created_at.desc&limit=20"),
  ]);
  return { stories, calls, updates, charts };
}
