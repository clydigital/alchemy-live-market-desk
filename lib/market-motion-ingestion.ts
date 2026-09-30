import type { SupabaseClient } from "@supabase/supabase-js";

import { explicitlyMentionedInstrumentSpecs } from "./instrument-mentions.ts";
import {
  getRegimeDefinition,
  type RegimeSlug,
} from "./regimes.ts";
import type { IntakeItemInput } from "./research-update.ts";
import {
  persistMarketMotion,
  resolveMarketMotionLinks,
  type MarketMotionCategory,
  type MarketMotionInput,
  type MarketMotionRecord,
  type MarketMotionVerificationState,
} from "./market-motion.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const MARKET_MOTION_RUN_LIMIT = 6;
export const MARKET_MOTION_MIN_SCORE = 72;
export const MARKET_MOTION_MIN_MATERIALITY = 72;
export const MARKET_MOTION_MIN_RELEVANCE = 70;
export const MARKET_MOTION_MIN_NOVELTY = 65;

type ScoredIntakeItem = IntakeItemInput & {
  candidateScore: number;
  evidence: Array<{
    title: string;
    url: string;
    publisher: string;
    publishedAt: string;
    claim: string;
  }>;
};

type StoryRef = {
  id: string;
  slug: string;
  title: string;
};

export type MarketMotionIngestionResult = {
  considered: number;
  eligible: number;
  inserted: number;
  skippedExisting: number;
  motionIds: string[];
  warnings: string[];
};

function cleanText(value: string | undefined | null, max: number) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceKind(item: ScoredIntakeItem): NonNullable<MarketMotionInput["sourceKind"]> {
  if (item.itemType === "video") return "creator";
  const host = sourceHost(item.url);
  if (/^(?:www\.)?sec\.gov$/.test(host)) return "filing";
  if (
    /(?:^|\.)(?:bls\.gov|bea\.gov|treasury\.gov|energy\.gov|federalreserve\.gov|newyorkfed\.org|ecb\.europa\.eu|boj\.or\.jp|mof\.go\.jp|statcan\.gc\.ca|ons\.gov\.uk|eurostat\.ec\.europa\.eu|abs\.gov\.au|stats\.govt\.nz|rba\.gov\.au|bankofengland\.co\.uk|bankofcanada\.ca|snb\.ch|imf\.org|bis\.org)$/.test(host)
  ) return "official";
  return "reporting";
}

function verificationState(
  item: ScoredIntakeItem,
  kind: NonNullable<MarketMotionInput["sourceKind"]>,
): MarketMotionVerificationState {
  if ((kind === "official" || kind === "filing" || kind === "primary") && item.sourceQuality >= 90) {
    return "VERIFIED";
  }
  return "REPORTED";
}

function categoryFor(text: string): MarketMotionCategory {
  if (/\b(earnings|eps|revenue|guidance|quarter|results|margin|free cash flow|fcf)\b/i.test(text)) return "EARNINGS";
  if (/\b(iran|hormuz|war|conflict|sanction|ceasefire|missile|military|tariff|trade war)\b/i.test(text)) return "GEOPOLITICS";
  if (/\b(oil|brent|wti|crude|diesel|distillate|lng|gasoline|refiner|refinery|energy security)\b/i.test(text)) return "ENERGY";
  if (/\b(gold|silver|copper|commodity|commodities|metals?)\b/i.test(text)) return "COMMODITY";
  if (/\b(cpi|ppi|pce|payroll|nfp|jobs|employment|gdp|pmi|ism|inflation|growth|treasury|yield|rates?|fed|fomc|boj|ecb|central bank)\b/i.test(text)) return "MACRO";
  if (/\b(policy|regulation|regulatory|government|administration|ministry|tax|subsidy|export control)\b/i.test(text)) return "POLICY";
  if (/\b(breadth|liquidity|market structure|volatility|vix|move index|auction|buyback|positioning)\b/i.test(text)) return "MARKET_STRUCTURE";
  if (/\b(sector|industry|semiconductor|memory|utilities|financials|technology|consumer discretionary)\b/i.test(text)) return "SECTOR";
  if (/\b(company|shares?|stock|acquisition|merger|launch|contract|partnership|customer|capex|investment)\b/i.test(text)) return "COMPANY";
  return "OTHER";
}

