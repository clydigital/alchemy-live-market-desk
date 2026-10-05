import type {
  DossierPresentationInvestigation,
} from "./dossier-v2/presentation-adapter.ts";
import type {
  JourneyStorySource,
} from "./intelligence/journey-briefing.ts";
import {
  CANONICAL_STORY_REASONING_V1,
  type CanonicalExplanationCandidateV1,
} from "./intelligence/story-reasoning.ts";

export const PRESENTER_CANONICAL_STORY_BRIDGE_VERSION =
  "presenter-canonical-story-bridge/1" as const;

export type PresenterCanonicalStoryCase = {
  contractVersion: typeof PRESENTER_CANONICAL_STORY_BRIDGE_VERSION;
  investigationId: string;
  storyId: string;
  publicationSnapshotId: string;
  thesisVersionId: string;
  expectation: {
    prior: string | null;
    current: string | null;
    changed: boolean;
  };
  observedReaction: string | null;
  divergence: DossierPresentationInvestigation["divergence"];
  canonicalMarketReaction: string | null;
  currentExplanation: string | null;
  currentExplanationEvidenceIds: string[];
  leadingExplanation: CanonicalExplanationCandidateV1 | null;
  competingExplanations: CanonicalExplanationCandidateV1[];
  evidenceMissing: string[];
  whatToInspectNext: {
    canonical: string | null;
    dossierFallback: string | null;
  };
  confirmation: {
    canonical: string[];
    dossierFallback: string | null;
  };
  invalidation: {
    canonical: string[];
    dossierFallback: string | null;
  };
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function validSource(source: JourneyStorySource) {
  return source.position > 0
    && Boolean(clean(source.publicationSnapshotId))
    && Boolean(clean(source.storyId))
    && Boolean(clean(source.thesisVersionId))
    && source.reasoning.contractVersion === CANONICAL_STORY_REASONING_V1
    && source.reasoning.storyId === source.storyId
    && source.reasoning.storyVersionId === source.thesisVersionId;
}

/**
 * Join the Presenter divergence investigation with one exact immutable Story
 * reasoning source.
 *
 * The Dossier investigation owns the preserved pre-tape expectation / observed
 * reaction / divergence record. Canonical Story reasoning owns the accepted
 * explanation, competing explanation candidates, next test, confirmation and
 * invalidation.
 *
 * linked_thesis_ids is intentionally not used for this join because it belongs
 * to the Dossier thesis ledger and is not a canonical Story thesis-version ID.
 */
export function buildPresenterCanonicalStoryCase(input: {
  investigation: DossierPresentationInvestigation;
  storySources: JourneyStorySource[];
}): PresenterCanonicalStoryCase | null {
  const { investigation } = input;

  const storyIds = [...new Set(investigation.storyIds.map(clean).filter(Boolean))];
  if (storyIds.length !== 1) return null;
  const storyId = storyIds[0]!;

  const matches = input.storySources.filter((source) =>
    validSource(source) && source.storyId === storyId
  );
  if (matches.length !== 1) return null;

  const source = matches[0]!;
  const reasoning = source.reasoning;
  const priorExpectation = clean(investigation.journey.previousExpectedReaction) || null;
  const currentExpectation = clean(investigation.expectedReaction) || null;

  const explanationCandidates = reasoning.explanationCandidates ?? [];
  const leadingCandidates = explanationCandidates.filter((candidate) => candidate.isLeading);
  const leadingExplanation = leadingCandidates.length === 1
    ? {
        ...leadingCandidates[0]!,
        evidenceForIds: [...leadingCandidates[0]!.evidenceForIds],
        evidenceAgainstIds: [...leadingCandidates[0]!.evidenceAgainstIds],
      }
    : null;
  const competingExplanations = explanationCandidates
    .filter((candidate) => !candidate.isLeading)
    .map((candidate) => ({
      ...candidate,
      evidenceForIds: [...candidate.evidenceForIds],
      evidenceAgainstIds: [...candidate.evidenceAgainstIds],
    }));
  const acceptedExplanation = clean(reasoning.acceptedExplanation) || null;
  const currentExplanationEvidenceIds = acceptedExplanation
    ? [...new Set(
        reasoning.claims
          .filter((claim) => claim.type === "interpretation" && clean(claim.text) === acceptedExplanation)
          .flatMap((claim) => claim.evidenceIds),
      )]
    : [];

  return {
    contractVersion: PRESENTER_CANONICAL_STORY_BRIDGE_VERSION,
    investigationId: investigation.id,
    storyId,
    publicationSnapshotId: source.publicationSnapshotId,
    thesisVersionId: source.thesisVersionId,
    expectation: {
      prior: priorExpectation ?? currentExpectation,
      current: currentExpectation,
      changed: investigation.journey.expectationChanged === true,
    },
    observedReaction: clean(investigation.observedReaction) || null,
    divergence: investigation.divergence,
    canonicalMarketReaction: clean(reasoning.marketReaction) || null,
    currentExplanation: acceptedExplanation,
    currentExplanationEvidenceIds,
    leadingExplanation,
    competingExplanations,
    evidenceMissing: [...new Set(investigation.missingEvidence.map(clean).filter(Boolean))],
    whatToInspectNext: {
      canonical: clean(reasoning.nextTest?.label) || null,
      dossierFallback: clean(investigation.researchNext) || null,
    },
    confirmation: {
      canonical: reasoning.confirmation.map(clean).filter(Boolean),
      dossierFallback: clean(investigation.confirmationCondition) || null,
    },
    invalidation: {
      canonical: reasoning.invalidation.map(clean).filter(Boolean),
      dossierFallback: clean(investigation.invalidationCondition) || null,
    },
  };
}


function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Recover only exact immutable Story reasoning sources already frozen into the
 * selected canonical edition. This never falls back to mutable Story/version
 * tables.
 */
export function presenterStorySourcesFromEditionPayload(
  payload: Record<string, unknown> | null | undefined,
): JourneyStorySource[] {
  const manifest = payload?.canonicalStoryManifest;
  if (!Array.isArray(manifest)) return [];

  return manifest.flatMap((rawEntry) => {
    const entry = object(rawEntry);
    if (!entry) return [];

    const position = typeof entry.position === "number" && Number.isFinite(entry.position)
      ? entry.position
      : null;
    const publicationSnapshotId = typeof entry.snapshotId === "string"
      ? entry.snapshotId.trim()
      : "";
    const storyId = typeof entry.storyId === "string" ? entry.storyId.trim() : "";
    const thesisVersionId = typeof entry.thesisVersionId === "string"
      ? entry.thesisVersionId.trim()
      : "";
    const reasoning = object(entry.reasoning);

    if (
      !position
      || position <= 0
      || !publicationSnapshotId
      || !storyId
      || !thesisVersionId
      || !reasoning
      || reasoning.contractVersion !== CANONICAL_STORY_REASONING_V1
      || reasoning.storyId !== storyId
      || reasoning.storyVersionId !== thesisVersionId
    ) return [];

    return [{
      position,
      publicationSnapshotId,
      storyId,
      thesisVersionId,
      reasoning: reasoning as unknown as JourneyStorySource["reasoning"],
    }];
  });
}

export function buildPresenterCanonicalStoryCases(input: {
  investigations: DossierPresentationInvestigation[];
  storySources: JourneyStorySource[];
}): PresenterCanonicalStoryCase[] {
  return input.investigations.flatMap((investigation) => {
    const result = buildPresenterCanonicalStoryCase({
      investigation,
      storySources: input.storySources,
    });
    return result ? [result] : [];
  });
}
