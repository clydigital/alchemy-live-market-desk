import type { ResolvedDossierMotionStoryWakeTarget } from "./motion-story-wake-target.ts";
import { isValidUuid } from "./validation.ts";

export const DOSSIER_STORY_REASSESSMENT_PROPOSAL_VERSION =
  "dossier-story-reassessment-proposal/1" as const;

export type DossierStoryReassessmentBaseline = {
  id: string;
  current_thesis_version_id: string | null;
  thesis: string;
  status: string;
  confidence: number;
  market_question: string | null;
};

export type DossierStoryReassessmentProposal = {
  contract_version: typeof DOSSIER_STORY_REASSESSMENT_PROPOSAL_VERSION;
  authority: "PROPOSAL_ONLY";
  proposal_kind: "REASSESS_EXISTING_STORY";
  dossier_id: string;
  motion_id: string;
  story_id: string;
  decision: "ACCEPT" | "REFINE";
  canonical_reassessment_scope: "STORY" | "STORY_AND_REGIME";
  expected_base_version_id: string;
  baseline: {
    thesis: string;
    status: string;
    confidence: number;
    market_question: string | null;
  };
  packet_evidence_reference: string;
  required_canonical_evidence_ids: [string];
  dossier_reason: string;
  story_implication: string;
  regime_implication: string | null;
  investigation_next: string | null;
  refined_motion: ResolvedDossierMotionStoryWakeTarget["refined_motion"];
  requested_update: {
    action: "REASSESS_WITH_CANONICAL_EVIDENCE";
    implication: string;
  };
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function uuidText(value: string): boolean {
  return isValidUuid(value);
}

/**
 * Convert an exact, canonically evidenced Story wake target into a deterministic
 * reassessment proposal bound to the Story's current immutable thesis version.
 *
 * This does not decide the new thesis, confidence or lifecycle. It only records
 * which exact Story/version must be reassessed, why, and the minimum canonical
 * evidence that must be considered by the existing Story reasoning path.
 */
export function buildDossierStoryReassessmentProposal(input: {
  target: ResolvedDossierMotionStoryWakeTarget;
  story: DossierStoryReassessmentBaseline;
}): DossierStoryReassessmentProposal | null {
  const { target, story } = input;

  const storyId = clean(story.id);
  const targetStoryId = clean(target.story_id);
  const baseVersionId = clean(story.current_thesis_version_id);
  const thesis = clean(story.thesis);
  const status = clean(story.status);
  const canonicalEvidenceId = clean(target.canonical_evidence_id);
  const storyImplication = clean(target.story_implication);

  if (!storyId || storyId !== targetStoryId) return null;
  if (!baseVersionId || !uuidText(baseVersionId)) return null;
  if (!thesis || !status || status === "discarded") return null;
  if (!Number.isFinite(story.confidence)) return null;
  if (!canonicalEvidenceId || !uuidText(canonicalEvidenceId)) return null;
  if (!storyImplication) return null;
  if (target.decision !== "ACCEPT" && target.decision !== "REFINE") return null;
  if (
    target.canonical_reassessment_scope !== "STORY"
    && target.canonical_reassessment_scope !== "STORY_AND_REGIME"
  ) {
    return null;
  }

  if (target.decision === "REFINE") {
    if (
      !target.refined_motion
      || !clean(target.refined_motion.headline)
      || !clean(target.refined_motion.why_interesting)
      || !clean(target.refined_motion.big_picture_bridge)
    ) {
      return null;
    }
  }

  return {
    contract_version: DOSSIER_STORY_REASSESSMENT_PROPOSAL_VERSION,
    authority: "PROPOSAL_ONLY",
    proposal_kind: "REASSESS_EXISTING_STORY",
    dossier_id: clean(target.dossier_id),
    motion_id: clean(target.motion_id),
    story_id: targetStoryId,
    decision: target.decision,
    canonical_reassessment_scope: target.canonical_reassessment_scope,
    expected_base_version_id: baseVersionId,
    baseline: {
      thesis,
      status,
      confidence: story.confidence,
      market_question: clean(story.market_question) || null,
    },
    packet_evidence_reference: clean(target.packet_evidence_reference),
    required_canonical_evidence_ids: [canonicalEvidenceId],
    dossier_reason: clean(target.reason),
    story_implication: storyImplication,
    regime_implication: clean(target.regime_implication) || null,
    investigation_next: clean(target.investigation_next) || null,
    refined_motion: target.refined_motion,
    requested_update: {
      action: "REASSESS_WITH_CANONICAL_EVIDENCE",
      implication: storyImplication,
    },
  };
}
