import type { AlchemyArticle } from "@/lib/alchemy";
import type { ChartRequest, MarketSeriesObservation, Update } from "@/lib/data";
import type { MarketSeries, PricePoint } from "@/lib/market";

export type ArticleIdeaStatus =
  | "active"
  | "likely_validated"
  | "likely_invalidated"
  | "target_hit"
  | "needs_review";

export type ArticleIdeaDirection = "bullish" | "bearish" | "ambiguous";
export type ArticleIdeaSource = "structured_chart" | "published_article";

export type ArticleChartIdea = {
  id: string;
  storyId: string | null;
  storyTitle: string;
  storyHref: string;
  instrument: string;
  timeframe: string;
  overlay: string | null;
  question: string;
  confirmationArea: string | null;
  invalidationArea: string | null;
  targetArea: string | null;
  direction: ArticleIdeaDirection;
  currentPrice: number | null;
  publicationPrice: number | null;
  sincePublication: number | null;
  change5d: number | null;
  change21d: number | null;
  status: ArticleIdeaStatus;
  statusReason: string;
  sourceName: string | null;
  sourceUrl: string | null;
  marketLabel: string | null;
  isProxy: boolean;
  ideaSource: ArticleIdeaSource;
  tradingViewUrl: string | null;
};

export type ArticleChangeDirection = "reinforced" | "mixed" | "challenged" | "invalidated" | "unchanged";
export type ArticleChangeLinkBasis = "exact" | "asset" | "none";

export type ArticleChangeRecord = {
  id: string;
  type: string;
  headline: string;
  detail: string | null;
  date: string;
  href: string;
  directionalWeight: number;
  intensityWeight: number;
};

export type ArticleChangeState = {
  load: number;
  direction: ArticleChangeDirection;
  updateCount: number;
  latestUpdateAt: string | null;
  summary: string;
  linkBasis: ArticleChangeLinkBasis;
  updates: ArticleChangeRecord[];
};

type ParsedRange = {
  min: number;
  max: number;
  values: number[];
};

type MarketMatch = {
  symbol: string;
  label: string;
  last: number | null;
  change5d: number | null;
  change21d: number | null;
  sourceName: string;
  sourceUrl: string;
  points: PricePoint[];
  comparableLevels: boolean;
  isProxy: boolean;
};

type ArticleInstrumentSpec = {
  instrument: string;
  aliases: string[];
};

const SYMBOL_ALIASES: Record<string, string[]> = {
  "^GSPC": ["SPX", "SP500", "S&P500", "S&P 500", "US500", "SPY"],
  RSP: ["RSP", "EQUAL WEIGHT"],
  "^IXIC": ["NASDAQ", "NASDAQ COMPOSITE", "NAS100", "NDX", "QQQ", "US100"],
  SOXX: ["SOXX", "SEMICONDUCTORS", "SEMIS", "CHIP STOCKS"],
  GLD: ["GOLD", "XAUUSD", "XAU", "GLD"],
  SLV: ["SILVER", "XAGUSD", "XAG", "SLV"],
  CPER: ["COPPER", "CPER"],
  UUP: ["DXY", "US DOLLAR", "DOLLAR INDEX", "UUP"],
  FXE: ["EURUSD", "EUR/USD", "EURO", "FXE"],
  FXB: ["GBPUSD", "GBP/USD", "STERLING", "POUND", "FXB"],
  FXC: ["USDCAD", "USD/CAD", "CANADIAN DOLLAR", "FXC"],
  EWJ: ["NIKKEI", "JAPAN EQUITIES", "EWJ"],
  "CL=F": ["WTI", "USOIL", "US OIL", "CRUDE OIL", "CRUDE", "OIL"],
  "BZ=F": ["BRENT", "UKOIL", "UK OIL"],
};

