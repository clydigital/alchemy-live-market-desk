import type { AlchemyArticle } from "@/lib/alchemy";
import { findMarketSeries, type ArticleChartIdea, type ArticleIdeaDirection, type ArticleIdeaStatus } from "@/lib/article-idea-status";
import type { MarketSeriesObservation } from "@/lib/data";
import type { MarketSeries, PricePoint } from "@/lib/market";
import { containsInstrumentAlias, explicitlyMentionedInstrumentSpecs } from "@/lib/instrument-mentions";

type InstrumentSpec = { instrument: string; aliases: readonly string[] };
type ParsedRange = { min: number; max: number; values: number[] };
type TriggerMode = "above" | "below" | "reject";

type ScenarioSeed = {
  direction: Exclude<ArticleIdeaDirection, "ambiguous">;
  mode: TriggerMode;
  label: string;
  triggerLine: string;
  targetLine: string | null;
  invalidationLine: string | null;
};

function containsAlias(text: string, alias: string) {
  return containsInstrumentAlias(text, alias);
}

function numericValues(value: string | null) {
  if (!value) return [];
  const cleaned = value
    .replace(/\b(?:EMA|SMA|MA|RSI|ATR|VWAP)\s*\(?\s*\d+(?:\.\d+)?\s*\)?/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:day|week|month|hour|minute)s?\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:D|W|M|H|min)\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/-?\d[\d,]*(?:\.\d+)?\s*(?:%|bp|bps|basis points?)\b/gi, " ");

  return Array.from(cleaned.matchAll(/-?\d[\d,]*(?:\.\d+)?/g))
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter((number) => Number.isFinite(number) && Math.abs(number) > 0.00001);
}

function parseRange(value: string | null): ParsedRange | null {
  const values = numericValues(value);
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values), values };
}

function formatLevel(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 4,
  }).format(value);
}

function levelLabel(line: string | null) {
  const range = parseRange(line);
  if (!range) return null;
  if (range.values.length === 1 || range.min === range.max) return formatLevel(range.values[0]);
  return `${formatLevel(range.min)}–${formatLevel(range.max)}`;
}

function articleInstrumentScore(article: AlchemyArticle, spec: InstrumentSpec) {
  let score = 0;
  for (const alias of spec.aliases) {
    if (containsAlias(article.title, alias)) score += 100;
    if (containsAlias(article.summary, alias)) score += 45;
    if (containsAlias(article.bodyText.slice(0, 12_000), alias)) score += 12;
  }
  return score;
}

