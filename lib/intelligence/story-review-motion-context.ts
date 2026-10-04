export const STORY_REVIEW_MOTION_CONTEXT_VERSION = "story-review-motion-context/1" as const;

export type StoryReviewMotionContext = {
  contractVersion: typeof STORY_REVIEW_MOTION_CONTEXT_VERSION;
  authority: "CONTEXT_ONLY";
  dossierId: string;
  motionId: string;
  decision: "ACCEPT" | "REFINE";
  canonicalReassessmentScope: "STORY" | "STORY_AND_REGIME";
  storyId: string;
  packetEvidenceId: string;
  evidenceReferences: string[];
  framing: {
    headline: string;
    whyInteresting: string;
    bigPictureBridge: string;
  };
  storyImplication: string;
  regimeImplication: string | null;
  investigationNext: string | null;
};

export type ParsedDossierMotionRefreshReason = {
  dossierId: string;
  motionId: string;
  decision: "ACCEPT" | "REFINE";
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(clean).filter(Boolean))]
    : [];
}

export function parseDossierMotionRefreshReason(
  reason: string | null | undefined,
): ParsedDossierMotionRefreshReason | null {
  const value = clean(reason);
  const match = /^dossier_motion_refresh:([^:]+):([^:]+):(ACCEPT|REFINE)$/.exec(value);
  if (!match) return null;
  return {
    dossierId: match[1]!,
    motionId: match[2]!,
    decision: match[3] as "ACCEPT" | "REFINE",
  };
}

/**
 * Build the non-evidentiary Motion framing supplied to existing-Story review.
 *
 * For REFINE, this intentionally exposes only the corrected framing authored by
 * the Dossier Research Brain. The original over-broad Motion headline/bridge
 * are not copied into this context.
 */
export function extractDossierMotionStoryReviewContext(input: {
  dossierId: string;
  storyId: string;
  packetEvidenceId: string;
  queueReason: string;
  dossierPayload: unknown;
}): StoryReviewMotionContext | null {
  const parsed = parseDossierMotionRefreshReason(input.queueReason);
  if (!parsed || parsed.dossierId !== input.dossierId) return null;

  const payload = object(input.dossierPayload);
  if (!payload) return null;

  const snapshots = Array.isArray(payload.motion_attention_snapshot)
    ? payload.motion_attention_snapshot
    : [];
  const analytical = object(payload.analytical_output);
  const assessments = analytical && Array.isArray(analytical.motion_attention_assessments)
    ? analytical.motion_attention_assessments
    : [];

  const snapshot = snapshots
    .map(object)
    .find((item) => item && clean(item.motion_id) === parsed.motionId) ?? null;
  const assessment = assessments
    .map(object)
    .find((item) => item && clean(item.motion_id) === parsed.motionId) ?? null;
  if (!snapshot || !assessment) return null;

  const decision = clean(assessment.decision);
  if (decision !== parsed.decision || (decision !== "ACCEPT" && decision !== "REFINE")) return null;

  const scope = clean(assessment.canonical_reassessment_scope);
  if (scope !== "STORY" && scope !== "STORY_AND_REGIME") return null;

  const storyId = clean(snapshot.primary_story_id);
  const packetEvidenceId = clean(snapshot.packet_evidence_id);
  if (!storyId || storyId !== input.storyId) return null;
  if (!packetEvidenceId || packetEvidenceId !== input.packetEvidenceId) return null;

  const evidenceReferences = stringArray(assessment.evidence_references);
  if (!evidenceReferences.includes(packetEvidenceId)) return null;

  const storyImplication = clean(assessment.story_implication);
  if (!storyImplication) return null;

  const framing = decision === "REFINE"
    ? {
        headline: clean(assessment.refined_headline),
        whyInteresting: clean(assessment.refined_why_interesting),
        bigPictureBridge: clean(assessment.refined_big_picture_bridge),
      }
    : {
        headline: clean(snapshot.headline),
        whyInteresting: clean(snapshot.why_interesting),
        bigPictureBridge: clean(snapshot.big_picture_bridge),
      };

  if (!framing.headline || !framing.whyInteresting || !framing.bigPictureBridge) return null;

  return {
    contractVersion: STORY_REVIEW_MOTION_CONTEXT_VERSION,
    authority: "CONTEXT_ONLY",
    dossierId: parsed.dossierId,
    motionId: parsed.motionId,
    decision,
    canonicalReassessmentScope: scope,
    storyId,
    packetEvidenceId,
    evidenceReferences,
    framing,
    storyImplication,
    regimeImplication: clean(assessment.regime_implication) || null,
    investigationNext: clean(assessment.investigation_next) || null,
  };
}


export type StoryReviewMotionQueueRow = {
  id: string;
  target_id: string;
  reason: string;
  requested_by_evidence_id: string | null;
};

export type StoryReviewMotionDossierRow = {
  id: string;
  payload: unknown;
};

export type StoryReviewMotionEvidenceIdentityRow = {
  id: string;
  external_evidence_id: string | null;
};

export function resolveDossierMotionStoryReviewContexts(input: {
  queueRows: StoryReviewMotionQueueRow[];
  dossiers: StoryReviewMotionDossierRow[];
  evidenceRows: StoryReviewMotionEvidenceIdentityRow[];
}): Map<string, StoryReviewMotionContext> {
  const dossierById = new Map(input.dossiers.map((row) => [row.id, row] as const));
  const evidenceById = new Map(input.evidenceRows.map((row) => [row.id, row] as const));
  const result = new Map<string, StoryReviewMotionContext>();

  for (const row of input.queueRows) {
    const parsed = parseDossierMotionRefreshReason(row.reason);
    if (!parsed || !row.requested_by_evidence_id) continue;
    const dossier = dossierById.get(parsed.dossierId);
    const evidence = evidenceById.get(row.requested_by_evidence_id);
    if (!dossier || !evidence) continue;

    const packetEvidenceId = clean(evidence.external_evidence_id) || `ev:${evidence.id}`;
    const context = extractDossierMotionStoryReviewContext({
      dossierId: parsed.dossierId,
      storyId: row.target_id,
      packetEvidenceId,
      queueReason: row.reason,
      dossierPayload: dossier.payload,
    });
    if (context) result.set(row.id, context);
  }

  return result;
}
