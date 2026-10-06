import type { DeduplicationOutput } from "./schemas.ts";

export type RelatedDistinctStoryRelation = {
  story_id: string;
  related_story_id: string;
  relation_type: "related_distinct";
  similarity_score: number;
  rationale: string;
  exception_proof: DeduplicationOutput["decisions"][number]["exceptionProof"];
};

/**
 * A related-distinct candidate is a new canonical Story, but it must retain
 * lineage to the exact frozen Story that System 2 compared it against.
 *
 * The semantic-deduplication reference resolver owns canonical ID resolution;
 * this helper never guesses or performs fuzzy matching.
 */
export function buildRelatedDistinctStoryRelation(
  decision: DeduplicationOutput["decisions"][number],
  promotedStoryId: string,
): RelatedDistinctStoryRelation | null {
  if (decision.noveltyClass !== "related_distinct") return null;

  const relatedStoryId = decision.matchedStoryId?.trim();
  if (!relatedStoryId) {
    throw new Error("related_distinct Story promotion requires an exact matched Story ID.");
  }
  if (relatedStoryId === promotedStoryId) {
    throw new Error("related_distinct Story relation cannot point to the promoted Story itself.");
  }

  return {
    story_id: promotedStoryId,
    related_story_id: relatedStoryId,
    relation_type: "related_distinct",
    similarity_score: Math.max(0, Math.min(100, decision.similarityScore)),
    rationale: decision.rationale,
    exception_proof: decision.exceptionProof,
  };
}
