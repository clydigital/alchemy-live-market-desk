import type { EvidencePackItem, ExistingStoryPackItem, HypothesisOutput } from "./schemas.ts";

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
  allowedEvidenceIds: ReadonlySet<string>,
): string[] {
  if (!evidenceIds || !Array.isArray(evidenceIds)) return [];
  return [...new Set(evidenceIds.filter((id) => allowedEvidenceIds.has(id)))];
}

export type HypothesisEvidenceSanitizationResult = {
  output: HypothesisOutput;
  removedReferenceCount: number;
  droppedHypothesisCount: number;
};

/**
 * Provider-boundary safety net for model-generated Hypothesis evidence IDs.
 *
 * Unknown IDs are never corrected, fuzzily matched, or promoted to aliases.
 * They are removed deterministically. A Hypothesis is discarded when that
 * removal leaves it with no supporting evidence or leaves an observed / strongly
 * supported causal edge without canonical evidence. Inferred/speculative edges
 * may remain evidence-free because the Story reasoning contract permits that.
 */
export function sanitizeHypothesisOutputEvidenceIds(
  output: HypothesisOutput,
  allowedEvidenceIds: ReadonlySet<string>,
): HypothesisEvidenceSanitizationResult {
  let removedReferenceCount = 0;
  let droppedHypothesisCount = 0;

  const restrict = (ids: string[] | undefined) => {
    const values = Array.isArray(ids) ? ids : [];
    const uniqueValues = [...new Set(values)];
    const retained = restrictHypothesisEvidenceIds(uniqueValues, allowedEvidenceIds);
    removedReferenceCount += uniqueValues.length - retained.length;
    return retained;
  };

  const hypotheses = output.hypotheses.flatMap((hypothesis) => {
    const evidenceForIds = restrict(hypothesis.evidenceForIds);
    const evidenceAgainstIds = restrict(hypothesis.evidenceAgainstIds);
    const causalChain = hypothesis.causalChain.map((edge) => ({
      ...edge,
      evidenceIds: restrict(edge.evidenceIds),
    }));

    const unsupportedStrongEdge = causalChain.some((edge) =>
      (edge.evidenceState === "observed" || edge.evidenceState === "strongly_supported")
      && edge.evidenceIds.length === 0
    );

    if (evidenceForIds.length === 0 || unsupportedStrongEdge) {
      droppedHypothesisCount += 1;
      return [];
    }

    return [{
      ...hypothesis,
      evidenceForIds,
      evidenceAgainstIds,
      causalChain,
    }];
  });

  return {
    output: { ...output, hypotheses },
    removedReferenceCount,
    droppedHypothesisCount,
  };
}
