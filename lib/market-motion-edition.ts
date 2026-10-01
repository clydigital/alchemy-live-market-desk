import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deriveMarketMotionAttention,
  MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
  marketMotionEffectiveState,
  type MarketMotionAttentionTier,
  type MarketMotionCategory,
  type MarketMotionRecord,
  type MarketMotionVerificationState,
  type MarketMotionWritingPotential,
} from "./market-motion.ts";
import { getRegimeDefinition, type RegimeSlug } from "./regimes.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const MARKET_MOTION_EDITION_V1 = "market-motion-edition/v1" as const;
export const MARKET_MOTION_EDITION_V2 = "market-motion-edition/v2" as const;
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
  sourceResearchRunId: string | null;
  headline: string;
  category: MarketMotionCategory;
  verificationState: MarketMotionVerificationState;
  lifecycleState: "MOTION" | "PROMOTED";
  attentionTier: MarketMotionAttentionTier;
  attentionScore: number;
  writingPotential: MarketMotionWritingPotential;
  attentionReasons: string[];
  writingAngles: string[];
  researchQuestions: string[];
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
  contractVersion: typeof MARKET_MOTION_EDITION_V2;
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

function metadataStrings(metadata: Record<string, unknown> | null | undefined, field: string) {
  return strings(metadata?.[field]).slice(0, 8);
}

function attentionForRow(row: MarketMotionRecord) {
  return deriveMarketMotionAttention({
    materiality: row.materiality,
    relevance: row.relevance,
    novelty: row.novelty,
    verificationState: row.verification_state,
    lifecycleState: row.lifecycle_state,
    category: row.category,
    tickers: row.tickers,
    marketReaction: row.market_reaction,
    metadata: row.metadata,
  });
}

