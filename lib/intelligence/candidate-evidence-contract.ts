export type CandidateContractDiagnosticCode =
  | "repaired_contract_format"
  | "rejected_unknown_evidence"
  | "rejected_missing_required_evidence"
  | "story_omitted_after_contract_failure";

export type CandidateContractDiagnostic = {
  code: CandidateContractDiagnosticCode;
  candidateKey: string;
  primaryHypothesisId: string | null;
  title: string | null;
  detail: string;
};

export class CandidateEvidenceContractError extends Error {
  readonly code: Exclude<CandidateContractDiagnosticCode, "repaired_contract_format" | "story_omitted_after_contract_failure">;

  constructor(
    code: Exclude<CandidateContractDiagnosticCode, "repaired_contract_format" | "story_omitted_after_contract_failure">,
    message: string,
  ) {
    super(message);
    this.name = "CandidateEvidenceContractError";
    this.code = code;
  }
}

type CandidateLike = {
  candidateKey?: string;
  primaryHypothesisId?: string;
  title?: string;
  decisiveEvidenceIds?: unknown;
};

function candidateIdentity(candidate: CandidateLike) {
  return {
    candidateKey: candidate.candidateKey || "unkeyed-candidate",
    primaryHypothesisId: candidate.primaryHypothesisId || null,
    title: candidate.title || null,
  };
}

/**
 * Accept only transport wrappers around an exact known canonical ID. This is
 * deliberately not fuzzy matching: a different ID remains unknown evidence.
 */
export function normalizeCanonicalEvidenceReference(value: string, knownEvidenceIds: ReadonlySet<string>) {
  const exact = value.trim();
  if (knownEvidenceIds.has(exact)) return { evidenceId: exact, repaired: exact !== value };

  const marker = exact.match(/^\[\[?\s*(?:evidence(?:[_ -]?id)?\s*[:=]\s*)?([^\]\s]+)\s*\]\]?$/i)
    || exact.match(/^\{\s*evidence(?:[_ -]?id)?\s*[:=]\s*([^}\s]+)\s*\}$/i)
    || exact.match(/^evidence(?:[_ -]?id)?\s*[:=]\s*(\S+)$/i);
  const evidenceId = marker?.[1]?.trim() || null;
  if (evidenceId && knownEvidenceIds.has(evidenceId)) return { evidenceId, repaired: true };
  return null;
}

export function normalizeRequiredCandidateEvidenceIds(
  values: unknown,
  knownEvidenceIds: ReadonlySet<string>,
  context: string,
) {
  if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
    throw new CandidateEvidenceContractError(
      "rejected_missing_required_evidence",
      `${context} must contain an array of canonical evidence IDs.`,
    );
  }

  const normalized: string[] = [];
  let repairedCount = 0;
  for (const value of values) {
    const reference = normalizeCanonicalEvidenceReference(value, knownEvidenceIds);
    if (!reference) {
      throw new CandidateEvidenceContractError(
        "rejected_unknown_evidence",
        `${context} references an unknown canonical evidence ID: ${value}.`,
      );
    }
    if (reference.repaired) repairedCount += 1;
    if (!normalized.includes(reference.evidenceId)) normalized.push(reference.evidenceId);
  }
  if (!normalized.length) {
    throw new CandidateEvidenceContractError(
      "rejected_missing_required_evidence",
      `${context} has no required canonical evidence after transport normalisation.`,
    );
  }
  return { evidenceIds: normalized, repairedCount };
}

/**
 * A Story Synthesis candidate may be omitted without taking unrelated
 * candidates or their immutable edition down with it. Decisive lineage stays
 * fail-closed; only exact, recognisable transport wrappers are normalised.
 */
export function normalizeStorySynthesisCandidate<T extends CandidateLike>(
  candidate: T,
  knownEvidenceIds: ReadonlySet<string>,
): { candidate: T & { decisiveEvidenceIds: string[] }; diagnostics: CandidateContractDiagnostic[] } {
  const identity = candidateIdentity(candidate);
  const decisive = normalizeRequiredCandidateEvidenceIds(
    candidate.decisiveEvidenceIds,
    knownEvidenceIds,
    `Story Synthesis candidate ${candidate.primaryHypothesisId || "unknown"} decisive evidence`,
  );
  return {
    candidate: { ...candidate, decisiveEvidenceIds: decisive.evidenceIds },
    diagnostics: decisive.repairedCount ? [{
      ...identity,
      code: "repaired_contract_format",
      detail: `Normalised ${decisive.repairedCount} exact canonical evidence marker${decisive.repairedCount === 1 ? "" : "s"}.`,
    }] : [],
  };
}

export function candidateOmissionDiagnostic(candidate: CandidateLike, error: unknown): CandidateContractDiagnostic[] {
  const identity = candidateIdentity(candidate);
  const detail = error instanceof Error ? error.message : "Canonical Story contract validation failed.";
  const code = error instanceof CandidateEvidenceContractError
    ? error.code
    : "story_omitted_after_contract_failure";
  return [
    { ...identity, code, detail },
    { ...identity, code: "story_omitted_after_contract_failure", detail },
  ];
}

export function isRecoverableStoryContractFailure(error: unknown) {
  if (error instanceof CandidateEvidenceContractError) return true;
  const detail = error instanceof Error ? error.message : "";
  return /canonical evidence|canonical story reasoning|challenger assessment|canonical reasoning inputs/i.test(detail);
}