const ARTICLE_INSTRUMENTS: ArticleInstrumentSpec[] = [
  { instrument: "GOOGL", aliases: ["GOOGL", "ALPHABET", "GOOGLE"] },
  { instrument: "MSFT", aliases: ["MSFT", "MICROSOFT"] },
  { instrument: "META", aliases: ["META", "META PLATFORMS"] },
  { instrument: "AMZN", aliases: ["AMZN", "AMAZON"] },
  { instrument: "AAPL", aliases: ["AAPL", "APPLE"] },
  { instrument: "AMD", aliases: ["AMD", "ADVANCED MICRO DEVICES"] },
  { instrument: "NVDA", aliases: ["NVDA", "NVIDIA"] },
  { instrument: "TSLA", aliases: ["TSLA", "TESLA"] },
  { instrument: "XLK", aliases: ["XLK", "TECHNOLOGY SELECT SECTOR"] },
  { instrument: "SOXX", aliases: ["SOXX", "SEMICONDUCTOR ETF", "SEMICONDUCTORS", "SEMIS"] },
  { instrument: "SPX", aliases: ["S&P 500", "S&P500", "SPX", "US500"] },
  { instrument: "NASDAQ", aliases: ["NASDAQ", "NAS100", "NDX", "US100"] },
  { instrument: "KOSPI", aliases: ["KOSPI"] },
  { instrument: "NIKKEI", aliases: ["NIKKEI", "JAPAN STOCKS", "JAPANESE STOCKS"] },
  { instrument: "FTSE100", aliases: ["FTSE 100", "FTSE100", "UK100"] },
  { instrument: "XAUUSD", aliases: ["XAUUSD", "XAU/USD", "GOLD"] },
  { instrument: "XAGUSD", aliases: ["XAGUSD", "XAG/USD", "SILVER"] },
  { instrument: "WTI", aliases: ["WTI", "USOIL", "US OIL", "CRUDE OIL"] },
  { instrument: "BRENT", aliases: ["BRENT", "UKOIL", "UK OIL"] },
  { instrument: "DXY", aliases: ["DXY", "DOLLAR INDEX", "US DOLLAR INDEX"] },
  { instrument: "USDJPY", aliases: ["USDJPY", "USD/JPY"] },
  { instrument: "GBPJPY", aliases: ["GBPJPY", "GBP/JPY"] },
  { instrument: "AUDJPY", aliases: ["AUDJPY", "AUD/JPY"] },
  { instrument: "EURUSD", aliases: ["EURUSD", "EUR/USD"] },
  { instrument: "GBPUSD", aliases: ["GBPUSD", "GBP/USD"] },
  { instrument: "USDCHF", aliases: ["USDCHF", "USD/CHF"] },
  { instrument: "USDCAD", aliases: ["USDCAD", "USD/CAD"] },
  { instrument: "US10Y", aliases: ["US10Y", "US 10-YEAR", "10-YEAR YIELD", "10 YEAR YIELD"] },
  { instrument: "US30Y", aliases: ["US30Y", "US 30-YEAR", "30-YEAR YIELD", "30 YEAR YIELD"] },
  { instrument: "BTCUSD", aliases: ["BTCUSD", "BTC/USD", "BITCOIN"] },
];

function normalise(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function containsAlias(text: string, alias: string) {
  const normalisedText = normalise(text);
  const normalisedAlias = normalise(alias);
  return normalisedAlias.length >= 3 && normalisedText.includes(normalisedAlias);
}

function numericValues(value: string | null) {
  if (!value) return [];
  const withoutIndicators = value
    .replace(/\b(?:EMA|SMA|MA|RSI|ATR|VWAP)\s*\(?\s*\d+(?:\.\d+)?\s*\)?/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:day|week|month|hour|minute)s?\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:D|W|M|H|min)\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/-?\d[\d,]*(?:\.\d+)?\s*(?:%|bp|bps|basis points?)\b/gi, " ");

  return Array.from(withoutIndicators.matchAll(/-?\d[\d,]*(?:\.\d+)?/g))
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter((number) => Number.isFinite(number) && Math.abs(number) > 0.00001);
}