function articleInstruments(article: AlchemyArticle) {
  return explicitlyMentionedInstrumentSpecs(`${article.title}\n${article.summary}\n${article.bodyText}`)
    .map((spec) => ({ spec, score: articleInstrumentScore(article, spec) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, article.category === "Chart of the Day" ? 2 : 4)
    .map((item) => item.spec);
}

function relevantLines(article: AlchemyArticle, spec: InstrumentSpec) {
  const lines = [article.title, article.summary, ...article.bodyText.split(/\n+/)]
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const direct = lines.filter((line) => spec.aliases.some((alias) => containsAlias(line, alias)));
  const technical = lines.filter((line) => /support|resistance|target|toward|towards|reach|reclaim|break(?:out)?|close (?:above|below)|invalidat|fail|reject|hold|lose|bullish|bearish|upside|downside/i.test(line));
  return [...new Set([...direct, ...technical])].filter((line) => numericValues(line).length).slice(0, 70);
}

function firstLine(lines: string[], pattern: RegExp) {
  return lines.find((line) => pattern.test(line)) || null;
}

function chooseTarget(lines: string[], direction: "bullish" | "bearish", trigger: ParsedRange | null) {
  const candidates = lines.filter((line) => /\btarget|toward|towards|objective|next resistance|next support|opens? the door|room (?:to|toward)/i.test(line));
  if (!candidates.length) return null;
  if (!trigger) return candidates[0];
  const ranked = candidates
    .map((line) => ({ line, range: parseRange(line) }))
    .filter((item): item is { line: string; range: ParsedRange } => Boolean(item.range))
    .filter((item) => direction === "bullish" ? item.range.max > trigger.max : item.range.min < trigger.min)
    .sort((a, b) => direction === "bullish" ? a.range.min - b.range.min : b.range.max - a.range.max);
  return ranked[0]?.line || candidates[0];
}

function scenarioSeeds(lines: string[]) {
  const support = firstLine(lines, /\bsupport|\bfloor|hold(?:s|ing)? (?:above|near)|demand zone/i);
  const resistance = firstLine(lines, /\bresistance|\bceiling|supply zone/i);
  const bullishBreak = firstLine(lines, /reclaim(?:s|ed|ing)?|break(?:s|ing)? (?:above|higher)|close(?:s|d)? above|bullish (?:above|break|reclaim)|upside (?:above|break)/i);
  const bearishBreak = firstLine(lines, /lose(?:s|d|ing)?|break(?:s|ing)? (?:below|lower)|close(?:s|d)? below|bearish (?:below|break)|downside (?:below|break)/i);
  const rejection = firstLine(lines, /reject(?:s|ed|ion|ing)? (?:at|from|near)?|fails? (?:at|near|below) .*resistance/i);
  const explicitInvalidation = firstLine(lines, /invalidat|fails? (?:above|below|to hold)|close back|break back/i);

  const seeds: ScenarioSeed[] = [];

  const bullishTrigger = bullishBreak || resistance;
  if (bullishTrigger) {
    const trigger = parseRange(bullishTrigger);
    seeds.push({
      direction: "bullish",
      mode: "above",
      label: bullishBreak ? "Bullish case · break/reclaim" : "Bullish case · break resistance",
      triggerLine: bullishTrigger,
      targetLine: chooseTarget(lines, "bullish", trigger),
      invalidationLine: explicitInvalidation || support,
    });
  }

  if (rejection) {
    const trigger = parseRange(rejection);
    seeds.push({
      direction: "bearish",
      mode: "reject",
      label: "Bearish case · rejection",
      triggerLine: rejection,
      targetLine: chooseTarget(lines, "bearish", trigger),
      invalidationLine: explicitInvalidation || firstLine(lines, /break(?:s|ing)? above|close(?:s|d)? above|reclaim/i),
    });
  }

  const bearishTrigger = bearishBreak || support;
  if (bearishTrigger && (!rejection || levelLabel(bearishTrigger) !== levelLabel(rejection))) {
    const trigger = parseRange(bearishTrigger);
    seeds.push({
      direction: "bearish",
      mode: "below",
      label: bearishBreak ? "Bearish case · break/loss" : "Bearish case · break support",
      triggerLine: bearishTrigger,
      targetLine: chooseTarget(lines, "bearish", trigger),
      invalidationLine: explicitInvalidation || resistance,
    });
  }

  return seeds.filter((seed, index, array) => {
    const key = `${seed.direction}:${seed.mode}:${levelLabel(seed.triggerLine)}`;
    return array.findIndex((other) => `${other.direction}:${other.mode}:${levelLabel(other.triggerLine)}` === key) === index;
  }).slice(0, 3);
}

function postPublicationPoints(points: PricePoint[], publishedAt: string | null) {
  if (!points.length || !publishedAt) return [];
  const start = new Date(publishedAt).getTime() / 1000;
  if (!Number.isFinite(start)) return [];
  return points.filter((point) => point.time >= start).sort((a, b) => a.time - b.time);
}

function crossed(close: number, range: ParsedRange, mode: TriggerMode) {
  if (mode === "above") return close >= range.min;
  if (mode === "below") return close <= range.max;
  return close >= range.min;
}

function invalidated(close: number, direction: "bullish" | "bearish", range: ParsedRange) {
  return direction === "bullish" ? close <= range.max : close >= range.min;
}

function targetHit(close: number, direction: "bullish" | "bearish", range: ParsedRange) {
  return direction === "bullish" ? close >= range.min : close <= range.max;
}

function assessScenario(
  direction: "bullish" | "bearish",
  mode: TriggerMode,
  trigger: ParsedRange | null,
  invalidation: ParsedRange | null,
  target: ParsedRange | null,
  currentPrice: number | null,
  comparableLevels: boolean,
  points: PricePoint[],
  publishedAt: string | null,
): { status: ArticleIdeaStatus; reason: string } {
  if (currentPrice === null) return { status: "needs_review", reason: "Current price is unavailable." };
  if (!comparableLevels) return { status: "needs_review", reason: "Only proxy market data is available, so article levels are not compared automatically." };
  if (!trigger) return { status: "needs_review", reason: "No usable trigger level was found in the article." };

  const path = postPublicationPoints(points, publishedAt);
  if (path.length) {
    let triggerIndex = -1;
    if (mode === "reject") {
      for (let index = 0; index < path.length; index += 1) {
        if (path[index].close >= trigger.min) {
          const later = path.slice(index + 1).findIndex((point) => point.close < trigger.min);
          if (later >= 0) { triggerIndex = index + 1 + later; break; }
        }
      }
    } else {
      triggerIndex = path.findIndex((point) => crossed(point.close, trigger, mode));
    }

    if (triggerIndex < 0) return { status: "active", reason: "Waiting: price has not reached the published trigger since the article was released." };

    for (const point of path.slice(triggerIndex)) {
      if (target && targetHit(point.close, direction, target)) return { status: "target_hit", reason: "The published setup triggered and subsequently reached its target." };
      if (invalidation && invalidated(point.close, direction, invalidation)) return { status: "likely_invalidated", reason: "The setup triggered, then crossed its published invalidation level." };
    }
    return { status: "likely_validated", reason: "The published trigger has been crossed and the setup remains in play." };
  }

  if (mode === "reject") {
    if (currentPrice >= trigger.min) return { status: "active", reason: "Price is testing the rejection zone; a rejection cannot be confirmed from a single current-price snapshot." };
    return { status: "active", reason: "Waiting: current price has not confirmed the published rejection setup." };
  }

  if (!crossed(currentPrice, trigger, mode)) return { status: "active", reason: "Waiting: current price has not reached the published trigger." };
  if (target && targetHit(currentPrice, direction, target)) return { status: "target_hit", reason: "Current price is through the published target after the trigger." };
  if (invalidation && invalidated(currentPrice, direction, invalidation)) return { status: "likely_invalidated", reason: "Current price is through the published invalidation level." };
  return { status: "likely_validated", reason: "Current price is through the published trigger and the setup is in play." };
}

export function extractArticleScenarios(
  article: AlchemyArticle,
  marketSeries: MarketSeries[],
  observations: MarketSeriesObservation[],
): ArticleChartIdea[] {
  const ideas: ArticleChartIdea[] = [];

  for (const spec of articleInstruments(article)) {
    const lines = relevantLines(article, spec);
    const market = findMarketSeries(spec.instrument, marketSeries, observations);
    const seeds = scenarioSeeds(lines);

    seeds.forEach((seed, index) => {
      const trigger = parseRange(seed.triggerLine);
      const target = parseRange(seed.targetLine);
      const invalidation = parseRange(seed.invalidationLine);
      const assessment = assessScenario(
        seed.direction,
        seed.mode,
        trigger,
        invalidation,
        target,
        market?.last ?? null,
        market?.comparableLevels ?? false,
        market?.points || [],
        article.publishedAt,
      );

      ideas.push({
        id: `${article.id}-scenario-${spec.instrument.toLowerCase()}-${seed.direction}-${index}`,
        storyId: null,
        storyTitle: "Published article setup",
        storyHref: article.url,
        instrument: spec.instrument,
        timeframe: article.category,
        overlay: seed.mode === "reject" ? "Rejection setup" : seed.mode === "above" ? "Break/reclaim setup" : "Break/loss setup",
        question: seed.label,
        confirmationArea: levelLabel(seed.triggerLine),
        invalidationArea: levelLabel(seed.invalidationLine),
        targetArea: levelLabel(seed.targetLine),
        direction: seed.direction,
        currentPrice: market?.last ?? null,
        publicationPrice: null,
        sincePublication: null,
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
      });
    });
  }

  return ideas.slice(0, 8);
}
