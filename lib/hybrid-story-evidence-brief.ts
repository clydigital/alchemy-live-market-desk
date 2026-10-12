import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";

/**
 * Presentation-only Story evidence grouping. This is NOT a new Motion intake,
 * Dossier decision, source verification, or Story mutation path.
 *
 * A source-lead's primary_story_id is a routing hint; it cannot make a
 * supporting/contradicting claim. Only the exact immutable Dossier's own
 * Story/Evidence classification and evidence-backed A2 decisions appear here.
 */
export type HybridStoryEvidenceSource = Pick<
  DossierPresentationV1,
  "dossierId" | "asOf" | "header" | "whatMattersNow" | "evidenceIndex" | "motionAdjudicationContext"
>;

export type StoryEvidenceBriefItem = {
  storyId: string;
  persistentStoryId: string | null;
  storyTitle: string;
  kind: "SUPPORT" | "CHALLENGE" | "NEXT_TEST";
  text: string;
  evidenceRefs: string[];
  evidenceStatus: "DOSSIER_CITED" | "CONDITION_ONLY";
};

export type AdjudicatedMotionBriefItem = {
  motionId: string;
  storyId: string;
  decision: "ACCEPT" | "REFINE";
  conclusion: string;
  evidenceRefs: string[];
  observedAt: string | null;
  nextTest: string | null;
};

/** Preserve the original thesis and dates. No headline or causal prose is rewritten. */
export function buildHybridStoryEvidenceBrief(
  dossier: HybridStoryEvidenceSource,
  maxStories = 4,
): {
  dossierId: string;
  asOf: string;
  headline: string;
  items: StoryEvidenceBriefItem[];
  adjudicatedMotions: AdjudicatedMotionBriefItem[];
} {
  const scopedRefs = new Map<string, Set<string>>();
  for (const entry of dossier.evidenceIndex) {
    if (!entry.evidenceId?.trim()) continue;
    for (const use of entry.usedIn ?? []) {
      const set = scopedRefs.get(use) ?? new Set<string>();
      set.add(entry.evidenceId);
      scopedRefs.set(use, set);
    }
  }
  const requested = new Set(dossier.whatMattersNow.supportingStoryIds);
  const stories = dossier.whatMattersNow.stories
    .filter(story => requested.has(story.id))
    .slice(0, Math.max(0, Math.min(maxStories, 4)));
  const items: StoryEvidenceBriefItem[] = [];
  const adjudicatedMotions: AdjudicatedMotionBriefItem[] = [];
  const usedMotionIds = new Set<string>();

  for (const story of stories) {
    const verifiedReferences = scopedRefs.get(`story:${story.id}`) ?? new Set<string>();
    const matching = (refs: string[] | undefined) => [...new Set(
      (refs ?? []).filter(ref => verifiedReferences.has(ref)),
    )];
    const confirming = matching(story.confirmingEvidenceRefs);
    const contradicting = matching(story.contradictingEvidenceRefs);

    if (confirming.length && story.whatChanged.trim()) {
      items.push({
        storyId: story.id, persistentStoryId: story.persistentStoryId ?? null,
        storyTitle: story.title, kind: "SUPPORT", text: story.whatChanged,
        evidenceRefs: confirming, evidenceStatus: "DOSSIER_CITED",
      });
    }
    if (contradicting.length && story.conclusion.trim()) {
      items.push({
        storyId: story.id, persistentStoryId: story.persistentStoryId ?? null,
        storyTitle: story.title, kind: "CHALLENGE", text: story.conclusion,
        evidenceRefs: contradicting, evidenceStatus: "DOSSIER_CITED",
      });
    }
    if (story.whatWouldChangeMind.trim()) {
      items.push({
        storyId: story.id, persistentStoryId: story.persistentStoryId ?? null,
        storyTitle: story.title, kind: "NEXT_TEST",
        text: story.whatWouldChangeMind, evidenceRefs: [],
        evidenceStatus: "CONDITION_ONLY",
      });
    }

    for (const motion of dossier.motionAdjudicationContext ?? []) {
      if (usedMotionIds.has(motion.motionId)) continue;
      // Both exact original Story identity and the System-2 destination must agree.
      if (!story.persistentStoryId || motion.storyId !== story.persistentStoryId
        || !motion.destinationRefs.includes(`STORY:${story.id}`)) continue;
      if (motion.decision !== "ACCEPT" && motion.decision !== "REFINE") continue;
      const refs = matching(motion.canonicalEvidenceRefs);
      if (!refs.length || !motion.conclusion.trim()) continue;
      usedMotionIds.add(motion.motionId);
      adjudicatedMotions.push({
        motionId: motion.motionId,
        storyId: story.id,
        decision: motion.decision,
        conclusion: motion.conclusion,
        evidenceRefs: refs,
        observedAt: motion.observedAt,
        nextTest: motion.nextTest,
      });
    }
  }

  return {
    dossierId: dossier.dossierId,
    asOf: dossier.asOf,
    headline: dossier.header.headline,
    items,
    adjudicatedMotions,
  };
}
