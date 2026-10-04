import { createHash } from "node:crypto";

import type { DossierStoryReassessmentProposal } from "./motion-story-reassessment-proposal.ts";
import { isValidUuid } from "./validation.ts";

export const DOSSIER_STORY_CANONICAL_HANDOFF_VERSION =
  "dossier-story-canonical-handoff/1" as const;

export const CANONICAL_STORY_REASONING_WRITER_ROUTE =
  "rpc/persist_canonical_story_reasoning" as const;

export const CANONICAL_STORY_REASONING_CONTRACT =
  "canonical-story-reasoning/v1" as const;

export type DossierStoryCanonicalPersistenceHandoff = {
  contract_version: typeof DOSSIER_STORY_CANONICAL_HANDOFF_VERSION;
  authority: "HANDOFF_ONLY";
  mutation_kind: "existing_story_update";
  writer_route: typeof CANONICAL_STORY_REASONING_WRITER_ROUTE;
  required_reasoning_contract: typeof CANONICAL_STORY_REASONING_CONTRACT;
  mutation_key: string;
  dossier_id: string;
  motion_id: string;
  story_id: string;
  expected_base_version_id: string;
  decision: "ACCEPT" | "REFINE";
  canonical_reassessment_scope: "STORY" | "STORY_AND_REGIME";
  required_canonical_evidence_ids: string[];
  proposal_fingerprint: string;
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function uuidText(value: string): boolean {
  return isValidUuid(value);
}

function digest(parts: readonly string[], length = 32) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, length);
}

/**
 * Prepare a Dossier Story reassessment for the existing canonical Story writer.
 *
 * This is a handoff contract only. It performs no database write and carries
 * no Story payload or reasoning payload. B4.4 must materialise validated
 * canonical-story-reasoning/v1 before the existing atomic writer can run.
 */
export function buildDossierStoryCanonicalPersistenceHandoff(input: {
  proposal: DossierStoryReassessmentProposal;
  current_thesis_version_id: string | null;
}): DossierStoryCanonicalPersistenceHandoff | null {
  const { proposal } = input;

  if (proposal.authority !== "PROPOSAL_ONLY") return null;
  if (proposal.proposal_kind !== "REASSESS_EXISTING_STORY") return null;

  const dossierId = clean(proposal.dossier_id);
  const motionId = clean(proposal.motion_id);
  const storyId = clean(proposal.story_id);
  const expectedBaseVersionId = clean(proposal.expected_base_version_id);
  const currentVersionId = clean(input.current_thesis_version_id);

  if (!dossierId || !motionId || !storyId) return null;
  if (!expectedBaseVersionId || !uuidText(expectedBaseVersionId)) return null;
  if (!currentVersionId || !uuidText(currentVersionId)) return null;
  if (currentVersionId !== expectedBaseVersionId) return null;

  if (proposal.decision !== "ACCEPT" && proposal.decision !== "REFINE") return null;
  if (
    proposal.canonical_reassessment_scope !== "STORY"
    && proposal.canonical_reassessment_scope !== "STORY_AND_REGIME"
  ) {
    return null;
  }

  const evidenceIds = [...new Set(
    proposal.required_canonical_evidence_ids.map(clean).filter(Boolean),
  )];
  if (!evidenceIds.length || evidenceIds.some((id) => !uuidText(id))) return null;

  const proposalFingerprint = digest([
    proposal.contract_version,
    dossierId,
    motionId,
    storyId,
    expectedBaseVersionId,
    proposal.decision,
    proposal.canonical_reassessment_scope,
    ...evidenceIds,
    clean(proposal.story_implication),
    clean(proposal.dossier_reason),
  ]);

  const mutationKey = [
    "dossier-story-reassessment",
    storyId,
    expectedBaseVersionId,
    digest([dossierId, motionId, proposalFingerprint], 24),
  ].join(":");

  return {
    contract_version: DOSSIER_STORY_CANONICAL_HANDOFF_VERSION,
    authority: "HANDOFF_ONLY",
    mutation_kind: "existing_story_update",
    writer_route: CANONICAL_STORY_REASONING_WRITER_ROUTE,
    required_reasoning_contract: CANONICAL_STORY_REASONING_CONTRACT,
    mutation_key: mutationKey,
    dossier_id: dossierId,
    motion_id: motionId,
    story_id: storyId,
    expected_base_version_id: expectedBaseVersionId,
    decision: proposal.decision,
    canonical_reassessment_scope: proposal.canonical_reassessment_scope,
    required_canonical_evidence_ids: evidenceIds,
    proposal_fingerprint: proposalFingerprint,
  };
}
