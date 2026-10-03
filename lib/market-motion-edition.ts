import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deriveMarketMotionAttention,
  MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
  marketMotionEffectiveState,
  type MarketMotionCategory,
  type MarketMotionRecord,
  type MarketMotionVerificationState,
} from "./market-motion.ts";
import { getRegimeDefinition, type RegimeSlug } from "./regimes.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const MARKET_MOTION_EDITION_V1 = "market-motion-edition/v1" as const;
export const MARKET_MOTION_EDITION_LIMIT = MARKET_MOTION_DISPLAY_SAFETY_LIMIT;

export type MarketMotionEditionStoryRef = {
  id: string;
  slug: string;
  title: string;
};

export type MarketMotionEditionItem = {
  id: string;
  motionKey: string;
  versionNumber: number;
  headline: string;
  category: MarketMotionCategory;
  verificationState: MarketMotionVerificationState;
  lifecycleState: "PROMOTED";
  whatHappened: string;
  marketReaction: string | null;
  whyInteresting: string;
  bigPictureBridge: string;
  nextTest: string | null;
  promotionReason: string | null;
  tickers: string[];
  sourceName: string;
  sourceUrl: string;
  sourceKind: string;
  materiality: number;
  relevance: number;
  novelty: number;
  occurredAt: string;
  observedAt: string;
  expiresAt: string;
  storyId: string | null;
  storySlug: string | null;
  storyTitle: string | null;
  regimeSlug: RegimeSlug | null;
  regimeLabel: string | null;
};

export type MarketMotionEditionAttachment = {
  contractVersion: typeof MARKET_MOTION_EDITION_V1;
  capturedAt: string;
  researchRunId: string;
  items: MarketMotionEditionItem[];
};

function validIso(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function bounded(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))]
    : [];
}

function priority(left: MarketMotionRecord, right: MarketMotionRecord) {
  const leftAttention = deriveMarketMotionAttention({
    materiality: left.materiality,
    relevance: left.relevance,
    novelty: left.novelty,
    verificationState: left.verification_state,
    lifecycleState: left.lifecycle_state,
    category: left.category,
    tickers: left.tickers,
    marketReaction: left.market_reaction,
    metadata: left.metadata,
  });
  const rightAttention = deriveMarketMotionAttention({
    materiality: right.materiality,
    relevance: right.relevance,
    novelty: right.novelty,
    verificationState: right.verification_state,
    lifecycleState: right.lifecycle_state,
    category: right.category,
    tickers: right.tickers,
    marketReaction: right.market_reaction,
    metadata: right.metadata,
  });
  const tierDelta = (rightAttention.tier === "PRIMARY" ? 1 : 0) - (leftAttention.tier === "PRIMARY" ? 1 : 0);
  return tierDelta
    || rightAttention.score - leftAttention.score
    || right.materiality - left.materiality
    || right.relevance - left.relevance
    || right.novelty - left.novelty
    || Date.parse(right.occurred_at) - Date.parse(left.occurred_at)
    || left.id.localeCompare(right.id);
}

