import type { buildHybridStoryEvidenceBrief } from "./hybrid-story-evidence-brief.ts";

type Brief = ReturnType<typeof buildHybridStoryEvidenceBrief>;

export type HybridDossierEvidenceChange =
  | "CARRIED_FORWARD"
  | "NEWLY_CITED_IN_DOSSIER"
  | "NO_COMPARABLE_PRIOR_STORY"
  | "NO_EXACT_BASELINE"
  | "WATCH_CONDITION";

export type HybridStoryEvidenceDelta = {
  baselineStatus: "EXACT_PREDECESSOR" | "NO_EXACT_BASELINE";
  selectedDossierId: string;
  previousDossierId: string | null;
  items: Array<Brief["items"][number] & { change: HybridDossierEvidenceChange }>;
  motions: Array<Brief["adjudicatedMotions"][number] & {
    change: "ALREADY_ADJUDICATED" | "NEWLY_ADJUDICATED" | "NO_EXACT_BASELINE";
  }>;
};

/**
 * Compares exact Dossier evidence citations, not headline text or publication
 * clock. 'NEWLY_CITED' means first seen in this *Dossier comparison*, never
 * that the market event just happened. Old dated observations retain their age.
 */
export function compareHybridStoryEvidenceBriefs(input: {
  current: Brief;
  previous: Brief | null;
  expectedPreviousDossierId: string | null;
}): HybridStoryEvidenceDelta {
  const { current, previous, expectedPreviousDossierId } = input;
  const exact = Boolean(
    previous
    && expectedPreviousDossierId
    && previous.dossierId === expectedPreviousDossierId
    && Date.parse(previous.asOf) < Date.parse(current.asOf),
  );
  const priorItems = exact ? previous!.items : [];
  const priorMotionIds = new Set((exact ? previous!.adjudicatedMotions : []).map(x => x.motionId));
  const priorStoryKeys = new Set(
    priorItems.map(item => item.persistentStoryId || item.storyId),
  );
  const referencesByKind = new Map<string, Set<string>>();
  for (const item of priorItems) {
    const key = (item.persistentStoryId || item.storyId) + ":" + item.kind;
    const set = referencesByKind.get(key) ?? new Set<string>();
    for (const ref of item.evidenceRefs) set.add(ref);
    referencesByKind.set(key, set);
  }

  const items = current.items.map(item => {
    if (item.kind === "NEXT_TEST") return { ...item, change: "WATCH_CONDITION" as const };
    if (!exact) return { ...item, change: "NO_EXACT_BASELINE" as const };
    const storyKey = item.persistentStoryId || item.storyId;
    if (!priorStoryKeys.has(storyKey)) {
      // No fuzzy Story join: don't turn a new analytical ID into fresh news.
      return { ...item, change: "NO_COMPARABLE_PRIOR_STORY" as const };
    }
    const priorRefs = referencesByKind.get(storyKey + ":" + item.kind) ?? new Set<string>();
    return {
      ...item,
      change: item.evidenceRefs.length > 0 && item.evidenceRefs.every(ref => priorRefs.has(ref))
        ? "CARRIED_FORWARD" as const
        : "NEWLY_CITED_IN_DOSSIER" as const,
    };
  });

  return {
    baselineStatus: exact ? "EXACT_PREDECESSOR" : "NO_EXACT_BASELINE",
    selectedDossierId: current.dossierId,
    previousDossierId: exact ? previous!.dossierId : null,
    items,
    motions: current.adjudicatedMotions.map(motion => ({
      ...motion,
      change: !exact
        ? "NO_EXACT_BASELINE" as const
        : priorMotionIds.has(motion.motionId)
          ? "ALREADY_ADJUDICATED" as const
          : "NEWLY_ADJUDICATED" as const,
    })),
  };
}
