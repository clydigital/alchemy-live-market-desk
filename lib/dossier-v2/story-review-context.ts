import type { MarketDossierV2 } from "./contracts.ts";

export const DOSSIER_MOTION_STORY_REVIEW_CONTEXT_VERSION =
  "dossier-motion-story-review-context/1" as const;

export type DossierMotionStoryReviewContext = {
  contractVersion: typeof DOSSIER_MOTION_STORY_REVIEW_CONTEXT_VERSION;
  authority: "CONTEXT_ONLY";
  dossierId: string;
  motionId: string;
  decision: "ACCEPT" | "REFINE";
  targetStoryId: string;
  canonicalEvidenceId: string;
  routeKind: string;
  routeReason: string;
  primaryStoryId: string | null;
  primaryRegimeSlug: string | null;
  system2Conclusion: string;
  system2Rationale: string;
  nextTest: string | null;
};

type ParsedMotionQueueReason = {
  dossierId: string;
  motionId: string;
  decision: "ACCEPT" | "REFINE";
  routeReason: string | null;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseDossierMotionQueueReason(
  value: string | null | undefined,
): ParsedMotionQueueReason | null {
  const text = clean(value);
  const match = /^dossier_motion_acceptance:([^:|\s]+):([^:|\s]+):(ACCEPT|REFINE)(?:\s+\|\s+(.+))?$/.exec(text);
  if (!match) return null;

  const dossierId = clean(match[1]);
  const motionId = clean(match[2]);
  const decision = match[3] as "ACCEPT" | "REFINE";
  const routeReason = clean(match[4]) || null;
  if (!dossierId || !motionId) return null;

  return { dossierId, motionId, decision, routeReason };
}

/**
 * Recover the exact Dossier System-2 framing that caused an A3 Story wake.
 *
 * This is analytical context only. The queue's canonical Evidence UUID remains
 * the sole evidentiary trigger and is independently enforced by Story review.
 * Raw Motion prose is intentionally not returned.
 */
export function buildDossierMotionStoryReviewContext(input: {
  dossier: MarketDossierV2;
  queueReason: string;
  targetStoryId: string;
  canonicalEvidenceId: string;
}): DossierMotionStoryReviewContext | null {
  const parsed = parseDossierMotionQueueReason(input.queueReason);
  if (!parsed || parsed.dossierId !== input.dossier.id) return null;

  const propagation = object(input.dossier.payload.reevaluation_propagation);
  const propagationItems = Array.isArray(propagation?.items)
    ? propagation!.items
    : [];
  const matchingPropagation = propagationItems.filter((raw) => {
    const item = object(raw);
    if (!item) return false;
    return clean(item.motion_id) === parsed.motionId
      && clean(item.decision) === parsed.decision
      && clean(item.target_story_id) === input.targetStoryId
      && clean(item.canonical_evidence_id) === input.canonicalEvidenceId
      && item.source_kind !== "dossier_story_evidence";
  });
  if (matchingPropagation.length !== 1) return null;

  const propagated = object(matchingPropagation[0])!;
  const routeKind = clean(propagated.route_kind);
  const routeReason = clean(propagated.route_reason);
  const canonicalEvidenceRef = clean(propagated.canonical_evidence_ref);
  if (!routeKind || !routeReason || !canonicalEvidenceRef) return null;
  if (parsed.routeReason !== null && parsed.routeReason !== routeReason) return null;

  const analytical = object(input.dossier.payload.analytical_output);
  const acceptance = object(analytical?.motion_acceptance);
  const decisions = Array.isArray(acceptance?.decisions) ? acceptance!.decisions : [];
  const matchingDecisions = decisions.filter((raw) => {
    const decision = object(raw);
    return decision
      && clean(decision.motion_id) === parsed.motionId
      && clean(decision.decision) === parsed.decision;
  });
  if (matchingDecisions.length !== 1) return null;

  const decision = object(matchingDecisions[0])!;
  const conclusion = clean(decision.conclusion);
  const rationale = clean(decision.rationale);
  const nextTest = clean(decision.next_test) || null;
  const evidenceRefs = Array.isArray(decision.canonical_evidence_refs)
    ? decision.canonical_evidence_refs.map(clean).filter(Boolean)
    : [];
  if (!conclusion || !rationale || !evidenceRefs.includes(canonicalEvidenceRef)) return null;

  const motionSnapshot = object(input.dossier.payload.motion_context_snapshot);
  const motionItems = Array.isArray(motionSnapshot?.items) ? motionSnapshot!.items : [];
  const matchingMotions = motionItems.filter((raw) => {
    const motion = object(raw);
    return motion && clean(motion.motion_id) === parsed.motionId;
  });
  if (matchingMotions.length !== 1) return null;

  const motion = object(matchingMotions[0])!;

  return {
    contractVersion: DOSSIER_MOTION_STORY_REVIEW_CONTEXT_VERSION,
    authority: "CONTEXT_ONLY",
    dossierId: input.dossier.id,
    motionId: parsed.motionId,
    decision: parsed.decision,
    targetStoryId: input.targetStoryId,
    canonicalEvidenceId: input.canonicalEvidenceId,
    routeKind,
    routeReason,
    primaryStoryId: clean(motion.primary_story_id) || null,
    primaryRegimeSlug: clean(motion.primary_regime_slug) || null,
    system2Conclusion: conclusion,
    system2Rationale: rationale,
    nextTest,
  };
}
