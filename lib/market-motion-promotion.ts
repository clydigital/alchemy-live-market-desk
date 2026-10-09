import type { SupabaseClient } from "@supabase/supabase-js";

import type { EvidencePackItem } from "./intelligence/schemas.ts";
import {
  isCanonicalEligibleEvidence,
  sourceVerificationWeight,
} from "./intelligence/source-verification.ts";
import {
  deriveMarketMotionRoutingClass,
  marketMotionEffectiveState,
  persistMarketMotion,
  type MarketMotionInput,
  type MarketMotionRecord,
  type MarketMotionRoutingClass,
} from "./market-motion.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const MARKET_MOTION_PROMOTION_MIN_MATERIALITY = 80;
export const MARKET_MOTION_PROMOTION_MIN_RELEVANCE = 75;
export const MARKET_MOTION_PROMOTION_LIMIT = 6;
export const MARKET_MOTION_PROMOTION_EVIDENCE_LIMIT = 8;
export const MARKET_MOTION_PROMOTION_POLICY = "canonical-evidence-corroborated/v2" as const;

export type MarketMotionPromotionCandidate = {
  motion: MarketMotionRecord;
  routingClass: MarketMotionRoutingClass;
  selectedEvidence: EvidencePackItem;
  matchingEvidenceIds: string[];
  matchingOriginItemKeys: string[];
  evidenceWeight: number;
};

export type MarketMotionPromotionResult = {
  considered: number;
  eligible: number;
  promoted: number;
  skippedAlreadyPromoted: number;
  motionIds: string[];
  warnings: string[];
};

function promotableVerification(item: MarketMotionRecord) {
  return item.verification_state === "LEAD"
    || item.verification_state === "REPORTED"
    || item.verification_state === "VERIFIED";
}

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function motionOriginItemKeys(item: MarketMotionRecord) {
  const scalar = typeof item.metadata?.itemKey === "string"
    ? item.metadata.itemKey.trim()
    : "";
  return [...new Set([
    ...strings(item.metadata?.originItemKeys),
    ...(scalar ? [scalar] : []),
  ])];
}

