import type {
  ResearchBrainMotionAssessment,
  ResearchBrainMotionAttention,
} from "./research-brain-contracts.ts";

export const DOSSIER_MOTION_STORY_REFRESH_REQUEST_VERSION = "dossier-motion-story-refresh-request/1" as const;
export const MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS = 4;

export type DossierMotionStoryRefreshRequest = {
  contract_version: typeof DOSSIER_MOTION_STORY_REFRESH_REQUEST_VERSION;
  dossier_id: string;
  request_kind: "REASSESS_STORY";
  authority: "REEVALUATION_REQUEST_ONLY";
  motion_id: string;
  story_id: string;
  packet_evidence_id: string;
  decision: "ACCEPT" | "REFINE";
  reason: string;
  evidence_references: string[];
  story_implication: string;
  regime_implication: string | null;
  investigation_next: string | null;
  refined_motion: {
    headline: string;
    why_interesting: string;
    big_picture_bridge: string;
  } | null;
  priority_signals: {
    materiality: number;
    relevance: number;
    novelty: number;
  };
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function validAssessment(
  motion: ResearchBrainMotionAttention,
  assessment: ResearchBrainMotionAssessment | undefined,
) {
  if (!assessment) return false;
  if (assessment.motion_id !== motion.motion_id) return false;
  if (assessment.decision !== "ACCEPT" && assessment.decision !== "REFINE") return false;
  if (!clean(motion.primary_story_id)) return false;
  if (!clean(motion.packet_evidence_id)) return false;
  if (!clean(assessment.story_implication)) return false;
  if (!assessment.evidence_references.includes(motion.packet_evidence_id)) return false;

  if (assessment.decision === "REFINE") {
    return Boolean(
      clean(assessment.refined_headline)
      && clean(assessment.refined_why_interesting)
      && clean(assessment.refined_big_picture_bridge),
    );
  }

  return true;
}

/**
 * Convert validated System-2 Motion assessments into exact Story reassessment
 * requests. This function never queues work or mutates Story/Regime state.
 *
 * Motion remains non-evidentiary. packet_evidence_id is the exact canonical
 * packet evidence reference System 2 was required to cite before this request
 * can exist.
 */
export function buildDossierMotionStoryRefreshRequests(input: {
  dossierId: string;
  motionAttention: ResearchBrainMotionAttention[];
  assessments: ResearchBrainMotionAssessment[];
}): DossierMotionStoryRefreshRequest[] {
  const dossierId = input.dossierId.trim();
  if (!dossierId) return [];

  const assessmentByMotionId = new Map(
    input.assessments.map((assessment) => [assessment.motion_id, assessment] as const),
  );

  return input.motionAttention
    .flatMap((motion): DossierMotionStoryRefreshRequest[] => {
      const assessment = assessmentByMotionId.get(motion.motion_id);
      if (!validAssessment(motion, assessment)) return [];

      const decision: "ACCEPT" | "REFINE" = assessment!.decision === "REFINE"
        ? "REFINE"
        : "ACCEPT";
      const refinedMotion = decision === "REFINE"
        ? {
            headline: clean(assessment!.refined_headline),
            why_interesting: clean(assessment!.refined_why_interesting),
            big_picture_bridge: clean(assessment!.refined_big_picture_bridge),
          }
        : null;

      return [{
        contract_version: DOSSIER_MOTION_STORY_REFRESH_REQUEST_VERSION,
        dossier_id: dossierId,
        request_kind: "REASSESS_STORY",
        authority: "REEVALUATION_REQUEST_ONLY",
        motion_id: motion.motion_id,
        story_id: clean(motion.primary_story_id),
        packet_evidence_id: motion.packet_evidence_id,
        decision,
        reason: assessment!.reason.trim(),
        evidence_references: [...new Set(assessment!.evidence_references)],
        story_implication: clean(assessment!.story_implication),
        regime_implication: clean(assessment!.regime_implication) || null,
        investigation_next: clean(assessment!.investigation_next) || null,
        refined_motion: refinedMotion,
        priority_signals: {
          materiality: motion.materiality,
          relevance: motion.relevance,
          novelty: motion.novelty,
        },
      }];
    })
    .sort((left, right) =>
      right.priority_signals.materiality - left.priority_signals.materiality
      || right.priority_signals.relevance - left.priority_signals.relevance
      || right.priority_signals.novelty - left.priority_signals.novelty
      || left.motion_id.localeCompare(right.motion_id)
    )
    .slice(0, MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS);
}
