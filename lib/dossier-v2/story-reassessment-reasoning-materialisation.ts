import { createHash } from "node:crypto";

import type { DossierStoryReassessmentProposal } from "./motion-story-reassessment-proposal.ts";
import type { DossierStoryCanonicalPersistenceHandoff } from "./story-reassessment-persistence-handoff.ts";
import {
  buildCanonicalStoryReasoningSnapshotV1,
  type CanonicalStoryReasoningSnapshotV1,
  type StoryReasoningChallenger,
  type StoryReasoningEvidence,
  type StoryReasoningHypothesis,
  type StoryReasoningScenario,
  type StoryReasoningSynthesis,
} from "../intelligence/story-reasoning.ts";
import { isValidUuid } from "./validation.ts";

export const DOSSIER_STORY_REASONING_MATERIALISATION_VERSION =
  "dossier-story-reasoning-materialisation/1" as const;

export type DossierStoryReasoningMaterialisation = {
  contract_version: typeof DOSSIER_STORY_REASONING_MATERIALISATION_VERSION;
  authority: "CANONICAL_REASONING_PAYLOAD_ONLY";
  story_id: string;
  dossier_id: string;
  motion_id: string;
  expected_base_version_id: string;
  mutation_key: string;
  required_canonical_evidence_ids: string[];
  reasoning_contract: "canonical-story-reasoning/v1";
  reasoning_fingerprint: string;
  reasoning: CanonicalStoryReasoningSnapshotV1;
};

export type DossierStoryCanonicalReasoningInput = {
  synthesis: StoryReasoningSynthesis;
  hypothesis: StoryReasoningHypothesis;
  competingHypotheses?: StoryReasoningHypothesis[];
  challenger: StoryReasoningChallenger | null;
  scenarios: StoryReasoningScenario[];
  evidence: StoryReasoningEvidence[];
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function uuidText(value: string): boolean {
  return isValidUuid(value);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function digest(value: string, length = 32) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

/**
 * Materialise Dossier-triggered existing-Story reassessment into the exact
 * canonical-story-reasoning/v1 snapshot contract already used by the canonical
 * Story persistence path.
 *
 * This function is pure. It does not write Story state, thesis versions,
 * events, queue state, Regime state or publication snapshots.
 */
export function materialiseDossierStoryCanonicalReasoning(input: {
  proposal: DossierStoryReassessmentProposal;
  handoff: DossierStoryCanonicalPersistenceHandoff;
  reassessment: DossierStoryCanonicalReasoningInput;
}): DossierStoryReasoningMaterialisation | null {
  const { proposal, handoff, reassessment } = input;

  if (proposal.authority !== "PROPOSAL_ONLY") return null;
  if (handoff.authority !== "HANDOFF_ONLY") return null;
  if (handoff.writer_route !== "rpc/persist_canonical_story_reasoning") return null;
  if (handoff.required_reasoning_contract !== "canonical-story-reasoning/v1") return null;

  if (
    handoff.story_id !== proposal.story_id
    || handoff.dossier_id !== proposal.dossier_id
    || handoff.motion_id !== proposal.motion_id
    || handoff.expected_base_version_id !== proposal.expected_base_version_id
    || handoff.decision !== proposal.decision
    || handoff.canonical_reassessment_scope !== proposal.canonical_reassessment_scope
  ) {
    return null;
  }

  const requiredEvidenceIds = unique(
    handoff.required_canonical_evidence_ids.map(clean).filter(Boolean),
  );
  if (!requiredEvidenceIds.length || requiredEvidenceIds.some((id) => !uuidText(id))) {
    return null;
  }

  const evidence = reassessment.evidence.map((item) => ({
    id: clean(item.id),
    claim: clean(item.claim),
  }));
  if (
    !evidence.length
    || evidence.some((item) => !uuidText(item.id) || !item.claim)
    || new Set(evidence.map((item) => item.id)).size !== evidence.length
  ) {
    return null;
  }

  const evidenceById = new Map(evidence.map((item) => [item.id, item] as const));
  if (requiredEvidenceIds.some((id) => !evidenceById.has(id))) return null;

  const decisiveEvidenceIds = unique(reassessment.synthesis.decisiveEvidenceIds.map(clean).filter(Boolean));
  const thesisEvidenceIds = unique(reassessment.hypothesis.evidenceForIds.map(clean).filter(Boolean));

  // The exact canonical packet evidence that justified the Dossier ACCEPT/REFINE
  // must remain material in the canonical Story reasoning. Merely loading it as
  // context is insufficient.
  if (requiredEvidenceIds.some((id) => !decisiveEvidenceIds.includes(id))) return null;
  if (requiredEvidenceIds.some((id) => !thesisEvidenceIds.includes(id))) return null;

  if (!clean(reassessment.synthesis.thesis)) return null;
  if (!clean(reassessment.hypothesis.id)) return null;

  let reasoning: CanonicalStoryReasoningSnapshotV1;
  try {
    reasoning = buildCanonicalStoryReasoningSnapshotV1({
      synthesis: {
        ...reassessment.synthesis,
        thesis: clean(reassessment.synthesis.thesis),
        decisiveEvidenceIds,
      },
      hypothesis: {
        ...reassessment.hypothesis,
        id: clean(reassessment.hypothesis.id),
        evidenceForIds: thesisEvidenceIds,
      },
      competingHypotheses: reassessment.competingHypotheses,
      challenger: reassessment.challenger,
      scenarios: reassessment.scenarios,
      evidenceById,
    });
  } catch {
    return null;
  }

  const thesisClaim = reasoning.claims.find((claim) => claim.type === "thesis");
  if (!thesisClaim) return null;
  if (requiredEvidenceIds.some((id) => !thesisClaim.evidenceIds.includes(id))) return null;

  const factEvidenceIds = new Set(
    reasoning.claims
      .filter((claim) => claim.type === "fact")
      .flatMap((claim) => claim.evidenceIds),
  );
  if (requiredEvidenceIds.some((id) => !factEvidenceIds.has(id))) return null;

  const reasoningFingerprint = digest(JSON.stringify(reasoning));

  return {
    contract_version: DOSSIER_STORY_REASONING_MATERIALISATION_VERSION,
    authority: "CANONICAL_REASONING_PAYLOAD_ONLY",
    story_id: proposal.story_id,
    dossier_id: proposal.dossier_id,
    motion_id: proposal.motion_id,
    expected_base_version_id: proposal.expected_base_version_id,
    mutation_key: handoff.mutation_key,
    required_canonical_evidence_ids: requiredEvidenceIds,
    reasoning_contract: "canonical-story-reasoning/v1",
    reasoning_fingerprint: reasoningFingerprint,
    reasoning,
  };
}
