import type { SupabaseClient } from "@supabase/supabase-js";

import {
  marketMotionEffectiveState,
  persistMarketMotion,
  type MarketMotionInput,
  type MarketMotionRecord,
} from "./market-motion.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { ResearchBrainMotionAssessment } from "./dossier-v2/research-brain-contracts.ts";

export const MARKET_MOTION_PROMOTION_MIN_MATERIALITY = 80;
export const MARKET_MOTION_PROMOTION_MIN_RELEVANCE = 75;
export const MARKET_MOTION_PROMOTION_LIMIT = 6;
export const MARKET_MOTION_DOSSIER_PROMOTION_POLICY = "dossier-motion-assessment/v1" as const;

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

export function selectPromotedMarketMotion(
  items: MarketMotionRecord[],
  now = new Date(),
  limit = 3,
) {
  return items
    .filter((item) => Boolean(item.primary_story_id))
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
  return selectPromotedMarketMotion(items, now, limit);
}

export function selectDossierAcceptedPromotableMarketMotion(
  items: MarketMotionRecord[],
  assessments: ResearchBrainMotionAssessment[],
  now = new Date(),
  limit = MARKET_MOTION_PROMOTION_LIMIT,
) {
  const acceptedByMotionId = new Map(
    assessments
      .filter((assessment) => assessment.decision === "ACCEPT")
      .map((assessment) => [assessment.motion_id, assessment] as const),
  );

  return items
    .filter((item) => acceptedByMotionId.has(item.id))
    .filter((item) => Boolean(item.primary_story_id))
    .filter((item) => marketMotionEffectiveState(item, now) !== "EXPIRED")
    .filter((item) => item.lifecycle_state === "MOTION")
    .filter(promotableVerification)
    .filter((item) => item.materiality >= MARKET_MOTION_PROMOTION_MIN_MATERIALITY)
    .filter((item) => item.relevance >= MARKET_MOTION_PROMOTION_MIN_RELEVANCE)
    .filter((item) => {
      const assessment = acceptedByMotionId.get(item.id);
      return Boolean(
        assessment
        && assessment.evidence_references.length > 0
        && assessment.reason.trim()
        && assessment.story_implication?.trim(),
      );
    })
    .sort((left, right) => {
      const materialityDelta = right.materiality - left.materiality;
      if (materialityDelta) return materialityDelta;
      const relevanceDelta = right.relevance - left.relevance;
      if (relevanceDelta) return relevanceDelta;
      const noveltyDelta = right.novelty - left.novelty;
      if (noveltyDelta) return noveltyDelta;
      return Date.parse(right.observed_at) - Date.parse(left.observed_at);
    })
    .slice(0, Math.max(0, limit));
}

export function marketMotionDossierPromotionInput(
  item: MarketMotionRecord,
  assessment: ResearchBrainMotionAssessment,
  input: { dossierId: string },
): MarketMotionInput {
  if (assessment.decision !== "ACCEPT") {
    throw new Error("Dossier Motion promotion requires an ACCEPT assessment.");
  }
  if (assessment.motion_id !== item.id) {
    throw new Error("Dossier Motion promotion assessment must target the exact Motion row.");
  }
  if (!item.primary_story_id) {
    throw new Error("B1 Dossier Motion promotion requires an exact canonical Story link.");
  }
  if (!assessment.evidence_references.length) {
    throw new Error("Dossier Motion promotion requires canonical evidence references.");
  }
  if (!assessment.story_implication?.trim()) {
    throw new Error("B1 Dossier Motion promotion requires an accepted Story implication.");
  }

  return {
    motionKey: item.motion_key,
    lifecycleState: "PROMOTED",
    category: item.category,
    verificationState: item.verification_state,
    headline: item.headline,
    whatHappened: item.what_happened,
    marketReaction: item.market_reaction,
    whyInteresting: assessment.story_implication?.trim()
      || assessment.regime_implication?.trim()
      || item.why_interesting,
    bigPictureBridge: assessment.regime_implication?.trim()
      || assessment.story_implication?.trim()
      || item.big_picture_bridge,
    nextTest: assessment.investigation_next?.trim() || item.next_test,
    promotionReason: `Validated Dossier ${input.dossierId} accepted this Motion against canonical packet evidence; promotion preserves the exact Story link and does not itself mutate Story or Regime state.`,
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
    researchRunId: item.research_run_id,
    sourceId: item.source_id,
    evidenceId: item.evidence_id,
    primaryStoryId: item.primary_story_id,
    primaryRegimeSlug: item.primary_regime_slug,
    metadata: {
      ...(item.metadata || {}),
      promotedFromMotionId: item.id,
      promotionDossierId: input.dossierId,
      promotionDecision: assessment.decision,
      promotionEvidenceRefs: [...assessment.evidence_references],
      promotionAssessmentReason: assessment.reason,
      promotionPolicy: MARKET_MOTION_DOSSIER_PROMOTION_POLICY,
    },
  };
}

export async function promoteMarketMotionFromDossierAssessments(input: {
  dossierId: string;
  assessments: ResearchBrainMotionAssessment[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionPromotionResult> {
  const accepted = input.assessments.filter((assessment) => assessment.decision === "ACCEPT");
  if (!accepted.length) {
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
  const assessedIds = [...new Set(accepted.map((assessment) => assessment.motion_id).filter(Boolean))];
  const { data, error } = await db
    .from("current_market_motion_items")
    .select("*")
    .in("id", assessedIds);

  if (error) {
    throw new Error(`Dossier Motion promotion read failed: ${error.message}`);
  }

  const rows = (data || []) as MarketMotionRecord[];
  const eligible = selectDossierAcceptedPromotableMarketMotion(
    rows,
    accepted,
    input.now,
  );
  const assessmentByMotionId = new Map(accepted.map((assessment) => [assessment.motion_id, assessment] as const));
  const warnings: string[] = [];
  const motionIds: string[] = [];

  for (const item of eligible) {
    const assessment = assessmentByMotionId.get(item.id);
    if (!assessment) continue;
    try {
      const promoted = await persistMarketMotion(
        marketMotionDossierPromotionInput(item, assessment, {
          dossierId: input.dossierId,
        }),
        db,
      );
      motionIds.push(promoted.id);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : `Dossier Motion promotion failed for ${item.motion_key}.`,
      );
    }
  }

  return {
    considered: rows.length,
    eligible: eligible.length,
    promoted: motionIds.length,
    skippedAlreadyPromoted: 0,
    motionIds,
    warnings,
  };
}
