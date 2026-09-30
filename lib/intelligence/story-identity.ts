export type ExistingPersistentStoryIdentity = {
  title: string;
  market_question: string | null;
  dominant_narrative: string | null;
};

export type FreshStoryIdentityProposal = {
  title: string;
  marketQuestion: string | null;
  dominantNarrative: string | null;
};

export type ResolvedPersistentStoryIdentity = {
  title: string;
  marketQuestion: string | null;
  dominantNarrative: string | null;
  preserved: boolean;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Existing Story identity is persistent. Fresh event wording belongs in the
 * Story event/update and reasoning snapshot, not in the Story's durable name.
 *
 * Missing legacy identity fields may be filled once from the fresh proposal;
 * populated identity fields are never silently replaced by event copy.
 */
export function resolvePersistentStoryIdentity(
  existing: ExistingPersistentStoryIdentity | null | undefined,
  fresh: FreshStoryIdentityProposal,
): ResolvedPersistentStoryIdentity {
  const freshTitle = clean(fresh.title);
  if (!freshTitle) throw new Error("Fresh Story identity proposal requires a title.");

  if (!existing) {
    return {
      title: freshTitle,
      marketQuestion: clean(fresh.marketQuestion),
      dominantNarrative: clean(fresh.dominantNarrative),
      preserved: false,
    };
  }

  return {
    title: clean(existing.title) ?? freshTitle,
    marketQuestion: clean(existing.market_question) ?? clean(fresh.marketQuestion),
    dominantNarrative: clean(existing.dominant_narrative) ?? clean(fresh.dominantNarrative),
    preserved: true,
  };
}