function evidenceItemKey(item: EvidencePackItem) {
  const value = item.structuredPayload?.itemKey;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function evidencePacketRef(item: EvidencePackItem) {
  const external = item.externalEvidenceId?.trim();
  return external || `ev:${item.id}`;
}

function evidenceTimestamp(item: EvidencePackItem) {
  const value = item.availableAt || item.eventAt;
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function compareCorroborators(left: EvidencePackItem, right: EvidencePackItem) {
  const weightDelta = sourceVerificationWeight(right) - sourceVerificationWeight(left);
  if (weightDelta) return weightDelta;
  const timeDelta = evidenceTimestamp(right) - evidenceTimestamp(left);
  if (timeDelta) return timeDelta;
  return left.id.localeCompare(right.id);
}

function eligibleCorroborators(item: MarketMotionRecord, evidence: EvidencePackItem[]) {
  const originKeys = new Set(motionOriginItemKeys(item));
  if (!originKeys.size) return [];

  const byId = new Map<string, EvidencePackItem>();
  for (const candidate of evidence) {
    const itemKey = evidenceItemKey(candidate);
    if (!itemKey || !originKeys.has(itemKey) || !isCanonicalEligibleEvidence(candidate)) continue;
    byId.set(candidate.id, candidate);
  }

  return [...byId.values()].sort(compareCorroborators);
}

export function selectPromotableMarketMotion(
  items: MarketMotionRecord[],
  evidence: EvidencePackItem[],
  now = new Date(),
): MarketMotionPromotionCandidate[] {
  return items
    .filter((item) => marketMotionEffectiveState(item, now) !== "EXPIRED")
    .filter((item) => item.lifecycle_state === "MOTION")
    .filter(promotableVerification)
    .filter((item) => item.materiality >= MARKET_MOTION_PROMOTION_MIN_MATERIALITY)
    .filter((item) => item.relevance >= MARKET_MOTION_PROMOTION_MIN_RELEVANCE)
    .flatMap((motion): MarketMotionPromotionCandidate[] => {
      const routingClass = deriveMarketMotionRoutingClass({
        primaryStoryId: motion.primary_story_id,
        primaryRegimeSlug: motion.primary_regime_slug,
        nextTest: motion.next_test,
      });
      if (!routingClass) return [];
      const corroborators = eligibleCorroborators(motion, evidence);
      const selectedEvidence = corroborators[0];
      if (!selectedEvidence) return [];
      const bounded = corroborators.slice(0, MARKET_MOTION_PROMOTION_EVIDENCE_LIMIT);
      return [{
        motion,
        routingClass,
        selectedEvidence,
        matchingEvidenceIds: bounded.map((item) => item.id),
        matchingOriginItemKeys: [...new Set(
          bounded
            .map(evidenceItemKey)
            .filter((itemKey): itemKey is string => Boolean(itemKey)),
        )],
        evidenceWeight: sourceVerificationWeight(selectedEvidence),
      }];
    })
    .sort((left, right) => {
      const evidenceDelta = right.evidenceWeight - left.evidenceWeight;
      if (evidenceDelta) return evidenceDelta;
      const materialityDelta = right.motion.materiality - left.motion.materiality;
      if (materialityDelta) return materialityDelta;
      const relevanceDelta = right.motion.relevance - left.motion.relevance;
      if (relevanceDelta) return relevanceDelta;
      const noveltyDelta = right.motion.novelty - left.motion.novelty;
      if (noveltyDelta) return noveltyDelta;
      const occurredDelta = Date.parse(right.motion.occurred_at) - Date.parse(left.motion.occurred_at);
      if (occurredDelta) return occurredDelta;
      return left.motion.id.localeCompare(right.motion.id);
    })
    .slice(0, MARKET_MOTION_PROMOTION_LIMIT);
}

function selectPromotedPacketRefRepairs(
  items: MarketMotionRecord[],
  evidence: EvidencePackItem[],
  now = new Date(),
): MarketMotionPromotionCandidate[] {
  return items
    .filter((item) => marketMotionEffectiveState(item, now) === "PROMOTED")
    .filter(promotableVerification)
    .filter((item) => {
      const packetRef = typeof item.metadata?.promotionEvidencePacketRef === "string"
        ? item.metadata.promotionEvidencePacketRef.trim()
        : "";
      return !packetRef;
    })
    .flatMap((motion): MarketMotionPromotionCandidate[] => {
      const promotionEvidenceId = typeof motion.metadata?.promotionEvidenceId === "string"
        ? motion.metadata.promotionEvidenceId.trim()
        : "";
      if (!promotionEvidenceId) return [];

      const routingClass = deriveMarketMotionRoutingClass({
        primaryStoryId: motion.primary_story_id,
        primaryRegimeSlug: motion.primary_regime_slug,
        nextTest: motion.next_test,
      });
      if (!routingClass) return [];

      const corroborators = eligibleCorroborators(motion, evidence);
      const selectedEvidence = corroborators.find((item) => item.id === promotionEvidenceId);
      if (!selectedEvidence) return [];

      const bounded = corroborators.slice(0, MARKET_MOTION_PROMOTION_EVIDENCE_LIMIT);
      return [{
        motion,
        routingClass,
        selectedEvidence,
        matchingEvidenceIds: bounded.map((item) => item.id),
        matchingOriginItemKeys: [...new Set(
          bounded
            .map(evidenceItemKey)
            .filter((itemKey): itemKey is string => Boolean(itemKey)),
        )],
        evidenceWeight: sourceVerificationWeight(selectedEvidence),
      }];
    })
    .slice(0, MARKET_MOTION_PROMOTION_LIMIT);
}

export function selectPromotedMarketMotion(
  items: MarketMotionRecord[],
  now = new Date(),
  limit = 3,
) {
  return items
    .filter((item) => deriveMarketMotionRoutingClass({
      primaryStoryId: item.primary_story_id,
      primaryRegimeSlug: item.primary_regime_slug,
      nextTest: item.next_test,
    }) !== null)
    .filter((item) => marketMotionEffectiveState(item, now) === "PROMOTED")
    .sort((left, right) => {
      const materialityDelta = right.materiality - left.materiality;
      if (materialityDelta) return materialityDelta;
      const relevanceDelta = right.relevance - left.relevance;
      if (relevanceDelta) return relevanceDelta;
      const verificationDelta = (right.verification_state === "VERIFIED" ? 1 : 0)
        - (left.verification_state === "VERIFIED" ? 1 : 0);
      if (verificationDelta) return verificationDelta;
      return Date.parse(right.occurred_at) - Date.parse(left.occurred_at);
    })
    .slice(0, Math.max(0, limit));
}

export function selectPromotedMarketMotionForDossier(
  items: MarketMotionRecord[],
  now = new Date(),
  limit = 3,
) {
  // Canonical promotion still gates eligibility. Only the Dossier's attention
  // order favours newly occurring market behaviour over older high scores.
  const freshSince = now.getTime() - 24 * 60 * 60 * 1000;
  const freshness = (item: MarketMotionRecord) => {
    const occurredAt = Date.parse(item.occurred_at);
    return Number.isFinite(occurredAt) && occurredAt >= freshSince ? 1 : 0;
  };
  return selectPromotedMarketMotion(items, now, items.length)
    .sort((left, right) => freshness(right) - freshness(left))
    .slice(0, Math.max(0, limit));
}

export function marketMotionPromotionInput(
  candidate: MarketMotionPromotionCandidate,
  input: { researchRunId: string | null; engineRunId: string },
): MarketMotionInput {
  const item = candidate.motion;
  const selectedItemKey = evidenceItemKey(candidate.selectedEvidence);
  if (!selectedItemKey) {
    throw new Error("Market Motion promotion requires exact canonical Evidence item identity.");
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
    promotionReason: `Canonical Evidence ${candidate.selectedEvidence.id} corroborated this Motion during intelligence run ${input.engineRunId}; routing class ${candidate.routingClass} bounds where System 2 may use it. Motion is promoted as short-horizon Dossier context, not as canonical evidence.`,
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
    // market_motion_items.evidence_id is a legacy FK to public.evidence.
    // Canonical intelligence Evidence identity is preserved in immutable
    // promotion metadata and surfaced into Dossier context from there.
    evidenceId: item.evidence_id,
    primaryStoryId: item.primary_story_id,
    primaryRegimeSlug: item.primary_regime_slug,
    metadata: {
      ...(item.metadata || {}),
      promotedFromMotionId: item.id,
      promotionEngineRunId: input.engineRunId,
      promotionResearchRunId: input.researchRunId,
      promotionPolicy: MARKET_MOTION_PROMOTION_POLICY,
      promotionRoutingClass: candidate.routingClass,
      promotionEvidenceId: candidate.selectedEvidence.id,
      promotionEvidencePacketRef: evidencePacketRef(candidate.selectedEvidence),
      promotionEvidenceItemKey: selectedItemKey,
      promotionEvidenceIds: candidate.matchingEvidenceIds.slice(0, MARKET_MOTION_PROMOTION_EVIDENCE_LIMIT),
      promotionEvidenceItemKeys: candidate.matchingOriginItemKeys.slice(0, MARKET_MOTION_PROMOTION_EVIDENCE_LIMIT),
    },
  };
}

export async function promoteMarketMotionFromCanonicalEvidence(input: {
  researchRunId: string | null;
  engineRunId: string;
  evidence: EvidencePackItem[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionPromotionResult> {
  const db = input.client ?? createSupabaseAdminClient();
  const { data, error } = await db
    .from("current_market_motion_items")
    .select("*");

  if (error) {
    throw new Error(`Market Motion promotion read failed: ${error.message}`);
  }

  const rows = (data || []) as MarketMotionRecord[];
  const packetRefRepairs = selectPromotedPacketRefRepairs(rows, input.evidence, input.now);
  const repairMotionIds = new Set(packetRefRepairs.map((candidate) => candidate.motion.id));
  const skippedAlreadyPromoted = rows.filter((item) => (
    deriveMarketMotionRoutingClass({
      primaryStoryId: item.primary_story_id,
      primaryRegimeSlug: item.primary_regime_slug,
      nextTest: item.next_test,
    }) !== null
    && marketMotionEffectiveState(item, input.now) === "PROMOTED"
    && !repairMotionIds.has(item.id)
  )).length;
  const eligible = selectPromotableMarketMotion(rows, input.evidence, input.now);
  const warnings: string[] = [];
  const motionIds: string[] = [];

  for (const candidate of eligible) {
    try {
      const promoted = await persistMarketMotion(
        marketMotionPromotionInput(candidate, {
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
          : `Market Motion promotion failed for ${candidate.motion.motion_key}.`,
      );
    }
  }

  const newlyPromotedCount = motionIds.length;
  let repairedPacketRefs = 0;

  for (const candidate of packetRefRepairs) {
    try {
      const repaired = await persistMarketMotion(
        marketMotionPromotionInput(candidate, {
          researchRunId: input.researchRunId,
          engineRunId: input.engineRunId,
        }),
        db,
      );
      motionIds.push(repaired.id);
      repairedPacketRefs += 1;
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : `Market Motion packet-reference repair failed for ${candidate.motion.motion_key}.`,
      );
    }
  }

  if (repairedPacketRefs > 0) {
    warnings.push(
      `Repaired canonical Dossier Evidence packet reference on ${repairedPacketRefs} already-promoted Motion item(s).`,
    );
  }

  return {
    considered: rows.length,
    eligible: eligible.length,
    promoted: newlyPromotedCount,
    skippedAlreadyPromoted,
    motionIds,
    warnings,
  };
}
