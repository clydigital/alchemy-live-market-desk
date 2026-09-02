import {
  EXPLICIT_INSTRUMENTS,
  containsInstrumentAlias,
} from "@/lib/instrument-mentions";

export const FRESH_NEWS_RECRUITMENT_V1 = "fresh-news-recruitment/v1";

export type FreshNewsCategory =
  | "global_policy"
  | "rates_fiscal"
  | "central_banks"
  | "geopolitics"
  | "energy"
  | "fx"
  | "ai_technology"
  | "credit_banks"
  | "equities"
  | "macro_data"
  | "trade_industrial";

export type RecruitableStory = {
  slug: string;
  title: string;
  thesis: string;
  market_question?: string | null;
  dominant_narrative?: string | null;
  strongest_support?: string | null;
  strongest_contradiction?: string | null;
  next_catalyst?: string | null;
  assets?: string[];
};

export type RecruitableIntakeItem = {
  item_type: "video" | "news" | "alchemy_article";
  title: string;
  summary: string;
  published_at: string;
  affected_story_slugs?: string[];
  relevance: number;
  materiality: number;
  recommended_action: string;
  transcript_status?: string | null;
  status?: string | null;
  url?: string | null;
};

export type FreshNewsRecruitment = {
  contractVersion: typeof FRESH_NEWS_RECRUITMENT_V1;
  categories: FreshNewsCategory[];
  categoryTags: string[];
  matchedStorySlugs: string[];
  explicitAssets: string[];
  freshnessScore: number;
  recruitmentScore: number;
  keyTerms: string[];
  cleanedSummary: string;
};

const CATEGORY_RULES: Array<{ category: FreshNewsCategory; patterns: RegExp[] }> = [
  {
    category: "global_policy",
    patterns: [/\bg20\b/i, /finance ministers?/i, /central bank governors?/i, /multilateral/i, /global economic/i, /summit/i],
  },
  {
    category: "rates_fiscal",
    patterns: [/\bbonds?\b/i, /\byields?\b/i, /treasur(?:y|ies)/i, /term premium/i, /duration/i, /\bdeficits?\b/i, /\bdebt\b/i, /fiscal/i, /sovereign/i, /buybacks?/i],
  },
  {
    category: "central_banks",
    patterns: [/central banks?/i, /\bfed\b/i, /federal reserve/i, /\bfomc\b/i, /\becb\b/i, /bank of japan/i, /\bboj\b/i, /\brbnz\b/i, /reserve bank of new zealand/i, /bank of canada/i, /rate decision/i, /monetary policy/i],
  },
  {
    category: "geopolitics",
    patterns: [/\biran\b/i, /hormuz/i, /\brussia\b/i, /\bukraine\b/i, /\btaiwan\b/i, /militar/i, /\bwar\b/i, /sanctions?/i, /ceasefire/i, /blockade/i],
  },
  {
    category: "energy",
    patterns: [/\boil\b/i, /\bcrude\b/i, /\bbrent\b/i, /\bwti\b/i, /diesel/i, /gasoline/i, /refin(?:ery|ing)/i, /opec/i, /lng/i, /natural gas/i],
  },
  {
    category: "fx",
    patterns: [/\byen\b/i, /\bdollar\b/i, /\beuro\b/i, /sterling/i, /currenc/i, /foreign exchange/i, /\bfx\b/i, /usd\/?jpy/i, /eur\/?usd/i, /gbp\/?usd/i],
  },
  {
    category: "ai_technology",
    patterns: [/artificial intelligence/i, /\bai\b/i, /openai/i, /nvidia/i, /semiconductor/i, /\bchips?\b/i, /data cent(?:er|re)/i, /software/i, /cloud computing/i],
  },
  {
    category: "credit_banks",
    patterns: [/private credit/i, /\bcredit\b/i, /\bbanks?\b/i, /lending/i, /capital requirements?/i, /financial regulation/i, /liquidity/i],
  },
  {
    category: "equities",
    patterns: [/\bstocks?\b/i, /\bequities\b/i, /s&p\s*500/i, /nasdaq/i, /mag\s*7/i, /earnings/i, /shares?\b/i],
  },
  {
    category: "macro_data",
    patterns: [/inflation/i, /\bcpi\b/i, /\bpce\b/i, /payroll/i, /employment/i, /unemployment/i, /\bgdp\b/i, /\bpmi\b/i, /\bism\b/i, /retail sales/i, /productivity/i, /unit labour/i, /\bgrowth\b/i],
  },
  {
    category: "trade_industrial",
    patterns: [/\btrade\b/i, /tariffs?/i, /trade surplus/i, /exports?/i, /imports?/i, /supply chain/i, /industrial/i, /manufactur/i, /decoupl/i],
  },
];

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "along", "also", "amid", "among", "another", "around", "because", "been", "before", "being", "between", "both", "could", "despite", "during", "from", "have", "having", "into", "latest", "market", "markets", "more", "most", "much", "official", "officials", "over", "report", "reported", "reporting", "said", "says", "some", "than", "that", "their", "there", "these", "they", "this", "those", "through", "today", "under", "very", "week", "were", "what", "when", "where", "which", "while", "with", "would", "year", "years",
]);

