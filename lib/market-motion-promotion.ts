import type { SupabaseClient } from "@supabase/supabase-js";

import {
  marketMotionEffectiveState,
  persistMarketMotion,
  type MarketMotionInput,
  type MarketMotionRecord,
} from "./market-motion.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const MARKET_MOTION_PROMOTION_MIN_MATERIALITY = 80;
export const MARKET_MOTION_PROMOTION_MIN_RELEVANCE = 75;
export const MARKET_MOTION_PROMOTION_LIMIT = 6;

export type MarketMotionPromotionResult = {
  considered: number;
  eligible: number;
  promoted: number;
  skippedAlreadyPromoted: number;
  motionIds: string[];
  warnings: string[];
};

function promotableVerification(item: MarketMotionRecord) {
  return item.verification_state === "REPORTED" || item.verification_state === "VERIFIED";
}

export function selectPromotableMarketMotion(
  items: MarketMotionRecord[],
  publishedStoryIds: string[],
  now = new Date(),
  limit = MARKET_MOTION_PROMOTION_LIMIT,
) {
  const storyIds = new Set(publishedStoryIds.filter(Boolean));

  return items
    .filter((item) => item.primary_story_id && storyIds.has(item.primary_story_id))
    .filter((item) => marketMotionEffectiveState(item, now) !== "EXPIRED")
    .filter((item) => item.lifecycle_state === "MOTION")
    .filter(promotableVerification)
    .filter((item) => item.materiality >= MARKET_MOTION_PROMOTION_MIN_MATERIALITY)
    .filter((item) => item.relevance >= MARKET_MOTION_PROMOTION_MIN_RELEVANCE)
    .sort((left, right) => {
      const verificationDelta = (right.verification_state === "VERIFIED" ? 1 : 0)
        - (left.verification_state === "VERIFIED" ? 1 : 0);
      if (verificationDelta) return verificationDelta;
      const materialityDelta = right.materiality - left.materiality;
      if (materialityDelta) return materialityDelta;
      const relevanceDelta = right.relevance - left.relevance;
      if (relevanceDelta) return relevanceDelta;
      const noveltyDelta = right.novelty - left.novelty;
      if (noveltyDelta) return noveltyDelta;
      return Date.parse(right.occurred_at) - Date.parse(left.occurred_at);
    })
    .slice(0, Math.max(0, limit));
}

export function marketMotionPromotionInput(
  item: MarketMotionRecord,
  input: { researchRunId: string; engineRunId: string },
): MarketMotionInput {
  if (!item.primary_story_id) {
    throw new Error("Market Motion promotion requires an exact canonical Story link.");
  }

  return {
    motionKey: item.motion_key,
    lifecycleState: "PROMOTED",
    category: item.category,
    verificationState: item.verification_state,
    headline: item.headline,
    whatHappened: item.what_happened,
    marketReaction: item.market_reaction,
    whyInteresting: item.why_interesting,
    bigPictureBridge: item.big_picture_bridge,
    nextTest: item.next_test,
    promotionReason: `Canonical Story ${item.primary_story_id} changed in intelligence run ${input.engineRunId}; this Motion is promoted as short-horizon Dossier context, not as a new Story.`,
    tickers: [...item.tickers],
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    sourceKind: item.source_kind as NonNullable<MarketMotionInput["sourceKind"]>,
    materiality: item.materiality,
    relevance: item.relevance,
    novelty: item.novelty,
    occurredAt: item.occurred_at,
    observedAt: item.observed_at,
    expiresAt: item.expires_at,
    researchRunId: input.researchRunId,
    sourceId: item.source_id,
    evidenceId: item.evidence_id,
    primaryStoryId: item.primary_story_id,
    primaryRegimeSlug: item.primary_regime_slug,
    metadata: {
      ...(item.metadata || {}),
      promotedFromMotionId: item.id,
      promotionEngineRunId: input.engineRunId,
      promotionResearchRunId: input.researchRunId,
      promotionPolicy: "canonical-story-changed/v1",
    },
  };
}

export async function promoteMarketMotionForPublishedStories(input: {
  researchRunId: string;
  engineRunId: string;
  storyIds: string[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionPromotionResult> {
  const storyIds = [...new Set(input.storyIds.filter(Boolean))];
  if (!storyIds.length) {
    return {
      considered: 0,
      eligible: 0,
      promoted: 0,
      skippedAlreadyPromoted: 0,
      motionIds: [],
      warnings: [],
    };
  }

  const db = input.client ?? createSupabaseAdminClient();
  const { data, error } = await db
    .from("current_market_motion_items")
    .select("*")
    .eq("research_run_id", input.researchRunId)
    .in("primary_story_id", storyIds);

  if (error) {
    throw new Error(`Market Motion promotion read failed: ${error.message}`);
  }

  const rows = (data || []) as MarketMotionRecord[];
  const skippedAlreadyPromoted = rows.filter((item) => (
    item.primary_story_id
    && storyIds.includes(item.primary_story_id)
    && marketMotionEffectiveState(item, input.now) !== "EXPIRED"
    && item.lifecycle_state === "PROMOTED"
  )).length;
  const eligible = selectPromotableMarketMotion(rows, storyIds, input.now);
  const warnings: string[] = [];
  const motionIds: string[] = [];

  for (const item of eligible) {
    try {
      const promoted = await persistMarketMotion(
        marketMotionPromotionInput(item, {
          researchRunId: input.researchRunId,
          engineRunId: input.engineRunId,
        }),
        db,
      );
      motionIds.push(promoted.id);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : `Market Motion promotion failed for ${item.motion_key}.`,
      );
    }
  }

  return {
    considered: rows.length,
    eligible: eligible.length,
    promoted: motionIds.length,
    skippedAlreadyPromoted,
    motionIds,
    warnings,
  };
}
