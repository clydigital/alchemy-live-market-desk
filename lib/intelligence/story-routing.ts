export type RoutableStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  marketQuestion?: string | null;
  dominantNarrative?: string | null;
  strongestSupport?: string | null;
  strongestContradiction?: string | null;
  confirmationTrigger?: string | null;
  invalidationTrigger?: string | null;
  nextCatalyst?: string | null;
  assets?: string[];
};

export type StoryRoute = {
  storyId: string;
  storySlug: string;
  score: number;
  reasons: string[];
};

const STOPWORDS = new Set([
  "about", "after", "again", "against", "also", "among", "because", "been", "before", "being", "between",
  "could", "does", "from", "have", "into", "just", "more", "most", "much", "over", "same", "some", "such",
  "than", "that", "their", "there", "these", "they", "this", "those", "through", "under", "very", "what", "when",
  "where", "which", "while", "with", "would", "your", "market", "markets", "story", "current", "latest", "today",
  "stock", "stocks", "price", "prices", "move", "moves", "new", "now", "still", "risk", "risks",
]);

const TOPIC_FAMILIES: Array<{ tag: string; weight: number; terms: string[] }> = [
  { tag: "rates", weight: 6, terms: ["fed", "fomc", "treasury", "treasuries", "yield", "yields", "bond", "bonds", "rate", "rates", "duration", "refinancing", "inflation", "cpi", "pce"] },
  { tag: "oil", weight: 6, terms: ["oil", "crude", "brent", "wti", "hormuz", "opec", "iran", "refining", "refinery", "diesel", "gasoline", "crack", "barrel", "barrels"] },
  { tag: "ai", weight: 6, terms: ["ai", "nvidia", "nvda", "amd", "micron", "semiconductor", "semiconductors", "chip", "chips", "datacenter", "datacenters", "capex", "hyperscaler", "memory"] },
  { tag: "japan", weight: 6, terms: ["japan", "japanese", "yen", "jpy", "boj", "carry"] },
  { tag: "earnings", weight: 5, terms: ["earnings", "guidance", "revenue", "margin", "margins", "eps", "profit", "profits", "sales"] },
  { tag: "labour", weight: 5, terms: ["jobs", "jobless", "employment", "unemployment", "labour", "labor", "wage", "wages", "payroll", "payrolls", "claims"] },
  { tag: "breadth", weight: 5, terms: ["breadth", "participation", "advance", "decline", "decliners", "advancers", "equalweight", "equal-weight"] },
  { tag: "productivity", weight: 5, terms: ["productivity", "unit-labor", "unit-labour", "output", "hours", "efficiency"] },
  { tag: "healthcare", weight: 5, terms: ["healthcare", "biotech", "pharma", "moderna", "merck", "cancer", "melanoma", "vaccine"] },
  // Geography alone is too broad to route strongly, so China deliberately carries less weight.
  { tag: "china", weight: 3, terms: ["china", "chinese", "beijing"] },
];

const NAMED_ENTITIES: Array<{ canonical: string; terms: string[] }> = [
  { canonical: "SPX", terms: ["spx", "s&p 500", "s&p500", "sp500"] },
  { canonical: "NDX", terms: ["ndx", "nasdaq 100", "nasdaq100"] },
  { canonical: "USDJPY", terms: ["usdjpy", "usd/jpy"] },
  { canonical: "JPY", terms: ["jpy", "yen"] },
  { canonical: "DXY", terms: ["dxy", "dollar index"] },
  { canonical: "WTI", terms: ["wti", "west texas intermediate"] },
  { canonical: "BRENT", terms: ["brent"] },
  { canonical: "US02Y", terms: ["us02y", "2-year yield", "2 year yield", "two-year treasury", "2y treasury"] },
  { canonical: "US10Y", terms: ["us10y", "10-year yield", "10 year yield", "ten-year treasury", "10y treasury"] },
  { canonical: "US30Y", terms: ["us30y", "30-year yield", "30 year yield", "thirty-year treasury", "30y treasury"] },
  { canonical: "NVDA", terms: ["nvda", "nvidia"] },
  { canonical: "AMD", terms: ["amd", "advanced micro devices"] },
  { canonical: "MU", terms: ["mu", "micron"] },
];

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

export function sanitiseResearchText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(x?[0-9a-f]+);/gi, (_match, code: string) => {
      const radix = code.toLowerCase().startsWith("x") ? 16 : 10;
      const raw = radix === 16 ? code.slice(1) : code;
      const parsed = Number.parseInt(raw, radix);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : " ";
    })
    .replace(/&([a-z]+);/gi, (match, entity: string) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function normalise(value: string) {
  return sanitiseResearchText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9%$+./& -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalise(value)
    .split(/[\s/_.-]+/)
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token)));
}

