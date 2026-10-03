import type {
  DossierPresentationCandidateExplanation,
  DossierPresentationInvestigation,
} from "./dossier-v2/presentation-adapter.ts";

export type DivergenceLabMode =
  | "full"
  | "compact_unresolved"
  | "compact_legacy";

export type DivergenceLabAlternative = {
  rank: number | null;
  explanation: string;
  confidence: DossierPresentationCandidateExplanation["confidence"] | null;
};

export type DivergenceLabCandidate = DossierPresentationCandidateExplanation & {
  displayDiscriminator: string | null;
};

export type DivergenceLabPresentation = {
  mode: DivergenceLabMode;
  candidates: DivergenceLabCandidate[];
  alternatives: DivergenceLabAlternative[];
  sharedDiscriminator: string;
};

function normaliseText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function allCandidatesUnresolvedAndUnevidenced(
  candidates: DossierPresentationCandidateExplanation[],
) {
  return candidates.length > 0 && candidates.every((candidate) =>
    candidate.confidence === "UNRESOLVED"
    && candidate.evidenceForRefs.length === 0
    && candidate.evidenceAgainstRefs.length === 0
  );
}

function sharedCandidateDiscriminator(
  candidates: DossierPresentationCandidateExplanation[],
) {
  if (!candidates.length) return null;
  const values = candidates
    .map((candidate) => candidate.discriminatingTest.trim())
    .filter(Boolean);
  if (!values.length) return null;

  const first = normaliseText(values[0]);
  return values.every((value) => normaliseText(value) === first)
    ? values[0]
    : null;
}

export function buildDivergenceLabPresentation(
  investigation: DossierPresentationInvestigation,
): DivergenceLabPresentation {
  const structured = investigation.candidateExplanations;
  const unresolvedCompact =
    investigation.divergence === "UNRESOLVED"
    && (
      structured.length === 0
      || allCandidatesUnresolvedAndUnevidenced(structured)
    );

  if (unresolvedCompact) {
    const alternatives = structured.length
      ? structured.map((candidate) => ({
          rank: candidate.rank,
          explanation: candidate.explanation,
          confidence: candidate.confidence,
        }))
      : investigation.competingExplanations.map((explanation) => ({
          rank: null,
          explanation,
          confidence: null,
        }));

    return {
      mode: "compact_unresolved",
      candidates: [],
      alternatives,
      sharedDiscriminator: investigation.researchNext,
    };
  }

  const isDivergent =
    investigation.divergence === "PARTIAL"
    || investigation.divergence === "MATERIAL";

  if (!isDivergent || structured.length === 0) {
    return {
      mode: "compact_legacy",
      candidates: [],
      alternatives: investigation.competingExplanations.map((explanation) => ({
        rank: null,
        explanation,
        confidence: null,
      })),
      sharedDiscriminator: investigation.researchNext,
    };
  }

  const sharedCandidate = sharedCandidateDiscriminator(structured);
  const sharedDiscriminator = sharedCandidate || investigation.researchNext;
  const sharedNormalised = normaliseText(sharedDiscriminator);
  const discriminatorCounts = new Map<string, number>();

  for (const candidate of structured) {
    const key = normaliseText(candidate.discriminatingTest);
    discriminatorCounts.set(key, (discriminatorCounts.get(key) || 0) + 1);
  }

  const candidates = structured.map((candidate) => {
    const key = normaliseText(candidate.discriminatingTest);
    const duplicatesAnotherCandidate = (discriminatorCounts.get(key) || 0) > 1;
    const displayDiscriminator =
      key === sharedNormalised || duplicatesAnotherCandidate
        ? null
        : candidate.discriminatingTest;

    return {
      ...candidate,
      evidenceForRefs: [...candidate.evidenceForRefs],
      evidenceAgainstRefs: [...candidate.evidenceAgainstRefs],
      displayDiscriminator,
    };
  });

  return {
    mode: "full",
    candidates,
    alternatives: [],
    sharedDiscriminator,
  };
}