function eligible(item: ScoredIntakeItem, now: Date) {
  const publishedAt = Date.parse(item.publishedAt);
  if (!Number.isFinite(publishedAt)) return false;
  if (publishedAt > now.getTime() + 5 * 60_000) return false;
  if (now.getTime() - publishedAt > 72 * 60 * 60 * 1_000) return false;
  if (!["collect_evidence", "review_article", "recalibrate_story"].includes(item.recommendedAction)) return false;
  if (item.candidateScore < MARKET_MOTION_MIN_SCORE) return false;
  if (item.materiality < MARKET_MOTION_MIN_MATERIALITY) return false;
  if (item.relevance < MARKET_MOTION_MIN_RELEVANCE) return false;
  if (item.novelty < MARKET_MOTION_MIN_NOVELTY) return false;

  if (item.itemType === "video") {
    return item.transcriptStatus === "ready" && cleanText(item.transcriptText, 500).length >= 200;
  }
  return item.evidence.length > 0;
}

function exactStory(
  item: ScoredIntakeItem,
  stories: StoryRef[],
) {
  const bySlug = new Map(stories.map((story) => [story.slug, story]));
  for (const slug of item.affectedStorySlugs || []) {
    const story = bySlug.get(slug);
    if (story) return story;
  }
  return null;
}

function bridgeFor(input: {
  regimeSlug: RegimeSlug | null;
  story: StoryRef | null;
}) {
  const regime = input.regimeSlug ? getRegimeDefinition(input.regimeSlug) : null;
  if (regime) {
    const map: Partial<Record<RegimeSlug, string>> = {
      "us-china-ai": "Fresh AI / technology evidence → supply, demand or financing channel → US–China AI regime",
      "energy-security-inflation": "Fresh energy / geopolitical evidence → physical supply and inflation channel → Energy Security regime",
      "global-cost-of-capital": "Fresh rates / funding evidence → sovereign yields and financing costs → Cost of Capital regime",
      "gold-reserve-diversification": "Fresh reserve / real-yield evidence → gold demand and opportunity cost → Gold / Reserves regime",
      "equity-rally-quality": "Fresh company / sector evidence → earnings breadth and market participation → Equity Rally Quality regime",
    };
    return map[input.regimeSlug!] || `Fresh event → ${regime.shortTitle} → test whether the durable regime needs recalibration`;
  }
  if (input.story) {
    return `Fresh event → tests ${input.story.title} → wait for confirmation or contradiction before changing the durable Story`;
  }
  return "Fresh event → market relevance test → corroborate before attaching it to a durable Story or Regime";
}

function nextTestFor(
  item: ScoredIntakeItem,
  verification: MarketMotionVerificationState,
) {
  const reason = cleanText(item.reviewReason, 500);
  if (reason) return reason;
  if (verification === "VERIFIED") {
    return "Check whether the linked assets and broader Story / Regime reaction confirm the information.";
  }
  return "Seek independent or primary-source confirmation, then test whether the market reaction persists.";
}

function whyInterestingFor(
  item: ScoredIntakeItem,
  story: StoryRef | null,
  regimeSlug: RegimeSlug | null,
) {
  const signal = cleanText(item.newsSignal || item.reviewReason, 900);
  if (signal) return signal;
  if (story) return `Fresh evidence may confirm, challenge or refine the existing Story: ${story.title}.`;
  const regime = regimeSlug ? getRegimeDefinition(regimeSlug) : null;
  if (regime) return `Fresh evidence may affect the current ${regime.shortTitle} interpretation.`;
  return "Fresh, high-materiality evidence cleared the intake gate and warrants short-horizon monitoring.";
}

