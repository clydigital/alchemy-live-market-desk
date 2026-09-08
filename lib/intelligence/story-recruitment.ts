import { normaliseInstrument } from "../instrument-mentions.ts";

export type CanonicalStoryForRecruitment = {
  id: string;
  slug: string;
  assets: string[];
  themeKeys: string[];
};

export type StoryRecruitmentInput = {
  affectedStorySlugs: string[];
  affectedAssets: string[];
  allowAssetRecruitment: boolean;
};

export type StoryRecruitmentRoute = {
  storyId: string;
  storySlug: string;
  evidenceRole: "context";
  weight: number;
  matchedAssets: string[];
  reason: "explicit_story_slug" | "canonical_asset_overlap";
};

type RankedStory = {
  story: CanonicalStoryForRecruitment;
  matchedAssets: string[];
  overlapCount: number;
  evidenceCoverageBasisPoints: number;
  storyCoverageBasisPoints: number;
  taxonomyBacked: number;
};

function uniqueNormalisedAssets(values: string[]) {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = normaliseInstrument(trimmed);
    if (key && !byKey.has(key)) byKey.set(key, trimmed);
  }
  return byKey;
}

function sameRank(left: RankedStory, right: RankedStory) {
  return left.overlapCount === right.overlapCount
    && left.evidenceCoverageBasisPoints === right.evidenceCoverageBasisPoints
    && left.storyCoverageBasisPoints === right.storyCoverageBasisPoints
    && left.taxonomyBacked === right.taxonomyBacked;
}

/**
 * Finds a single deterministic existing-Story destination from canonical
 * Story/asset/theme state. Explicit upstream slugs remain authoritative. When
 * they are absent, an exact rank tie fails closed instead of choosing a Story
 * by title, prose similarity or slug ordering.
 */
export function recruitCanonicalStories(
  input: StoryRecruitmentInput,
  stories: CanonicalStoryForRecruitment[],
): StoryRecruitmentRoute[] {
  const storyBySlug = new Map(stories.map((story) => [story.slug, story]));
  const explicit = [...new Set(input.affectedStorySlugs)]
    .flatMap((slug) => {
      const story = storyBySlug.get(slug);
      return story ? [{
        storyId: story.id,
        storySlug: story.slug,
        evidenceRole: "context" as const,
        weight: 100,
        matchedAssets: [],
        reason: "explicit_story_slug" as const,
      }] : [];
    });
  if (explicit.length || !input.allowAssetRecruitment) return explicit;

  const evidenceAssets = uniqueNormalisedAssets(input.affectedAssets);
  if (!evidenceAssets.size) return [];

  const ranked = stories.flatMap((story): RankedStory[] => {
    const storyAssets = uniqueNormalisedAssets(story.assets);
    const matchedAssets = [...evidenceAssets.entries()]
      .filter(([key]) => storyAssets.has(key))
      .map(([, value]) => value)
      .sort();
    if (!matchedAssets.length) return [];
    return [{
      story,
      matchedAssets,
      overlapCount: matchedAssets.length,
      evidenceCoverageBasisPoints: Math.round((matchedAssets.length / evidenceAssets.size) * 10_000),
      storyCoverageBasisPoints: Math.round((matchedAssets.length / Math.max(1, storyAssets.size)) * 10_000),
      taxonomyBacked: story.themeKeys.length ? 1 : 0,
    }];
  }).sort((left, right) => right.overlapCount - left.overlapCount
    || right.evidenceCoverageBasisPoints - left.evidenceCoverageBasisPoints
    || right.storyCoverageBasisPoints - left.storyCoverageBasisPoints
    || right.taxonomyBacked - left.taxonomyBacked
    || left.story.id.localeCompare(right.story.id));

  const winner = ranked[0];
  if (!winner || (ranked[1] && sameRank(winner, ranked[1]))) return [];

  return [{
    storyId: winner.story.id,
    storySlug: winner.story.slug,
    evidenceRole: "context",
    weight: Math.min(95, 70 + winner.overlapCount * 10 + winner.taxonomyBacked * 5),
    matchedAssets: winner.matchedAssets,
    reason: "canonical_asset_overlap",
  }];
}