function containsTerm(text: string, term: string) {
  const normalisedTerm = normalise(term);
  if (!normalisedTerm) return false;
  if (normalisedTerm.length <= 3 && /^[a-z0-9]+$/.test(normalisedTerm)) {
    return new RegExp(`(?:^|[^a-z0-9])${normalisedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(text);
  }
  return text.includes(normalisedTerm);
}

function topicWeights(text: string) {
  const result = new Map<string, number>();
  for (const family of TOPIC_FAMILIES) {
    if (family.terms.some((term) => containsTerm(text, term))) result.set(family.tag, family.weight);
  }
  return result;
}

function entityAliases(canonical: string) {
  return NAMED_ENTITIES.find((entity) => entity.canonical === canonical.toUpperCase())?.terms ?? [canonical];
}

function explicitEntityHits(text: string, assets: string[]) {
  const hits = new Set<string>();
  for (const asset of assets) {
    const cleaned = asset.trim();
    if (cleaned && entityAliases(cleaned).some((term) => containsTerm(text, term))) hits.add(cleaned.toUpperCase());
  }
  return [...hits];
}

/**
 * Attribute assets only when the source text actually names the instrument,
 * company or an accepted alias. Story membership by itself must never imply
 * that every asset attached to the Story was observed in this evidence item.
 */
export function mentionedStoryAssets(input: {
  title?: string | null;
  summary?: string | null;
  extraText?: string | null;
  candidateAssets: string[];
}) {
  const text = normalise([input.title, input.summary, input.extraText].filter(Boolean).join(" "));
  if (!text) return [];
  return explicitEntityHits(text, [...new Set(input.candidateAssets.filter(Boolean))]);
}

function storyProfile(story: RoutableStory) {
  return [
    story.slug.replace(/-/g, " "),
    story.title,
    story.thesis,
    story.marketQuestion,
    story.dominantNarrative,
    story.strongestSupport,
    story.strongestContradiction,
    story.confirmationTrigger,
    story.invalidationTrigger,
    story.nextCatalyst,
    ...(story.assets ?? []),
  ].filter((value): value is string => Boolean(value?.trim())).join(" ");
}

/**
 * Deterministic and deliberately conservative. The router is a recall aid, not
 * a thesis engine: it only says which existing Story should inspect an item.
 */
export function routeResearchItemToStories(input: {
  title?: string | null;
  summary?: string | null;
  extraText?: string | null;
  explicitStorySlugs?: string[] | null;
  stories: RoutableStory[];
  maxRoutes?: number;
}) {
  const cleanTitle = sanitiseResearchText(input.title);
  const cleanSummary = sanitiseResearchText(input.summary);
  const cleanExtra = sanitiseResearchText(input.extraText);
  const text = normalise([cleanTitle, cleanSummary, cleanExtra].filter(Boolean).join(" "));
  const evidenceTokens = tokens(text);
  const evidenceTopics = topicWeights(text);
  const validSlug = new Map(input.stories.map((story) => [story.slug, story]));
  const explicit = new Set((input.explicitStorySlugs ?? []).filter((slug) => validSlug.has(slug)));

  const routes: StoryRoute[] = input.stories.flatMap((story) => {
    if (explicit.has(story.slug)) {
      return [{ storyId: story.id, storySlug: story.slug, score: 100, reasons: ["explicit_story_link"] }];
    }

    const profile = normalise(storyProfile(story));
    const profileTokens = tokens(profile);
    const profileTopics = topicWeights(profile);
    const sharedTokens = [...evidenceTokens].filter((token) => profileTokens.has(token));
    const assetHits = explicitEntityHits(text, story.assets ?? []);
    const sharedTopics = [...evidenceTopics.entries()]
      .filter(([tag]) => profileTopics.has(tag))
      .map(([tag, weight]) => ({ tag, weight: Math.min(weight, profileTopics.get(tag) ?? weight) }));
    const slugTokens = [...tokens(story.slug.replace(/-/g, " "))];
    const slugHits = slugTokens.filter((token) => evidenceTokens.has(token));

    const score = (assetHits.length * 8)
      + sharedTopics.reduce((sum, topic) => sum + topic.weight, 0)
      + Math.min(7.2, sharedTokens.length * 1.2)
      + Math.min(4.5, slugHits.length * 1.5);

    // One broad topic family is not enough. Require either an actual named
    // asset/entity, two topic families, a strong slug anchor, or a topic plus
    // at least two Story-specific lexical overlaps.
    const anchored = assetHits.length > 0
      || sharedTopics.length >= 2
      || slugHits.length >= 2
      || (sharedTopics.length >= 1 && sharedTokens.length >= 2);
    if (!anchored || score < 6) return [];

    const reasons = [
      ...assetHits.map((asset) => `asset:${asset}`),
      ...sharedTopics.map((topic) => `topic:${topic.tag}`),
      ...(slugHits.length ? [`slug_tokens:${slugHits.join(",")}`] : []),
      ...(sharedTokens.length ? [`profile_overlap:${sharedTokens.slice(0, 6).join(",")}`] : []),
    ];
    return [{ storyId: story.id, storySlug: story.slug, score: Number(score.toFixed(2)), reasons }];
  });

  const maxRoutes = Math.max(1, Math.min(6, input.maxRoutes ?? 4));
  return routes
    .sort((left, right) => right.score - left.score || left.storySlug.localeCompare(right.storySlug))
    .slice(0, maxRoutes);
}

export function cleanEvidenceClaim(input: { title?: string | null; summary?: string | null }) {
  const summary = sanitiseResearchText(input.summary);
  const title = sanitiseResearchText(input.title);
  const placeholder = /transcript collection|claim verification (?:is )?pending|new monitored creator video discovered/i;
  if (summary && !placeholder.test(summary)) return summary;
  return title || summary;
}