export function buildMarketMotionEditionAttachment(input: {
  researchRunId: string;
  capturedAt: string;
  rows: MarketMotionRecord[];
  stories: MarketMotionEditionStoryRef[];
  limit?: number;
}): MarketMotionEditionAttachment {
  const capturedAt = validIso(input.capturedAt);
  if (!capturedAt) throw new Error("Market Motion edition capturedAt must be a valid timestamp.");

  const storyById = new Map(input.stories.map((story) => [story.id, story]));
  const selected = input.rows
    .filter((row) => row.research_run_id === input.researchRunId)
    .filter((row) => row.lifecycle_state === "PROMOTED")
    .filter((row) => marketMotionEffectiveState(row, new Date(capturedAt)) === "PROMOTED")
    .filter((row) => row.primary_story_id
      ? storyById.has(row.primary_story_id)
      : Boolean(row.primary_regime_slug && getRegimeDefinition(row.primary_regime_slug)))
    .sort(priority)
    .slice(0, Math.max(0, input.limit ?? MARKET_MOTION_EDITION_LIMIT))
    .sort((left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at) || left.id.localeCompare(right.id));

  return {
    contractVersion: MARKET_MOTION_EDITION_V1,
    capturedAt,
    researchRunId: input.researchRunId,
    items: selected.map((row) => {
      const story = row.primary_story_id ? storyById.get(row.primary_story_id) || null : null;
      const regime = row.primary_regime_slug ? getRegimeDefinition(row.primary_regime_slug) : null;
      return {
        id: row.id,
        motionKey: row.motion_key,
        versionNumber: row.version_number,
        headline: row.headline,
        category: row.category,
        verificationState: row.verification_state,
        lifecycleState: "PROMOTED" as const,
        whatHappened: row.what_happened,
        marketReaction: row.market_reaction,
        whyInteresting: row.why_interesting,
        bigPictureBridge: row.big_picture_bridge,
        nextTest: row.next_test,
        promotionReason: row.promotion_reason,
        tickers: [...row.tickers],
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        sourceKind: row.source_kind,
        materiality: bounded(row.materiality),
        relevance: bounded(row.relevance),
        novelty: bounded(row.novelty),
        occurredAt: new Date(row.occurred_at).toISOString(),
        observedAt: new Date(row.observed_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
        storyId: story?.id || null,
        storySlug: story?.slug || null,
        storyTitle: story?.title || null,
        regimeSlug: row.primary_regime_slug,
        regimeLabel: regime?.shortTitle || null,
      };
    }),
  };
}

export function emptyMarketMotionEditionAttachment(
  researchRunId: string,
  capturedAt: string,
): MarketMotionEditionAttachment {
  const normalized = validIso(capturedAt);
  if (!normalized) throw new Error("Market Motion edition capturedAt must be a valid timestamp.");
  return {
    contractVersion: MARKET_MOTION_EDITION_V1,
    capturedAt: normalized,
    researchRunId,
    items: [],
  };
}

export async function captureMarketMotionEditionAttachment(input: {
  researchRunId: string;
  capturedAt: string;
  client?: SupabaseClient;
}): Promise<MarketMotionEditionAttachment> {
  const db = input.client ?? createSupabaseAdminClient();
  const { data: rows, error } = await db
    .from("current_market_motion_items")
    .select("*")
    .eq("research_run_id", input.researchRunId)
    .eq("lifecycle_state", "PROMOTED")
    .order("occurred_at", { ascending: true })
    .limit(MARKET_MOTION_DISPLAY_SAFETY_LIMIT);

  if (error) throw new Error(`Market Motion edition read failed: ${error.message}`);

  const motionRows = (rows || []) as MarketMotionRecord[];
  const storyIds = [...new Set(motionRows.map((row) => row.primary_story_id).filter((id): id is string => Boolean(id)))];
  let stories: MarketMotionEditionStoryRef[] = [];
  if (storyIds.length) {
    const { data, error: storyError } = await db
      .from("stories")
      .select("id,slug,title")
      .in("id", storyIds);

    if (storyError) throw new Error(`Market Motion edition Story lookup failed: ${storyError.message}`);
    stories = (data || []) as MarketMotionEditionStoryRef[];
  }

  return buildMarketMotionEditionAttachment({
    researchRunId: input.researchRunId,
    capturedAt: input.capturedAt,
    rows: motionRows,
    stories,
  });
}

function parseItem(value: unknown): MarketMotionEditionItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = text(item.id);
  const motionKey = text(item.motionKey);
  const headline = text(item.headline);
  const whatHappened = text(item.whatHappened);
  const whyInteresting = text(item.whyInteresting);
  const bigPictureBridge = text(item.bigPictureBridge);
  const sourceName = text(item.sourceName);
  const sourceUrl = text(item.sourceUrl);
  const storyId = text(item.storyId);
  const storySlug = text(item.storySlug);
  const storyTitle = text(item.storyTitle);
  const occurredAt = text(item.occurredAt);
  const observedAt = text(item.observedAt);
  const expiresAt = text(item.expiresAt);
  const category = text(item.category) as MarketMotionCategory | null;
  const verificationState = text(item.verificationState) as MarketMotionVerificationState | null;
  const regimeSlug = text(item.regimeSlug) as RegimeSlug | null;

  if (
    !id || !motionKey || !headline || !whatHappened || !whyInteresting || !bigPictureBridge
    || !sourceName || !sourceUrl
    || !occurredAt || !observedAt || !expiresAt || !category || !verificationState
    || item.lifecycleState !== "PROMOTED"
  ) return null;
  const hasAnyStoryRef = Boolean(storyId || storySlug || storyTitle);
  const hasCompleteStoryRef = Boolean(storyId && storySlug && storyTitle);
  if (hasAnyStoryRef && !hasCompleteStoryRef) return null;
  if (!hasCompleteStoryRef && !regimeSlug) return null;
  if (!validIso(occurredAt) || !validIso(observedAt) || !validIso(expiresAt)) return null;

  const versionNumber = Number(item.versionNumber);

  return {
    id,
    motionKey,
    versionNumber: Number.isFinite(versionNumber) ? versionNumber : 1,
    headline,
    category,
    verificationState,
    lifecycleState: "PROMOTED",
    whatHappened,
    marketReaction: text(item.marketReaction),
    whyInteresting,
    bigPictureBridge,
    nextTest: text(item.nextTest),
    promotionReason: text(item.promotionReason),
    tickers: strings(item.tickers),
    sourceName,
    sourceUrl,
    sourceKind: text(item.sourceKind) || "reporting",
    materiality: bounded(Number(item.materiality)),
    relevance: bounded(Number(item.relevance)),
    novelty: bounded(Number(item.novelty)),
    occurredAt: validIso(occurredAt)!,
    observedAt: validIso(observedAt)!,
    expiresAt: validIso(expiresAt)!,
    storyId,
    storySlug,
    storyTitle,
    regimeSlug,
    regimeLabel: text(item.regimeLabel),
  };
}