function priority(left: MarketMotionRecord, right: MarketMotionRecord) {
  const leftAttention = attentionForRow(left);
  const rightAttention = attentionForRow(right);
  const tierDelta = (rightAttention.tier === "PRIMARY" ? 1 : 0) - (leftAttention.tier === "PRIMARY" ? 1 : 0);
  if (tierDelta) return tierDelta;
  return rightAttention.score - leftAttention.score
    || Date.parse(right.occurred_at) - Date.parse(left.occurred_at)
    || right.materiality - left.materiality
    || right.relevance - left.relevance
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
    .filter((row) => marketMotionEffectiveState(row, new Date(capturedAt)) !== "EXPIRED")
    .filter((row) => row.lifecycle_state === "MOTION" || row.lifecycle_state === "PROMOTED")
    .sort(priority)
    .slice(0, Math.max(0, input.limit ?? MARKET_MOTION_EDITION_LIMIT));

  return {
    contractVersion: MARKET_MOTION_EDITION_V2,
    capturedAt,
    researchRunId: input.researchRunId,
    items: selected.map((row) => {
      const story = row.primary_story_id ? storyById.get(row.primary_story_id) || null : null;
      const regime = row.primary_regime_slug ? getRegimeDefinition(row.primary_regime_slug) : null;
      const attention = attentionForRow(row);
      return {
        id: row.id,
        motionKey: row.motion_key,
        versionNumber: row.version_number,
        sourceResearchRunId: row.research_run_id,
        headline: row.headline,
        category: row.category,
        verificationState: row.verification_state,
        lifecycleState: row.lifecycle_state as "MOTION" | "PROMOTED",
        attentionTier: attention.tier,
        attentionScore: attention.score,
        writingPotential: attention.writingPotential,
        attentionReasons: attention.reasons,
        writingAngles: metadataStrings(row.metadata, "writingAngles"),
        researchQuestions: metadataStrings(row.metadata, "researchQuestions"),
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
    contractVersion: MARKET_MOTION_EDITION_V2,
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
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Market Motion edition read failed: ${error.message}`);

  const motionRows = (rows || []) as MarketMotionRecord[];
  const storyIds = [...new Set(motionRows.map((row) => row.primary_story_id).filter((id): id is string => Boolean(id)))];
  let stories: MarketMotionEditionStoryRef[] = [];

  if (storyIds.length) {
    const { data: storyRows, error: storyError } = await db
      .from("stories")
      .select("id,slug,title")
      .in("id", storyIds);
    if (storyError) throw new Error(`Market Motion edition Story lookup failed: ${storyError.message}`);
    stories = (storyRows || []) as MarketMotionEditionStoryRef[];
  }

  return buildMarketMotionEditionAttachment({
    researchRunId: input.researchRunId,
    capturedAt: input.capturedAt,
    rows: motionRows,
    stories,
  });
}

function parseAttention(item: Record<string, unknown>, lifecycleState: "MOTION" | "PROMOTED", category: MarketMotionCategory, verificationState: MarketMotionVerificationState) {
  const explicitTier = item.attentionTier === "PRIMARY" || item.attentionTier === "SECONDARY"
    ? item.attentionTier
    : null;
  const explicitScore = Number(item.attentionScore);
  const explicitWriting = item.writingPotential === "HIGH" || item.writingPotential === "MEDIUM" || item.writingPotential === "LOW"
    ? item.writingPotential
    : null;

  if (explicitTier && Number.isFinite(explicitScore) && explicitWriting) {
    return {
      tier: explicitTier,
      score: bounded(explicitScore),
      writingPotential: explicitWriting,
      reasons: strings(item.attentionReasons).slice(0, 4),
    };
  }

  return deriveMarketMotionAttention({
    materiality: bounded(Number(item.materiality)),
    relevance: bounded(Number(item.relevance)),
    novelty: bounded(Number(item.novelty)),
    verificationState,
    lifecycleState,
    category,
    tickers: strings(item.tickers),
    marketReaction: text(item.marketReaction),
  });
}

function parseItem(value: unknown, legacyV1 = false): MarketMotionEditionItem | null {
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
  const occurredAt = text(item.occurredAt);
  const observedAt = text(item.observedAt);
  const expiresAt = text(item.expiresAt);
  const category = text(item.category) as MarketMotionCategory | null;
  const verificationState = text(item.verificationState) as MarketMotionVerificationState | null;
  const regimeSlug = text(item.regimeSlug) as RegimeSlug | null;
  const lifecycleState = item.lifecycleState === "MOTION" || item.lifecycleState === "PROMOTED"
    ? item.lifecycleState
    : legacyV1
      ? "PROMOTED"
      : null;

  if (
    !id || !motionKey || !headline || !whatHappened || !whyInteresting || !bigPictureBridge
    || !sourceName || !sourceUrl || !occurredAt || !observedAt || !expiresAt
    || !category || !verificationState || !lifecycleState
  ) return null;
  if (!validIso(occurredAt) || !validIso(observedAt) || !validIso(expiresAt)) return null;

  const versionNumber = Number(item.versionNumber);
  const attention = parseAttention(item, lifecycleState, category, verificationState);

  return {
    id,
    motionKey,
    versionNumber: Number.isFinite(versionNumber) ? versionNumber : 1,
    sourceResearchRunId: text(item.sourceResearchRunId),
    headline,
    category,
    verificationState,
    lifecycleState,
    attentionTier: attention.tier,
    attentionScore: attention.score,
    writingPotential: attention.writingPotential,
    attentionReasons: attention.reasons,
    writingAngles: strings(item.writingAngles).slice(0, 8),
    researchQuestions: strings(item.researchQuestions).slice(0, 8),
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
    storyId: text(item.storyId),
    storySlug: text(item.storySlug),
    storyTitle: text(item.storyTitle),
    regimeSlug,
    regimeLabel: text(item.regimeLabel),
  };
}

export function marketMotionFromEditionPayload(payload: Record<string, unknown> | null | undefined) {
  const raw = payload?.marketMotion;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const attachment = raw as Record<string, unknown>;
  const legacyV1 = attachment.contractVersion === MARKET_MOTION_EDITION_V1;
  if (!legacyV1 && attachment.contractVersion !== MARKET_MOTION_EDITION_V2) return null;
  const capturedAt = text(attachment.capturedAt);
  const researchRunId = text(attachment.researchRunId);
  if (!capturedAt || !validIso(capturedAt) || !researchRunId || !Array.isArray(attachment.items)) return null;
  return {
    contractVersion: MARKET_MOTION_EDITION_V2,
    capturedAt: validIso(capturedAt)!,
    researchRunId,
    items: attachment.items.flatMap((item) => {
      const parsed = parseItem(item, legacyV1);
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
      const tierDelta = (right.attentionTier === "PRIMARY" ? 1 : 0) - (left.attentionTier === "PRIMARY" ? 1 : 0);
      if (tierDelta) return tierDelta;
      return right.attentionScore - left.attentionScore
        || Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
        || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(0, input.limit ?? MARKET_MOTION_EDITION_LIMIT));
}

export function marketMotionEditionSourceRefs(attachment: MarketMotionEditionAttachment) {
  return attachment.items.map((item) => ({
    type: "market_motion",
    id: item.id,
    versionNumber: item.versionNumber,
    sourceResearchRunId: item.sourceResearchRunId,
  }));
}
