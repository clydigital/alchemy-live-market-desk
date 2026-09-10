import type { DivergenceOutput, EvidencePackItem } from "./schemas.ts";
import { buildDivergenceDigestShadow } from "./divergence-digest-shadow.ts";

export const STAGE_ADMISSION_SHADOW_VERSION = "stage-admission-shadow-v1" as const;

export type StageAdmissionShadowDecision = {
  version: typeof STAGE_ADMISSION_SHADOW_VERSION;
  stageKey: "divergence";
  decision: "would_run" | "would_skip";
  reason: "no_beliefs" | "unresolved_belief_anchors_fail_open" | "material_context_present" | "no_context_beyond_belief_evidence";
  sourceEvidenceCount: number;
  anchorEvidenceCount: number;
  candidateEvidenceCount: number;
  contextualEvidenceCount: number;
};

export type StageAdmissionShadowResult = StageAdmissionShadowDecision & {
  actualMaterialResult: boolean;
  actualOutputCount: number;
};

type BeliefLike = {
  evidence_ids?: string[];
  affected_assets?: string[];
};

/**
 * Shadow-only admission decision for Divergence.
 *
 * This does not skip the stage. The rule deliberately fails open whenever the
 * belief anchors cannot be resolved. A skip candidate is emitted only when the
 * compact candidate contains no evidence beyond the exact Market Belief
 * evidence already used upstream.
 */
export function buildDivergenceStageAdmissionShadow(input: {
  beliefs: BeliefLike[];
  evidence: EvidencePackItem[];
}): StageAdmissionShadowDecision {
  if (!input.beliefs.length) {
    return {
      version: STAGE_ADMISSION_SHADOW_VERSION,
      stageKey: "divergence",
      decision: "would_skip",
      reason: "no_beliefs",
      sourceEvidenceCount: input.evidence.length,
      anchorEvidenceCount: 0,
      candidateEvidenceCount: 0,
      contextualEvidenceCount: 0,
    };
  }

  const digest = buildDivergenceDigestShadow(input);
  if (!digest.anchorEvidenceCount) {
    return {
      version: STAGE_ADMISSION_SHADOW_VERSION,
      stageKey: "divergence",
      decision: "would_run",
      reason: "unresolved_belief_anchors_fail_open",
      sourceEvidenceCount: digest.sourceEvidenceCount,
      anchorEvidenceCount: 0,
      candidateEvidenceCount: digest.candidateEvidenceCount,
      contextualEvidenceCount: digest.candidateEvidenceCount,
    };
  }

  const contextualEvidenceCount = Math.max(0, digest.candidateEvidenceCount - digest.anchorEvidenceCount);
  if (contextualEvidenceCount === 0) {
    return {
      version: STAGE_ADMISSION_SHADOW_VERSION,
      stageKey: "divergence",
      decision: "would_skip",
      reason: "no_context_beyond_belief_evidence",
      sourceEvidenceCount: digest.sourceEvidenceCount,
      anchorEvidenceCount: digest.anchorEvidenceCount,
      candidateEvidenceCount: digest.candidateEvidenceCount,
      contextualEvidenceCount,
    };
  }

  return {
    version: STAGE_ADMISSION_SHADOW_VERSION,
    stageKey: "divergence",
    decision: "would_run",
    reason: "material_context_present",
    sourceEvidenceCount: digest.sourceEvidenceCount,
    anchorEvidenceCount: digest.anchorEvidenceCount,
    candidateEvidenceCount: digest.candidateEvidenceCount,
    contextualEvidenceCount,
  };
}

export function observeDivergenceStageAdmissionShadow(
  decision: StageAdmissionShadowDecision,
  output: unknown,
): StageAdmissionShadowResult {
  const divergences = output && typeof output === "object" && !Array.isArray(output)
    && Array.isArray((output as Partial<DivergenceOutput>).divergences)
    ? (output as DivergenceOutput).divergences
    : [];
  return {
    ...decision,
    actualMaterialResult: divergences.length > 0,
    actualOutputCount: divergences.length,
  };
}
