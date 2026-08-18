import type { EvidencePackItem, ExistingStoryPackItem } from "./schemas.ts";

export type BeliefRowLike = {
  evidence_ids?: string[];
  affected_assets?: string[];
};

export type DivergenceRowLike = {
  decisive_evidence_ids?: string[];
};

/**
 * Pure Hypothesis Domain Helpers
 */

/**
 * Builds a deterministic Hypothesis evidence pack from upstream state.
 * Scope Invariant: Returns strictly the union of evidence IDs cited by Market Beliefs
 * and Divergences. If no cited evidence IDs resolve, returns an empty array.
 * Never falls back to the full evidence universe.
 */
export function buildHypothesisEvidencePack(
  beliefs: BeliefRowLike[],
  divergences: DivergenceRowLike[],
  allEvidence: EvidencePackItem[],
): EvidencePackItem[] {
  const relevantIds = new Set<string>();
  for (const belief of beliefs) {
    for (const id of belief.evidence_ids ?? []) {
      relevantIds.add(id);
    }
  }
  for (const divergence of divergences) {
    for (const id of divergence.decisive_evidence_ids ?? []) {
      relevantIds.add(id);
    }
  }

  if (relevantIds.size === 0) return [];
  return allEvidence.filter((item) => relevantIds.has(item.id));
}

/**
 * Builds a deterministic Hypothesis story pack from upstream state and hypothesis evidence.
 * Scope Invariant: Returns strictly existing stories whose assets match affected assets.
 * If no story matches or no affected assets are present, returns an empty array.
 * Never falls back to unrelated full story history.
 */
export function buildHypothesisStoryPack(
  beliefs: BeliefRowLike[],
  hypothesisEvidence: EvidencePackItem[],
  existingStoriesPack: ExistingStoryPackItem[],
): ExistingStoryPackItem[] {
  const affectedAssets = new Set<string>([
    ...beliefs.flatMap((b) => b.affected_assets ?? []),
    ...hypothesisEvidence.flatMap((e) => e.affectedAssets ?? []),
  ]);

  if (affectedAssets.size === 0) return [];

  return existingStoriesPack.filter((story) =>
    (story.assets ?? []).some((asset) => affectedAssets.has(asset))
  );
}

/**
 * Persistence Scope Invariant: Hypotheses must not persist evidence IDs outside
 * the exact evidence pack supplied to the Hypothesis stage.
 */
export function restrictHypothesisEvidenceIds(
  evidenceIds: string[] | undefined,
  allowedEvidenceIds: Set<string>,
): string[] {
  if (!evidenceIds || !Array.isArray(evidenceIds)) return [];
  return [...new Set(evidenceIds.filter((id) => allowedEvidenceIds.has(id)))];
}
