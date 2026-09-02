import { recruitFreshNews } from "./fresh-news-recruitment.ts";

export type RoutableNewsItem = {
  itemKey: string;
  itemType: string;
  title: string;
  summary: string;
  publishedAt: string;
  affectedStorySlugs?: string[];
};

export type RoutableStory = {
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  assets: string[];
};

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "been", "before", "being", "between", "could", "from", "have", "into", "more", "over", "said", "says", "than", "that", "their", "there", "these", "they", "this", "through", "under", "what", "when", "where", "which", "while", "with", "would", "market", "markets", "story",
]);

const CATEGORY_STORY_CUES: Record<string, RegExp> = {
  macro: /\b(growth|inflation|jobs?|employment|wages?|productivity|demand|consumer|gdp|cpi|pce|pmi|ism)\b/i,
  central_banks_policy: /\b(fed|fomc|central bank|rate|policy|intervention|treasury|fiscal|cpi|carry)\b/i,
  rates_sovereigns: /\b(yield|yields|bond|bonds|treasury|jgb|bund|gilt|rate|rates|fiscal|debt|deficit|term premium|carry|cpi)\b/i,
  fx: /\b(dollar|dxy|yen|jpy|euro|eur|sterling|gbp|yuan|cny|fx|currency|carry)\b/i,
  commodities_energy: /\b(oil|crude|brent|wti|diesel|gasoline|refin|gold|copper|commodity|energy)\b/i,
  geopolitics: /\b(iran|israel|hormuz|war|strike|sanction|tariff|trade|ceasefire|russia|ukraine|china)\b/i,
  equities_earnings: /\b(equities|equity|stocks?|earnings|guidance|revenue|margin|software|semiconductor|mag7|breadth)\b/i,
  credit_liquidity: /\b(credit|funding|liquidity|spread|leverage|financing|private credit|bank)\b/i,
  positioning_flows: /\b(positioning|flows?|carry|hedge|cta|options?|gamma|volatility|vix)\b/i,
  technology_structural: /\b(ai|artificial intelligence|capex|data cent(?:er|re)|power|cloud|chip|semiconductor|productivity)\b/i,
};

const ASSET_FAMILIES: Array<[string, RegExp]> = [
  ["us_rates", /^(US02Y|US05Y|US10Y|US30Y|DXY|SPX|NDX|NASDAQ)$/i],
  ["japan", /^(JP10Y|JGB|JPY|USDJPY|AUDJPY|GBPJPY|NIKKEI|TOPIX)$/i],
  ["energy", /^(USOIL|UKOIL|WTI|BRENT|DIESEL_CRACK|GASOLINE_CRACK|XOM|CVX|PSX|VLO)$/i],
  ["ai", /^(NVDA|AMD|SOXX|MSFT|GOOGL|META|AMZN|CRWV)$/i],
];

function tokens(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{4,}/g)?.map((token) => token.replace(/s$/, "")).filter((token) => !STOP_WORDS.has(token)) ?? []);
}

function assetFamily(asset: string) {
  return ASSET_FAMILIES.find(([, pattern]) => pattern.test(asset))?.[0] ?? null;
}

export function persistentStoryMatchScore(item: RoutableNewsItem, story: RoutableStory, now = new Date()) {
  const recruited = recruitFreshNews({ title: item.title, summary: item.summary, publishedAt: item.publishedAt }, now);
  const storyText = `${story.title}\n${story.thesis}\n${story.assets.join(" ")}`;
  const articleTokens = tokens(`${item.title}\n${item.summary}`);
  const storyTokens = tokens(storyText);
  const tokenOverlap = [...articleTokens].filter((token) => storyTokens.has(token)).length;

  const exactAssetOverlap = recruited.affectedAssets.filter((asset) => story.assets.includes(asset)).length;
  const recruitedFamilies = new Set(recruited.affectedAssets.map(assetFamily).filter(Boolean));
  const storyFamilies = new Set(story.assets.map(assetFamily).filter(Boolean));
  const familyOverlap = [...recruitedFamilies].filter((family) => storyFamilies.has(family)).length;
  const categoryMatches = recruited.categories.filter((category) => CATEGORY_STORY_CUES[category]?.test(storyText)).length;

  const anchored = exactAssetOverlap > 0 || familyOverlap > 0 || categoryMatches >= 2 || tokenOverlap >= 3;
  if (!anchored) return 0;

  return Math.min(100,
    exactAssetOverlap * 34
    + familyOverlap * 22
    + categoryMatches * 9
    + Math.min(24, tokenOverlap * 4)
    + (story.confidence >= 80 ? 5 : 0)
    + (story.status === "publish" ? 3 : 0));
}

export function matchFreshNewsToStories(item: RoutableNewsItem, stories: RoutableStory[], now = new Date()) {
  if (item.itemType !== "news" || item.itemKey.startsWith("calendar:")) return item.affectedStorySlugs ?? [];
  const scored = stories
    .map((story) => ({ story, score: persistentStoryMatchScore(item, story, now) }))
    .filter(({ score }) => score >= 30)
    .sort((left, right) => right.score - left.score || right.story.confidence - left.story.confidence)
    .slice(0, 2)
    .map(({ story }) => story.slug);
  return [...new Set([...(item.affectedStorySlugs ?? []), ...scored])];
}