export function buildMarketMotionCandidates(
  items: ScoredIntakeItem[],
  stories: StoryRef[],
  options: { now?: Date; researchRunId?: string | null } = {},
): MarketMotionInput[] {
  const now = options.now ?? new Date();

  return items
    .filter((item) => eligible(item, now))
    .sort((left, right) =>
      right.candidateScore - left.candidateScore
      || right.materiality - left.materiality
      || right.relevance - left.relevance
      || right.novelty - left.novelty
      || Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, MARKET_MOTION_RUN_LIMIT)
    .map((item) => {
      const text = [
        item.title,
        item.summary,
        item.newsSignal || "",
        item.statsSignal || "",
        item.divergenceNote || "",
        item.reviewReason || "",
        ...(item.evidence || []).map((link) => link.claim),
      ].join(" ");
      const links = resolveMarketMotionLinks({
        text,
        affectedStorySlugs: item.affectedStorySlugs,
        stories,
      });
      const story = exactStory(item, stories);
      const kind = sourceKind(item);
      const verification = verificationState(item, kind);
      const tickers = explicitlyMentionedInstrumentSpecs(text).map((spec) => spec.instrument);

      return {
        motionKey: `intake:${item.itemKey}`,
        lifecycleState: "MOTION",
        category: categoryFor(text),
        verificationState: verification,
        headline: cleanText(item.title, 500),
        whatHappened: cleanText(item.summary || item.evidence[0]?.claim, 3_600),
        marketReaction: null,
        whyInteresting: whyInterestingFor(item, story, links.primaryRegimeSlug),
        bigPictureBridge: bridgeFor({
          regimeSlug: links.primaryRegimeSlug,
          story,
        }),
        nextTest: nextTestFor(item, verification),
        tickers,
        sourceName: cleanText(item.publisher, 300),
        sourceUrl: item.url,
        sourceKind: kind,
        materiality: item.materiality,
        relevance: item.relevance,
        novelty: item.novelty,
        occurredAt: item.publishedAt,
        observedAt: now.toISOString(),
        researchRunId: options.researchRunId || null,
        primaryStoryId: links.primaryStoryId,
        primaryRegimeSlug: links.primaryRegimeSlug,
        metadata: {
          itemKey: item.itemKey,
          itemType: item.itemType,
          candidateScore: item.candidateScore,
          recommendedAction: item.recommendedAction,
          affectedStorySlugs: item.affectedStorySlugs || [],
          primaryRegimeSubgroup: links.primaryRegimeSubgroup,
          evidenceUrls: item.evidence.map((link) => link.url).slice(0, 8),
          ingestion: "research-update/v1",
        },
      };
    });
}

function sameCore(existing: MarketMotionRecord, candidate: MarketMotionInput) {
  return existing.lifecycle_state === (candidate.lifecycleState || "MOTION")
    && existing.verification_state === (candidate.verificationState || "LEAD")
    && existing.headline === candidate.headline
    && existing.what_happened === candidate.whatHappened
    && existing.market_reaction === (candidate.marketReaction || null)
    && existing.why_interesting === candidate.whyInteresting
    && existing.big_picture_bridge === candidate.bigPictureBridge
    && existing.next_test === (candidate.nextTest || null)
    && existing.source_url === candidate.sourceUrl
    && existing.primary_story_id === (candidate.primaryStoryId || null)
    && existing.primary_regime_slug === (candidate.primaryRegimeSlug || null);
}

export async function persistMarketMotionFromResearchRun(input: {
  researchRunId: string;
  items: ScoredIntakeItem[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionIngestionResult> {
  const db = input.client ?? createSupabaseAdminClient();
  const warnings: string[] = [];

  const { data: stories, error: storyError } = await db
    .from("stories")
    .select("id,slug,title")
    .neq("status", "archived");

  if (storyError) {
    throw new Error(`Market Motion could not read canonical Stories: ${storyError.message}`);
  }

  const candidates = buildMarketMotionCandidates(
    input.items,
    (stories || []) as StoryRef[],
    { now: input.now, researchRunId: input.researchRunId },
  );

  if (!candidates.length) {
    return {
      considered: input.items.length,
      eligible: 0,
      inserted: 0,
      skippedExisting: 0,
      motionIds: [],
      warnings,
    };
  }

  const keys = candidates.map((candidate) => candidate.motionKey);
  const { data: existingRows, error: existingError } = await db
    .from("current_market_motion_items")
    .select("*")
    .in("motion_key", keys);

  if (existingError) {
    throw new Error(`Market Motion could not inspect current motion: ${existingError.message}`);
  }

  const existingByKey = new Map(
    ((existingRows || []) as MarketMotionRecord[]).map((row) => [row.motion_key, row]),
  );

  const motionIds: string[] = [];
  let skippedExisting = 0;

  for (const candidate of candidates) {
    const prior = existingByKey.get(candidate.motionKey);
    if (prior && sameCore(prior, candidate)) {
      skippedExisting += 1;
      continue;
    }
    try {
      const row = await persistMarketMotion(candidate, db);
      motionIds.push(row.id);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `Market Motion failed for ${candidate.motionKey}.`);
    }
  }

  return {
    considered: input.items.length,
    eligible: candidates.length,
    inserted: motionIds.length,
    skippedExisting,
    motionIds,
    warnings,
  };
}
