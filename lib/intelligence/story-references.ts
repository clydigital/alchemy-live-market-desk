import type {
  DeduplicationOutput,
  DeduplicationStageOutput,
  ExistingStoryPackItem,
} from "./schemas.ts";

export type ModelExistingStoryPackItem = Omit<ExistingStoryPackItem, "id"> & {
  storyRef: string;
};

export type FrozenStoryReferenceSet = {
  modelStories: ModelExistingStoryPackItem[];
  storyIdByRef: ReadonlyMap<string, string>;
  storyIds: ReadonlySet<string>;
};

type CompatibleDeduplicationDecision = Omit<
  DeduplicationOutput["decisions"][number],
  "matchedStoryId"
> & {
  matchedStoryRef?: string | null;
  matchedStoryId?: string | null;
};

type CompatibleDeduplicationOutput = {
  decisions: CompatibleDeduplicationDecision[];
};

const MATCHED_STORY_CLASSES = new Set(["duplicate", "existing_story_update"]);

function storyReference(index: number) {
  return `STORY_${String(index + 1).padStart(4, "0")}`;
}

/**
 * Derives model-safe references from the exact frozen Story order. A new engine
 * run may produce a different order, but a resumed run receives the persisted
 * frozen array and therefore reconstructs the same mapping.
 */
export function buildFrozenStoryReferenceSet(stories: ExistingStoryPackItem[]): FrozenStoryReferenceSet {
  const storyIdByRef = new Map<string, string>();
  const storyIds = new Set<string>();
  const modelStories = stories.map((story, index) => {
    const ref = storyReference(index);
    const { id, ...modelStory } = story;
    storyIdByRef.set(ref, id);
    storyIds.add(id);
    return { storyRef: ref, ...modelStory };
  });

  return { modelStories, storyIdByRef, storyIds };
}

function invalidReference(
  decision: CompatibleDeduplicationDecision,
): DeduplicationOutput["decisions"][number] {
  const {
    matchedStoryRef: _matchedStoryRef,
    matchedStoryId: _legacyMatchedStoryId,
    ...canonical
  } = decision;
  return {
    ...canonical,
    noveltyClass: "insufficient_novelty",
    matchedStoryId: null,
    rationale: `${decision.rationale} Matching Story reference was invalid or absent from the frozen input, so publication is blocked.`,
  };
}

/**
 * Resolves strict model references to canonical IDs. Legacy UUIDs are accepted
 * only for reused pre-repair checkpoints and only when present in the same
 * frozen Story set.
 */
export function resolveDeduplicationStoryReferences(
  output: DeduplicationStageOutput | CompatibleDeduplicationOutput,
  references: FrozenStoryReferenceSet,
  { allowLegacyStoryIds = false }: { allowLegacyStoryIds?: boolean } = {},
): DeduplicationOutput {
  return {
    decisions: output.decisions.map((rawDecision) => {
      const decision = rawDecision as CompatibleDeduplicationDecision;
      const {
        matchedStoryRef: _matchedStoryRef,
        matchedStoryId: _legacyMatchedStoryId,
        ...canonical
      } = decision;

      if (!MATCHED_STORY_CLASSES.has(decision.noveltyClass)) {
        return { ...canonical, matchedStoryId: null };
      }

      const hasModelReference = Object.prototype.hasOwnProperty.call(decision, "matchedStoryRef");
      const modelReference = hasModelReference && typeof decision.matchedStoryRef === "string"
        ? decision.matchedStoryRef
        : null;
      const resolvedModelId = modelReference ? references.storyIdByRef.get(modelReference) ?? null : null;

      if (hasModelReference) {
        return resolvedModelId
          ? { ...canonical, matchedStoryId: resolvedModelId }
          : invalidReference(decision);
      }

      const legacyStoryId = allowLegacyStoryIds && typeof decision.matchedStoryId === "string"
        ? decision.matchedStoryId
        : null;
      return legacyStoryId && references.storyIds.has(legacyStoryId)
        ? { ...canonical, matchedStoryId: legacyStoryId }
        : invalidReference(decision);
    }),
  };
}
