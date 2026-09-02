export const FRESH_NEWS_CATEGORIES = [
  "macro",
  "central_banks_policy",
  "rates_sovereigns",
  "fx",
  "commodities_energy",
  "geopolitics",
  "equities_earnings",
  "credit_liquidity",
  "positioning_flows",
  "technology_structural",
] as const;

export type FreshNewsCategory = typeof FRESH_NEWS_CATEGORIES[number];

type RecruitableNews = {
  title: string;
  summary: string;
  publishedAt: string;
};

const CATEGORY_RULES: Array<[FreshNewsCategory, RegExp]> = [
  ["macro", /\b(growth|gdp|inflation|cpi|pce|ppi|payroll|employment|unemployment|jobs|retail sales|consumer|productivity|wages?|housing|pmi|ism)\b/i],
  ["central_banks_policy", /\b(fed|federal reserve|fomc|ecb|boj|bank of japan|boe|bank of england|rbnz|rba|bank of canada|central bank|rate decision|monetary policy|treasury secretary|finance minister|g20|fiscal policy)\b/i],
  ["rates_sovereigns", /\b(bond|bonds|yield|yields|treasury|treasuries|jgb|gilts?|bunds?|sovereign|debt|deficit|term premium|curve|steepen|flatten|sell[- ]off)\b/i],
  ["fx", /\b(dollar|dxy|yen|jpy|euro|eur|sterling|gbp|yuan|renminbi|cny|nzd|cad|aud|fx|currency|currencies)\b/i],
  ["commodities_energy", /\b(oil|brent|wti|crude|diesel|gasoline|natural gas|lng|gold|silver|copper|commodity|commodities|opec|refinery|refining)\b/i],
  ["geopolitics", /\b(iran|israel|war|strike|missile|military|hormuz|sanction|tariff|trade war|ceasefire|nato|ukraine|russia|china[- ]us|geopolit)\b/i],
  ["equities_earnings", /\b(stock|stocks|equity|equities|s&p|nasdaq|dow|earnings|revenue|guidance|eps|margin|shares?|semiconductor|software)\b/i],
  ["credit_liquidity", /\b(credit|spread|spreads|liquidity|funding|private credit|default|bank lending|repo|financial conditions|leverag)\b/i],
  ["positioning_flows", /\b(positioning|flows?|hedge fund|cta|dealer gamma|options?|short covering|long unwind|carry trade|volatility|vix)\b/i],
  ["technology_structural", /\b(ai|artificial intelligence|data cent(?:er|re)|power grid|capex|cloud|chip|chips|semiconductor|productivity boom)\b/i],
];

const ASSET_RULES: Array<[string, RegExp]> = [
  ["US10Y", /\b(us|u\.s\.|united states|treasury|treasuries).{0,24}\b(10[- ]year|10y|yield|bond)|\b10[- ]year treasury\b/i],
  ["US02Y", /\b(us|u\.s\.|united states|treasury|treasuries).{0,24}\b(2[- ]year|2y|yield|bond)|\b2[- ]year treasury\b/i],
  ["JP10Y", /\b(japan|japanese|jgb).{0,30}\b(10[- ]year|10y|yield|bond)|\bjgb\b/i],
  ["DE10Y", /\b(germany|german|bund).{0,30}\b(10[- ]year|10y|yield|bond)|\bbund\b/i],
  ["DXY", /\b(dxy|dollar index|us dollar|u\.s\. dollar)\b/i],
  ["USDJPY", /\b(usd\/?jpy|usd-jpy|dollar[- ]yen|yen carry|japanese yen)\b/i],
  ["EURUSD", /\b(eur\/?usd|eur-usd|euro[- ]dollar)\b/i],
  ["NZDUSD", /\b(nzd\/?usd|nzd-usd|new zealand dollar|kiwi dollar)\b/i],
  ["USOIL", /\b(wti|west texas|us crude|u\.s\. crude)\b/i],
  ["UKOIL", /\b(brent|north sea crude)\b/i],
  ["GOLD", /\b(gold|xau\/?usd|xauusd)\b/i],
  ["SPX", /\b(s&p 500|s&p|spx|us equities|u\.s\. equities)\b/i],
  ["NDX", /\b(nasdaq 100|nasdaq|ndx|qqq)\b/i],
  ["NIKKEI", /\b(nikkei|japanese stocks|japan equities)\b/i],
];

const SYSTEMIC_SIGNAL = /\b(g20|global|worldwide|cross[- ]asset|sell[- ]off|surge|plunge|record high|record low|first time in|crisis|shock|intervention|emergency|war|ceasefire|default|recession)\b/i;
const MARKET_MOVE_SIGNAL = /\b(yield|yields|bond|bonds|oil|brent|wti|gold|dollar|yen|stocks?|equities|credit|spread|spreads|volatility|vix|futures?)\b/i;
const CAUSAL_SIGNAL = /\b(because|reflects?|driv(?:e|en|ing)|due to|as a result|growth|inflation|deficit|supply|demand|policy|financing)\b/i;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function freshnessScore(publishedAt: string, now: Date) {
  const ageMs = Math.max(0, now.getTime() - Date.parse(publishedAt));
  const hours = ageMs / 3_600_000;
  if (!Number.isFinite(hours)) return 60;
  if (hours <= 4) return 100;
  if (hours <= 12) return 92;
  if (hours <= 24) return 82;
  if (hours <= 36) return 72;
  return 55;
}

export function recruitFreshNews(item: RecruitableNews, now = new Date()) {
  const text = `${item.title}\n${item.summary}`;
  const categories = CATEGORY_RULES.filter(([, pattern]) => pattern.test(text)).map(([category]) => category);
  const affectedAssets = ASSET_RULES.filter(([, pattern]) => pattern.test(text)).map(([asset]) => asset);
  const freshness = freshnessScore(item.publishedAt, now);
  const systemic = SYSTEMIC_SIGNAL.test(text);
  const marketLinked = MARKET_MOVE_SIGNAL.test(text);
  const causal = CAUSAL_SIGNAL.test(text);
  const categoryBreadth = Math.min(18, Math.max(0, categories.length - 1) * 4);

  const relevance = clamp(55 + categoryBreadth + (marketLinked ? 14 : 0) + (systemic ? 14 : 0));
  const materiality = clamp(50 + categoryBreadth + (marketLinked ? 14 : 0) + (systemic ? 18 : 0) + (causal ? 6 : 0));
  const novelty = clamp(freshness + (systemic ? 4 : 0));

  return {
    categories,
    affectedAssets,
    relevance,
    novelty,
    materiality,
    freshness,
    systemic,
    marketLinked,
  };
}

export function isUpcomingCalendarMonitor(item: { itemKey?: string; recommendedAction?: string }) {
  return Boolean(item.itemKey?.startsWith("calendar:") && item.recommendedAction === "monitor");
}