const STRONG_MATCH_TERMS = new Set([
  "bond", "yield", "fiscal", "deficit", "treasury", "inflation", "cpi", "pce", "payroll", "productivity",
  "yen", "boj", "japan", "intervention", "carry", "iran", "hormuz", "sanction", "oil", "crude", "diesel", "gasoline",
  "nvidia", "semiconductor", "software", "credit", "bank", "tariff", "trade", "china", "g20", "regulation",
]);

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** Normalises both literal and entity-escaped feed markup before semantic routing. */
export function cleanResearchText(value: string) {
  let text = value || "";
  for (let pass = 0; pass < 2; pass += 1) text = decodeEntities(text);
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemToken(value: string) {
  let token = value.toLowerCase().replace(/^'+|'+$/g, "");
  if (token.endsWith("ies") && token.length > 5) token = `${token.slice(0, -3)}y`;
  else if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) token = token.slice(0, -1);
  return token;
}

function significantTerms(value: string) {
  const text = cleanResearchText(value).toLowerCase();
  const terms = text.match(/[a-z][a-z0-9'-]{2,}/g) ?? [];
  return [...new Set(terms
    .map(stemToken)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term) && !/^\d+$/.test(term)))];
}

function categoryScores(text: string) {
  return CATEGORY_RULES.map(({ category, patterns }) => ({
    category,
    score: patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0),
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || CATEGORY_RULES.findIndex((entry) => entry.category === left.category) - CATEGORY_RULES.findIndex((entry) => entry.category === right.category));
}

export function classifyFreshNews(text: string): FreshNewsCategory[] {
  return categoryScores(cleanResearchText(text)).slice(0, 4).map((entry) => entry.category);
}

function safeTreasuryDurationMention(text: string, instrument: "US10Y" | "US30Y") {
  const years = instrument === "US10Y" ? "10" : "30";
  const explicitTicker = new RegExp(`\\bUS${years}Y\\b`, "i");
  if (explicitTicker.test(text)) return true;
  const duration = `${years}(?:[- ]year|y)`;
  const usLead = new RegExp(`(?:u\\.?s\\.?|united states|treasury|treasuries).{0,35}${duration}`, "i");
  const usTrail = new RegExp(`${duration}.{0,35}(?:u\\.?s\\.?|united states|treasury|treasuries)`, "i");
  return usLead.test(text) || usTrail.test(text);
}

export function explicitFreshNewsAssets(text: string) {
  const cleaned = cleanResearchText(text);
  return EXPLICIT_INSTRUMENTS.flatMap((spec) => {
    if (spec.instrument === "US10Y" || spec.instrument === "US30Y") {
      return safeTreasuryDurationMention(cleaned, spec.instrument) ? [spec.instrument] : [];
    }
    return spec.aliases.some((alias) => containsInstrumentAlias(cleaned, alias)) ? [spec.instrument] : [];
  });
}

function storyText(story: RecruitableStory) {
  return [
    story.title,
    story.thesis,
    story.market_question,
    story.dominant_narrative,
    story.strongest_support,
    story.strongest_contradiction,
    story.next_catalyst,
    ...(story.assets ?? []),
  ].filter(Boolean).join(" ");
}

function storyMatchScore(articleTerms: Set<string>, articleCategories: Set<FreshNewsCategory>, articleText: string, story: RecruitableStory) {
  const candidateText = storyText(story);
  const candidateTerms = new Set(significantTerms(candidateText));
  const candidateCategories = new Set(classifyFreshNews(candidateText));
  const sharedTerms = [...articleTerms].filter((term) => candidateTerms.has(term));
  const strongShared = sharedTerms.filter((term) => STRONG_MATCH_TERMS.has(term));
  const sharedCategories = [...articleCategories].filter((category) => candidateCategories.has(category));
  const explicitAssetMatches = (story.assets ?? []).filter((asset) => containsInstrumentAlias(articleText, asset));

  if (!strongShared.length && sharedTerms.length < 2 && !explicitAssetMatches.length) return 0;
  return sharedTerms.length * 3 + strongShared.length * 2 + sharedCategories.length * 2 + explicitAssetMatches.length * 5;
}

function freshnessScore(publishedAt: string, now: Date) {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageHours = Math.max(0, (now.getTime() - timestamp) / 3_600_000);
  if (ageHours <= 6) return 100;
  if (ageHours <= 12) return 94;
  if (ageHours <= 24) return 86;
  if (ageHours <= 36) return 76;
  if (ageHours <= 72) return 58;
  if (ageHours <= 168) return 36;
  return 12;
}

export function shouldCanonicaliseResearchIntake(item: RecruitableIntakeItem) {
  if (!item.summary?.trim() || !item.url?.startsWith("https://")) return false;
  if (item.status === "rejected" || item.status === "blocked") return false;
  if (item.recommended_action === "ignore" || item.recommended_action === "monitor") return false;
  if (item.item_type === "video" && item.transcript_status !== "ready") return false;
  return true;
}

export function recruitFreshNews(
  item: RecruitableIntakeItem,
  stories: RecruitableStory[],
  now = new Date(),
): FreshNewsRecruitment {
  const cleanedSummary = cleanResearchText(item.summary);
  const articleText = cleanResearchText(`${item.title} ${cleanedSummary}`);
  const categories = classifyFreshNews(articleText);
  const categorySet = new Set(categories);
  const articleTerms = new Set(significantTerms(articleText));
  const explicitAssets = explicitFreshNewsAssets(articleText);
  const existingSlugs = new Set(item.affected_story_slugs ?? []);

  const rankedMatches = stories
    .filter((story) => !existingSlugs.has(story.slug))
    .map((story) => ({ story, score: storyMatchScore(articleTerms, categorySet, articleText, story) }))
    .filter((entry) => entry.score >= 7)
    .sort((left, right) => right.score - left.score || left.story.slug.localeCompare(right.story.slug))
    .slice(0, 3)
    .map((entry) => entry.story.slug);

  const matchedStorySlugs = [...new Set([...(item.affected_story_slugs ?? []), ...rankedMatches])];
  const fresh = freshnessScore(item.published_at, now);
  const semanticSignal = matchedStorySlugs.length ? 95 : categories.length ? 76 : 35;
  const recruitmentScore = Math.round(
    fresh * 0.35
    + Math.max(0, Math.min(100, item.materiality)) * 0.3
    + Math.max(0, Math.min(100, item.relevance)) * 0.2
    + semanticSignal * 0.15,
  );

  return {
    contractVersion: FRESH_NEWS_RECRUITMENT_V1,
    categories,
    categoryTags: categories.map((category) => `category:${category}`),
    matchedStorySlugs,
    explicitAssets,
    freshnessScore: fresh,
    recruitmentScore,
    keyTerms: [...articleTerms].filter((term) => STRONG_MATCH_TERMS.has(term)).slice(0, 12),
    cleanedSummary,
  };
}
