import type { DossierEvidenceGovernanceSnapshot } from "./evidence-governance.ts";
import type {
  MajorStory,
  ResearchBrainOutputV1,
} from "./research-brain-contracts.ts";

export const DOSSIER_EVIDENCE_SUFFICIENCY_VERSION =
  "dossier-evidence-sufficiency/1" as const;

export type EvidenceSufficiencyDirection =
  | "BASELINE"
  | "STRENGTHEN"
  | "WEAKEN"
  | "UNCHANGED"
  | "UNRESOLVED";

export type EvidenceSufficiencyBlocker =
  | "NO_ACTIVE_SUPPORT"
  | "ACTIVE_CONTRADICTION"
  | "UNRESOLVED_CONFLICT"
  | "MISSING_PROVENANCE"
  | "MISSING_GOVERNANCE"
  | "SUPERSEDED_SUPPORT";

export type StoryEvidenceSufficiency = {
  analyticalStoryId: string;
  persistentStoryId: string | null;
  direction: EvidenceSufficiencyDirection;
  activeSupportingEvidenceRefs: string[];
  activeContradictingEvidenceRefs: string[];
  newSupportingEvidenceRefs: string[];
  newContradictingEvidenceRefs: string[];
  acceleratingEvidenceRefs: string[];
  supersededSupportingEvidenceRefs: string[];
  blockers: EvidenceSufficiencyBlocker[];
  highConfidenceBlocked: boolean;
  reason: string;
};

export type DossierEvidenceSufficiencySnapshot = {
  contractVersion: typeof DOSSIER_EVIDENCE_SUFFICIENCY_VERSION;
  stories: StoryEvidenceSufficiency[];
  diagnostics: {
    policy: string[];
  };
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function supportingRefs(story: MajorStory) {
  return uniqueSorted([
    ...story.market_evidence.confirming,
    ...(story.market_evidence.accelerating ?? []),
  ]);
}

function contradictingRefs(story: MajorStory) {
  return uniqueSorted(story.market_evidence.contradicting);
}

export function buildDossierEvidenceSufficiency(input: {
  current: ResearchBrainOutputV1;
  previous?: ResearchBrainOutputV1 | null;
  governance?: DossierEvidenceGovernanceSnapshot | null;
}): DossierEvidenceSufficiencySnapshot {
  const previousById = new Map(
    (input.previous?.major_stories ?? []).map((story) => [story.story_id, story]),
  );
  const governanceById = new Map(
    (input.governance?.items ?? []).map((item) => [item.evidenceId, item]),
  );
  const unresolvedConflictGroups = new Set(
    (input.governance?.conflictGroups ?? [])
      .filter((group) => group.resolution === "UNRESOLVED")
      .map((group) => group.conflictGroupId),
  );

  const stories = input.current.major_stories.map(
    (story): StoryEvidenceSufficiency => {
      const previous = previousById.get(story.story_id) ?? null;
      const support = supportingRefs(story);
      const contradiction = contradictingRefs(story);
      const previousSupport = new Set(previous ? supportingRefs(previous) : []);
      const previousContradiction = new Set(
        previous ? contradictingRefs(previous) : [],
      );

      const missingGovernance = uniqueSorted(
        [...support, ...contradiction].filter(
          (ref) => input.governance && !governanceById.has(ref),
        ),
      );
      const supersededSupport = uniqueSorted(
        support.filter(
          (ref) => governanceById.get(ref)?.temporalState === "SUPERSEDED",
        ),
      );
      const activeSupport = uniqueSorted(
        support.filter(
          (ref) => governanceById.get(ref)?.temporalState !== "SUPERSEDED",
        ),
      );
      const activeContradiction = uniqueSorted(
        contradiction.filter(
          (ref) => governanceById.get(ref)?.temporalState !== "SUPERSEDED",
        ),
      );
      const newSupport = uniqueSorted(
        activeSupport.filter((ref) => !previousSupport.has(ref)),
      );
      const newContradiction = uniqueSorted(
        activeContradiction.filter(
          (ref) => !previousContradiction.has(ref),
        ),
      );
      const accelerating = uniqueSorted(
        (story.market_evidence.accelerating ?? []).filter(
          (ref) => governanceById.get(ref)?.temporalState !== "SUPERSEDED",
        ),
      );

      const relevantItems = [...activeSupport, ...activeContradiction]
        .map((ref) => governanceById.get(ref))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const hasUnresolvedConflict = relevantItems.some(
        (item) =>
          item.conflictGroupId !== null
          && unresolvedConflictGroups.has(item.conflictGroupId),
      );
      const hasMissingProvenance = relevantItems.some(
        (item) => item.independentLineageCount === 0,
      );

      const blockers = new Set<EvidenceSufficiencyBlocker>();
      if (activeSupport.length === 0) blockers.add("NO_ACTIVE_SUPPORT");
      if (activeContradiction.length > 0) blockers.add("ACTIVE_CONTRADICTION");
      if (hasUnresolvedConflict) blockers.add("UNRESOLVED_CONFLICT");
      if (hasMissingProvenance) blockers.add("MISSING_PROVENANCE");
      if (missingGovernance.length > 0) blockers.add("MISSING_GOVERNANCE");
      if (supersededSupport.length > 0) blockers.add("SUPERSEDED_SUPPORT");

      let direction: EvidenceSufficiencyDirection;
      if (!previous) {
        direction = "BASELINE";
      } else if (
        newSupport.length > 0
        && newContradiction.length > 0
      ) {
        direction = "UNRESOLVED";
      } else if (
        newContradiction.length > 0
        || (supersededSupport.length > 0 && newSupport.length === 0)
      ) {
        direction = "WEAKEN";
      } else if (newSupport.length > 0) {
        direction = "STRENGTHEN";
      } else {
        direction = "UNCHANGED";
      }

      const reason =
        direction === "BASELINE"
          ? "No exact prior analytical Story is available for evidence-delta adjudication."
          : direction === "UNRESOLVED"
            ? "New active canonical evidence arrived on both supporting and contradicting sides."
            : direction === "WEAKEN"
              ? newContradiction.length > 0
                ? "New active canonical contradicting evidence was added."
                : "Previously cited supporting evidence is explicitly superseded without replacement support."
              : direction === "STRENGTHEN"
                ? "New active canonical supporting evidence was added."
                : "No material canonical evidence delta changes the prior Story read.";

      return {
        analyticalStoryId: story.story_id,
        persistentStoryId: story.persistent_story_id ?? null,
        direction,
        activeSupportingEvidenceRefs: activeSupport,
        activeContradictingEvidenceRefs: activeContradiction,
        newSupportingEvidenceRefs: newSupport,
        newContradictingEvidenceRefs: newContradiction,
        acceleratingEvidenceRefs: accelerating,
        supersededSupportingEvidenceRefs: supersededSupport,
        blockers: [...blockers].sort(),
        highConfidenceBlocked: blockers.size > 0,
        reason,
      };
    },
  );

  return {
    contractVersion: DOSSIER_EVIDENCE_SUFFICIENCY_VERSION,
    stories,
    diagnostics: {
      policy: [
        "No numeric confidence score is created by this layer.",
        "Direction is driven by canonical evidence delta, not document count or prose strength.",
        "Explicit supersession can weaken a claim; simple absence of an old observation does not.",
        "Unresolved conflicts, missing provenance and missing active support block high confidence rather than being averaged away.",
      ],
    },
  };
}