function parseRange(value: string | null): ParsedRange | null {
  const values = numericValues(value);
  if (!values.length) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    values,
  };
}

function inferDirection(confirmation: ParsedRange | null, invalidation: ParsedRange | null): ArticleIdeaDirection {
  if (!confirmation || !invalidation) return "ambiguous";
  if (confirmation.min > invalidation.max) return "bullish";
  if (confirmation.max < invalidation.min) return "bearish";
  return "ambiguous";
}

function seriesMatchScore(instrument: string, series: MarketSeries) {
  const needle = normalise(instrument);
  if (!needle) return 0;
  const symbol = normalise(series.symbol);
  const label = normalise(series.label);
  if (needle === symbol) return 100;
  if (needle === label) return 95;
  if (symbol && (needle.includes(symbol) || symbol.includes(needle))) return 82;
  if (label && (needle.includes(label) || label.includes(needle))) return 74;

  const aliases = SYMBOL_ALIASES[series.symbol] || [];
  for (const alias of aliases) {
    const normalisedAlias = normalise(alias);
    if (needle === normalisedAlias) return 96;
    if (needle.includes(normalisedAlias) || normalisedAlias.includes(needle)) return 78;
  }
  return 0;
}

function observationMatch(instrument: string, observations: MarketSeriesObservation[]) {
  const needle = normalise(instrument);
  const rows = observations
    .map((row) => {
      const symbol = normalise(row.symbol);
      const name = normalise(row.series_name);
      let score = 0;
      if (needle === symbol) score = 110;
      else if (needle === name) score = 105;
      else if (symbol && (needle.includes(symbol) || symbol.includes(needle))) score = 80;
      else if (name && (needle.includes(name) || name.includes(needle))) score = 70;
      return { row, score, exact: score >= 105 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.row.observation_date.localeCompare(a.row.observation_date));
  return rows[0] || null;
}

export function findMarketSeries(
  instrument: string,
  series: MarketSeries[],
  observations: MarketSeriesObservation[],
): MarketMatch | null {
  const observation = observationMatch(instrument, observations);
  if (observation?.exact) {
    return {
      symbol: observation.row.symbol,
      label: observation.row.series_name,
      last: observation.row.close,
      change5d: null,
      change21d: null,
      sourceName: observation.row.provider,
      sourceUrl: observation.row.source_url,
      points: [],
      comparableLevels: true,
      isProxy: false,
    };
  }

  const ranked = series
    .map((item) => ({ item, score: seriesMatchScore(instrument, item) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked[0]?.item) {
    const exact = normalise(instrument) === normalise(ranked[0].item.symbol)
      || normalise(instrument) === normalise(ranked[0].item.label);
    const proxyLabel = /proxy/i.test(ranked[0].item.label)
      || (!exact && Boolean(SYMBOL_ALIASES[ranked[0].item.symbol]));
    return {
      symbol: ranked[0].item.symbol,
      label: ranked[0].item.label,
      last: ranked[0].item.last,
      change5d: ranked[0].item.change5d,
      change21d: ranked[0].item.change21d,
      sourceName: ranked[0].item.sourceName,
      sourceUrl: ranked[0].item.sourceUrl,
      points: ranked[0].item.points,
      comparableLevels: exact && !/proxy/i.test(ranked[0].item.label),
      isProxy: proxyLabel,
    };
  }

  if (!observation) return null;
  return {
    symbol: observation.row.symbol,
    label: observation.row.series_name,
    last: observation.row.close,
    change5d: null,
    change21d: null,
    sourceName: observation.row.provider,
    sourceUrl: observation.row.source_url,
    points: [],
    comparableLevels: observation.exact,
    isProxy: !observation.exact,
  };
}

function priceAtPublication(points: PricePoint[], publishedAt: string | null) {
  if (!publishedAt || !points.length) return null;
  const publishedSeconds = new Date(publishedAt).getTime() / 1000;
  if (!Number.isFinite(publishedSeconds)) return null;
  let nearest: PricePoint | null = null;
  let smallestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.abs(point.time - publishedSeconds);
    if (distance < smallestDistance) {
      nearest = point;
      smallestDistance = distance;
    }
  }
  return nearest?.close ?? null;
}

function percentageChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function assessLevels(
  currentPrice: number | null,
  direction: ArticleIdeaDirection,
  confirmation: ParsedRange | null,
  invalidation: ParsedRange | null,
  target: ParsedRange | null,
  comparableLevels: boolean,
) {
  if (currentPrice === null || !comparableLevels || direction === "ambiguous") return null;
  if (direction === "bullish") {
    if (target && currentPrice >= target.min) return { status: "target_hit" as const, reason: "Current price has reached or exceeded the published target area." };
    if (invalidation && currentPrice <= invalidation.max) return { status: "likely_invalidated" as const, reason: "Current price is at or below the published invalidation or support area." };
    if (confirmation && currentPrice >= confirmation.min) return { status: "likely_validated" as const, reason: "Current price has reached or exceeded the published confirmation or resistance area." };
  }
  if (direction === "bearish") {
    if (target && currentPrice <= target.max) return { status: "target_hit" as const, reason: "Current price has reached or moved below the published downside target area." };
    if (invalidation && currentPrice >= invalidation.min) return { status: "likely_invalidated" as const, reason: "Current price is at or above the published invalidation or resistance area." };
    if (confirmation && currentPrice <= confirmation.max) return { status: "likely_validated" as const, reason: "Current price has reached or moved below the published confirmation or support area." };
  }
  return { status: "active" as const, reason: "Current price remains between the published confirmation, target and invalidation areas." };
}

export function assessChartIdea(
  chart: ChartRequest,
  storyTitle: string,
  storyHref: string,
  marketSeries: MarketSeries[],
  observations: MarketSeriesObservation[],
): ArticleChartIdea {
  const confirmation = parseRange(chart.confirmation_area);
  const invalidation = parseRange(chart.invalidation_area);
  const direction = inferDirection(confirmation, invalidation);
  const market = findMarketSeries(chart.instrument, marketSeries, observations);
  const currentPrice = market?.last ?? null;
  const levelAssessment = assessLevels(currentPrice, direction, confirmation, invalidation, null, market?.comparableLevels ?? false);

  let status: ArticleIdeaStatus = levelAssessment?.status || "needs_review";
  let statusReason = levelAssessment?.reason || "A directly comparable current price and clearly separated confirmation and invalidation levels are required for an automated assessment.";

  if (currentPrice === null) {
    statusReason = "No current market series could be matched to the recorded instrument.";
  } else if (market?.isProxy) {
    statusReason = `Current market context uses ${market.label}; published numeric levels are not compared with a proxy instrument.`;
  } else if (!confirmation || !invalidation) {
    statusReason = "The chart request does not contain parseable confirmation and invalidation price levels.";
  } else if (direction === "ambiguous") {
    statusReason = "The recorded levels do not establish a clear bullish or bearish direction without analyst review.";
  }

  return {
    id: chart.id,
    storyId: chart.story_id,
    storyTitle,
    storyHref,
    instrument: chart.instrument,
    timeframe: chart.timeframe,
    overlay: chart.overlay,
    question: chart.question,
    confirmationArea: chart.confirmation_area,
    invalidationArea: chart.invalidation_area,
    targetArea: null,
    direction,
    currentPrice,
    publicationPrice: null,
    sincePublication: null,
    change5d: market?.change5d ?? null,
    change21d: market?.change21d ?? null,
    status,
    statusReason,
    sourceName: market?.sourceName ?? null,
    sourceUrl: market?.sourceUrl ?? null,
    marketLabel: market?.label ?? null,
    isProxy: market?.isProxy ?? false,
    ideaSource: "structured_chart",
    tradingViewUrl: null,
  };
}

function articleInstrumentScore(article: AlchemyArticle, spec: ArticleInstrumentSpec) {
  let score = 0;
  for (const alias of spec.aliases) {
    if (containsAlias(article.title, alias)) score += 100;
    if (containsAlias(article.summary, alias)) score += 45;
    if (containsAlias(article.bodyText.slice(0, 12_000), alias)) score += 12;
  }
  return score;
}

function articleInstruments(article: AlchemyArticle) {
  return ARTICLE_INSTRUMENTS
    .map((spec) => ({ spec, score: articleInstrumentScore(article, spec) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, article.category === "Chart of the Day" ? 2 : 4)
    .map((item) => item.spec);
}

function relevantLines(article: AlchemyArticle, spec: ArticleInstrumentSpec) {
  const lines = [article.title, article.summary, ...article.bodyText.split(/\n+/)]
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const direct = lines.filter((line) => spec.aliases.some((alias) => containsAlias(line, alias)));
  const technical = lines.filter((line) => /support|resistance|target|toward|towards|reach|reclaim|break(?:out)?|close (?:above|below)|invalidat|fail|bullish|bearish|upside|downside/i.test(line));
  return [...new Set([...direct, ...technical])].slice(0, 60);
}

function lineWithRange(lines: string[], pattern: RegExp) {
  const line = lines.find((candidate) => pattern.test(candidate) && numericValues(candidate).length);
  return line || null;
}

function inferArticleDirection(article: AlchemyArticle, target: ParsedRange | null, currentPrice: number | null) {
  if (target && currentPrice !== null) {
    if (target.min > currentPrice) return "bullish" as const;
    if (target.max < currentPrice) return "bearish" as const;
  }
  const text = `${article.title} ${article.summary}`.toLowerCase();
  const bullish = (text.match(/bullish|break(?:s|ing)? (?:out|higher|above)|rall(?:y|ies)|rebound|reclaim|upside|record high|target(?:s|ing)? higher/g) || []).length;
  const bearish = (text.match(/bearish|break(?:s|ing)? (?:down|lower|below)|sell-?off|slip(?:s|ping)?|fall(?:s|ing)?|unwind|downside|reject(?:s|ion)?|fade/g) || []).length;
  if (bullish > bearish) return "bullish" as const;
  if (bearish > bullish) return "bearish" as const;
  return "ambiguous" as const;
}

function nativeStatus(
  direction: ArticleIdeaDirection,
  market: MarketMatch | null,
  publicationPrice: number | null,
  sincePublication: number | null,
  confirmation: ParsedRange | null,
  invalidation: ParsedRange | null,
  target: ParsedRange | null,
) {
  const levelAssessment = assessLevels(
    market?.last ?? null,
    direction,
    confirmation,
    invalidation,
    target,
    market?.comparableLevels ?? false,
  );
  if (levelAssessment && (levelAssessment.status !== "active" || confirmation || invalidation || target)) return levelAssessment;

  if (!market || market.last === null) {
    return { status: "needs_review" as const, reason: "No current market series could be matched to the article’s primary instrument." };
  }
  if (direction === "ambiguous") {
    return { status: "needs_review" as const, reason: "The published article does not establish one clear directional idea for an automated price check." };
  }
  if (publicationPrice === null || sincePublication === null) {
    return {
      status: "needs_review" as const,
      reason: market.isProxy
        ? `Current context is available through ${market.label}, but a publication-date return could not be calculated.`
        : "The publication-date price required for a direction check is unavailable.",
    };
  }

  const validationMove = direction === "bullish" ? sincePublication : -sincePublication;
  if (validationMove >= 2) {
    return {
      status: "likely_validated" as const,
      reason: `${market.isProxy ? "The matched proxy" : "The instrument"} has moved ${Math.abs(sincePublication).toFixed(1)}% in the published direction since the article date.`,
    };
  }
  if (validationMove <= -2) {
    return {
      status: "likely_invalidated" as const,
      reason: `${market.isProxy ? "The matched proxy" : "The instrument"} has moved ${Math.abs(sincePublication).toFixed(1)}% against the published direction since the article date.`,
    };
  }
  return {
    status: "active" as const,
    reason: `${market.isProxy ? "The matched proxy" : "The instrument"} remains within 2% of its publication-date price, so the directional idea is still unresolved.`,
  };
}

export function extractArticleChartIdeas(
  article: AlchemyArticle,
  marketSeries: MarketSeries[],
  observations: MarketSeriesObservation[],
): ArticleChartIdea[] {
  return articleInstruments(article).map((spec, index) => {
    const lines = relevantLines(article, spec);
    const targetArea = lineWithRange(lines, /\btarget|toward|towards|reach|reclaim|objective|opens? the door|next (?:resistance|support)/i);
    const supportArea = lineWithRange(lines, /\bsupport|floor|hold(?:s|ing)? above|close below|lose(?:s|ing)?/i);
    const resistanceArea = lineWithRange(lines, /\bresistance|ceiling|close above|break(?:s|ing)? above|reject(?:s|ion)?/i);
    const explicitInvalidation = lineWithRange(lines, /invalidat|fails? (?:above|below|to hold)|close back|break back/i);
    const market = findMarketSeries(spec.instrument, marketSeries, observations);
    const currentPrice = market?.last ?? null;
    const target = parseRange(targetArea);
    const direction = inferArticleDirection(article, target, market?.comparableLevels ? currentPrice : null);
    const confirmationArea = direction === "bearish" ? supportArea : resistanceArea;
    const invalidationArea = explicitInvalidation || (direction === "bearish" ? resistanceArea : supportArea);
    const confirmation = parseRange(confirmationArea);
    const invalidation = parseRange(invalidationArea);
    const publicationPrice = priceAtPublication(market?.points || [], article.publishedAt);
    const sincePublication = percentageChange(currentPrice, publicationPrice);
    const assessment = nativeStatus(direction, market, publicationPrice, sincePublication, confirmation, invalidation, target);

    return {
      id: `${article.id}-native-${spec.instrument.toLowerCase()}-${index}`,
      storyId: null,
      storyTitle: "Published article idea",
      storyHref: article.url,
      instrument: spec.instrument,
      timeframe: article.category,
      overlay: article.tradingViewLinks.length ? `${article.tradingViewLinks.length} TradingView link${article.tradingViewLinks.length === 1 ? "" : "s"} found` : null,
      question: article.summary,
      confirmationArea,
      invalidationArea,
      targetArea,
      direction,
      currentPrice,
      publicationPrice,
      sincePublication,
      change5d: market?.change5d ?? null,
      change21d: market?.change21d ?? null,
      status: assessment.status,
      statusReason: assessment.reason,
      sourceName: market?.sourceName ?? null,
      sourceUrl: market?.sourceUrl ?? null,
      marketLabel: market?.label ?? null,
      isProxy: market?.isProxy ?? false,
      ideaSource: "published_article",
      tradingViewUrl: article.tradingViewLinks[0] || null,
    };
  });
}

export function instrumentMatchesAsset(instrument: string, asset: string) {
  const needle = normalise(instrument);
  const candidate = normalise(asset);
  if (!needle || !candidate) return false;
  if (needle === candidate) return true;
  const spec = ARTICLE_INSTRUMENTS.find((item) => item.instrument === instrument);
  if (spec?.aliases.some((alias) => normalise(alias) === candidate)) return true;
  return false;
}

function updateWeights(type: string) {
  const value = type.toLowerCase();
  if (value === "confirmation") return { directional: 2, intensity: 2 };
  if (value === "contradiction") return { directional: -2, intensity: 2 };
  if (value === "invalidation") return { directional: -4, intensity: 4 };
  if (value === "thesis_revision") return { directional: 0, intensity: 3 };
  if (value === "evidence" || value === "evidence_update") return { directional: 0, intensity: 1 };
  if (value === "catalyst") return { directional: 0, intensity: 1 };
  return { directional: 0, intensity: 1 };
}

export function assessArticleChanges(
  publishedAt: string | null,
  linkedStories: Array<{ id: string; slug: string }>,
  updates: Update[],
  linkBasis: ArticleChangeLinkBasis = linkedStories.length ? "exact" : "none",
): ArticleChangeState {
  if (!publishedAt || !linkedStories.length) {
    return {
      load: 0,
      direction: "unchanged",
      updateCount: 0,
      latestUpdateAt: null,
      summary: linkedStories.length
        ? "The article publication time is unavailable, so post-publication change cannot be isolated."
        : "No exact or asset-matched Story link is recorded for this article.",
      linkBasis: linkedStories.length ? linkBasis : "none",
      updates: [],
    };
  }

  const publishedTime = new Date(publishedAt).getTime();
  const storyById = new Map(linkedStories.map((story) => [story.id, story]));
  const records = updates
    .filter((update) => storyById.has(update.story_id))
    .filter((update) => new Date(update.observed_at || update.created_at).getTime() > publishedTime)
    .sort((a, b) => new Date(b.observed_at || b.created_at).getTime() - new Date(a.observed_at || a.created_at).getTime())
    .map((update) => {
      const weights = updateWeights(update.update_type);
      const story = storyById.get(update.story_id)!;
      return {
        id: update.id,
        type: update.update_type,
        headline: update.headline,
        detail: update.detail,
        date: update.observed_at || update.created_at,
        href: `/stories/${story.slug}#event-${update.id}`,
        directionalWeight: weights.directional,
        intensityWeight: weights.intensity,
      };
    });

  if (!records.length) {
    return {
      load: 0,
      direction: "unchanged",
      updateCount: 0,
      latestUpdateAt: null,
      summary: linkBasis === "asset"
        ? "No post-publication updates are recorded in the Stories sharing this article’s identified assets."
        : "No linked post-publication Story changes are currently recorded.",
      linkBasis,
      updates: [],
    };
  }

  const directionalTotal = records.reduce((sum, update) => sum + update.directionalWeight, 0);
  const hasPositive = records.some((update) => update.directionalWeight > 0);
  const hasNegative = records.some((update) => update.directionalWeight < 0);
  const hasInvalidation = records.some((update) => update.type.toLowerCase() === "invalidation");
  const intensityTotal = records.reduce((sum, update) => sum + update.intensityWeight, 0);
  const load = Math.min(100, Math.round((1 - Math.exp(-intensityTotal / 5)) * 100));

  let direction: ArticleChangeDirection = "unchanged";
  if (hasInvalidation) direction = "invalidated";
  else if (hasPositive && hasNegative) direction = "mixed";
  else if (directionalTotal > 0) direction = "reinforced";
  else if (directionalTotal < 0) direction = "challenged";
  else direction = "mixed";

  const label: Record<ArticleChangeDirection, string> = {
    reinforced: "Subsequent linked evidence has mainly reinforced the original Story.",
    mixed: "Subsequent linked records contain material updates without one clear directional conclusion.",
    challenged: "Subsequent linked evidence has mainly challenged the original Story.",
    invalidated: "A linked Story invalidation has been recorded after publication.",
    unchanged: "No material post-publication change is recorded.",
  };

  return {
    load,
    direction,
    updateCount: records.length,
    latestUpdateAt: records[0]?.date || null,
    summary: `${label[direction]} ${linkBasis === "asset" ? "The relationship is based on shared recorded assets, not an exact article-to-Story link." : ""}`.trim(),
    linkBasis,
    updates: records.slice(0, 6),
  };
}