export function marketMotionFromEditionPayload(payload: Record<string, unknown> | null | undefined) {
  const raw = payload?.marketMotion;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const attachment = raw as Record<string, unknown>;
  if (attachment.contractVersion !== MARKET_MOTION_EDITION_V1) return null;
  const capturedAt = text(attachment.capturedAt);
  const researchRunId = text(attachment.researchRunId);
  if (!capturedAt || !validIso(capturedAt) || !researchRunId || !Array.isArray(attachment.items)) return null;
  return {
    contractVersion: MARKET_MOTION_EDITION_V1,
    capturedAt: validIso(capturedAt)!,
    researchRunId,
    items: attachment.items.flatMap((item) => {
      const parsed = parseItem(item);
      return parsed ? [parsed] : [];
    }),
  } satisfies MarketMotionEditionAttachment;
}

export function selectMarketMotionEditionContext(input: {
  attachment: MarketMotionEditionAttachment | null;
  preferredStoryId?: string | null;
  preferredRegimeSlug?: string | null;
  limit?: number;
}) {
  if (!input.attachment) return [];
  return [...input.attachment.items]
    .sort((left, right) => {
      const leftStory = input.preferredStoryId && left.storyId === input.preferredStoryId ? 1 : 0;
      const rightStory = input.preferredStoryId && right.storyId === input.preferredStoryId ? 1 : 0;
      if (leftStory !== rightStory) return rightStory - leftStory;
      const leftRegime = input.preferredRegimeSlug && left.regimeSlug === input.preferredRegimeSlug ? 1 : 0;
      const rightRegime = input.preferredRegimeSlug && right.regimeSlug === input.preferredRegimeSlug ? 1 : 0;
      if (leftRegime !== rightRegime) return rightRegime - leftRegime;
      const leftAttention = deriveMarketMotionAttention({
        materiality: left.materiality,
        relevance: left.relevance,
        novelty: left.novelty,
        verificationState: left.verificationState,
        lifecycleState: left.lifecycleState,
        category: left.category,
        tickers: left.tickers,
        marketReaction: left.marketReaction,
      });
      const rightAttention = deriveMarketMotionAttention({
        materiality: right.materiality,
        relevance: right.relevance,
        novelty: right.novelty,
        verificationState: right.verificationState,
        lifecycleState: right.lifecycleState,
        category: right.category,
        tickers: right.tickers,
        marketReaction: right.marketReaction,
      });
      const tierDelta = (rightAttention.tier === "PRIMARY" ? 1 : 0) - (leftAttention.tier === "PRIMARY" ? 1 : 0);
      return tierDelta
        || rightAttention.score - leftAttention.score
        || right.materiality - left.materiality
        || right.relevance - left.relevance
        || Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
        || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(0, input.limit ?? MARKET_MOTION_DISPLAY_SAFETY_LIMIT));
}

export function marketMotionEditionSourceRefs(attachment: MarketMotionEditionAttachment) {
  return attachment.items.map((item) => ({
    type: "market_motion",
    id: item.id,
    versionNumber: item.versionNumber,
  }));
}
