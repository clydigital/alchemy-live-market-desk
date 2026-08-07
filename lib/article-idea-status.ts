import type { ChartRequest, MarketSeriesObservation, Update } from "@/lib/data";
import type { MarketSeries } from "@/lib/market";

export type ArticleIdeaStatus =
  | "active"
  | "likely_validated"
  | "likely_invalidated"
  | "target_hit"
  | "needs_review";

export type ArticleIdeaDirection = "bullish" | "bearish" | "ambiguous";

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
  direction: ArticleIdeaDirection;
  currentPrice: number | null;
  change5d: number | null;
  change21d: number | null;
  status: ArticleIdeaStatus;
  statusReason: string;
  sourceName: string | null;
  sourceUrl: string | null;
};

export type ArticleChangeDirection = "reinforced" | "mixed" | "challenged" | "invalidated" | "unchanged";

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
  updates: ArticleChangeRecord[];
};

type ParsedRange = {
  min: number;
  max: number;
  values: number[];
};

const SYMBOL_ALIASES: Record<string, string[]> = {
  "^GSPC": ["SPX", "SP500", "S&P500", "S&P 500", "US500", "SPY"],
  "^IXIC": ["NASDAQ", "NASDAQCOMPOSITE", "NAS100", "NDX", "QQQ", "US100"],
  SOXX: ["SOXX", "SEMICONDUCTORS", "SEMIS"],
  GLD: ["GOLD", "XAUUSD", "XAU", "GLD"],
  SLV: ["SILVER", "XAGUSD", "XAG", "SLV"],
  UUP: ["DXY", "USD", "US DOLLAR", "UUP"],
  FXE: ["EURUSD", "EURO", "FXE"],
  FXB: ["GBPUSD", "STERLING", "POUND", "FXB"],
  EWJ: ["NIKKEI", "JAPAN", "EWJ"],
  "CL=F": ["WTI", "USOIL", "CRUDE", "OIL", "CL"],
  "BZ=F": ["BRENT", "UKOIL", "BZ"],
};

function normalise(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function numericValues(value: string | null) {
  if (!value) return [];
  const withoutIndicators = value
    .replace(/\b(?:EMA|SMA|MA|RSI|ATR|VWAP)\s*\(?\s*\d+(?:\.\d+)?\s*\)?/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:day|week|month|hour|minute)s?\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:D|W|M|H|min)\b/gi, " ");

  return Array.from(withoutIndicators.matchAll(/-?\d[\d,]*(?:\.\d+)?/g))
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter((number) => Number.isFinite(number));
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

function fallbackObservationMatch(instrument: string, observations: MarketSeriesObservation[]) {
  const needle = normalise(instrument);
  const rows = observations
    .map((row) => {
      const symbol = normalise(row.symbol);
      const name = normalise(row.series_name);
      let score = 0;
      if (needle === symbol) score = 100;
      else if (needle === name) score = 95;
      else if (symbol && (needle.includes(symbol) || symbol.includes(needle))) score = 80;
      else if (name && (needle.includes(name) || name.includes(needle))) score = 70;
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.row.observation_date.localeCompare(a.row.observation_date));
  return rows[0]?.row || null;
}

export function findMarketSeries(
  instrument: string,
  series: MarketSeries[],
  observations: MarketSeriesObservation[],
) {
  const ranked = series
    .map((item) => ({ item, score: seriesMatchScore(instrument, item) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked[0]?.item) {
    return {
      last: ranked[0].item.last,
      change5d: ranked[0].item.change5d,
      change21d: ranked[0].item.change21d,
      sourceName: ranked[0].item.sourceName,
      sourceUrl: ranked[0].item.sourceUrl,
    };
  }

  const observation = fallbackObservationMatch(instrument, observations);
  if (!observation) return null;
  return {
    last: observation.close,
    change5d: null,
    change21d: null,
    sourceName: observation.provider,
    sourceUrl: observation.source_url,
  };
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

  let status: ArticleIdeaStatus = "needs_review";
  let statusReason = "A current price and clearly separated confirmation and invalidation levels are required for an automated assessment.";

  if (currentPrice !== null && confirmation && invalidation && direction === "bullish") {
    if (currentPrice <= invalidation.max) {
      status = "likely_invalidated";
      statusReason = `Current price is at or below the recorded invalidation area (${chart.invalidation_area}).`;
    } else if (currentPrice >= confirmation.min) {
      status = "likely_validated";
      statusReason = `Current price has reached or exceeded the recorded confirmation area (${chart.confirmation_area}).`;
    } else {
      status = "active";
      statusReason = "Current price remains between the recorded bullish confirmation and invalidation areas.";
    }
  } else if (currentPrice !== null && confirmation && invalidation && direction === "bearish") {
    if (currentPrice >= invalidation.min) {
      status = "likely_invalidated";
      statusReason = `Current price is at or above the recorded invalidation area (${chart.invalidation_area}).`;
    } else if (currentPrice <= confirmation.max) {
      status = "likely_validated";
      statusReason = `Current price has reached or moved below the recorded confirmation area (${chart.confirmation_area}).`;
    } else {
      status = "active";
      statusReason = "Current price remains between the recorded bearish confirmation and invalidation areas.";
    }
  } else if (currentPrice === null) {
    statusReason = "No current market series could be matched to the recorded instrument.";
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
    direction,
    currentPrice,
    change5d: market?.change5d ?? null,
    change21d: market?.change21d ?? null,
    status,
    statusReason,
    sourceName: market?.sourceName ?? null,
    sourceUrl: market?.sourceUrl ?? null,
  };
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
): ArticleChangeState {
  if (!publishedAt || !linkedStories.length) {
    return {
      load: 0,
      direction: "unchanged",
      updateCount: 0,
      latestUpdateAt: null,
      summary: linkedStories.length
        ? "The article publication time is unavailable, so post-publication change cannot be isolated."
        : "No explicit Story link is recorded for this article.",
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
      summary: "No linked post-publication Story changes are currently recorded.",
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
    summary: label[direction],
    updates: records.slice(0, 6),
  };
}
