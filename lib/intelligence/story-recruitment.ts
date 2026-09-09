import { normaliseInstrument } from "../instrument-mentions.ts";

export type CanonicalStoryForRecruitment = {
  id: string;
  slug: string;
  assets: string[];
  themeKeys: string[];
  title?: string;
  thesis?: string;
  marketQuestion?: string | null;
  dominantNarrative?: string | null;
  confirmationTrigger?: string | null;
  invalidationTrigger?: string | null;
  nextCatalyst?: string | null;
  articleVerdict?: string | null;
};

export type StoryRecruitmentInput = {
  affectedStorySlugs: string[];
  affectedAssets: string[];
  allowAssetRecruitment: boolean;
  acquisitionMateriality?: number;
  evidenceText?: string;
};

export type StoryRecruitmentRoute = {
  storyId: string;
  storySlug: string;
  evidenceRole: "context";
  weight: number;
  matchedAssets: string[];
  matchedStoryTerms: string[];
  reason: "explicit_story_slug" | "canonical_asset_overlap" | "canonical_story_local_match";
};

export type StoryRecruitmentDiagnostic = {
  outcome: "matched" | "unresolved";
  reason:
    | "explicit_story_slug"
    | "explicit_story_not_found"
    | "asset_recruitment_disabled"
    | "missing_canonical_assets"
    | "not_story_relevant"
    | "below_initial_route_not_escalation_eligible"
    | "ambiguous_story_match"
    | "canonical_asset_overlap"
    | "canonical_story_local_match";
  initialAssetRouteEligible: boolean;
  storyLocalEscalationEligible: boolean;
  candidateStoryIds: string[];
  matchedStoryId: string | null;
  matchedStoryTerms: string[];
};

export type StoryRecruitmentDecision = {
  routes: StoryRecruitmentRoute[];
  diagnostic: StoryRecruitmentDiagnostic;
};

type RankedStory = {
  story: CanonicalStoryForRecruitment;
  matchedAssets: string[];
  overlapCount: number;
  evidenceCoverageBasisPoints: number;
  storyCoverageBasisPoints: number;
  taxonomyBacked: number;
  semanticTerms: Set<string>;
  matchedStoryTerms: string[];
  distinctiveMatchCount: number;
};

const GENERIC_ROUTING_TERMS = new Set([
  "about", "after", "against", "ahead", "also", "among", "and", "because", "before", "between",
  "could", "from", "have", "into", "market", "markets", "more", "outlook", "price", "prices",
  "report", "reported", "says", "said", "should", "than", "that", "their", "there", "these",
  "the", "this", "those", "through", "toward", "trading", "under", "versus", "while", "with", "would",
]);

function semanticTerms(value: string, excludedAssets: Iterable<string>) {
  const excluded = new Set<string>();
  for (const asset of excludedAssets) {
    for (const token of asset.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) excluded.add(token);
    const canonical = normaliseInstrument(asset).toLowerCase();
    if (canonical) excluded.add(canonical);
  }
  return new Set(value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3 && !GENERIC_ROUTING_TERMS.has(term) && !excluded.has(term)));
}

function storySemanticTerms(story: CanonicalStoryForRecruitment) {
  return semanticTerms([
    story.title,
    story.thesis,
    story.marketQuestion,
    story.dominantNarrative,
    story.confirmationTrigger,
    story.invalidationTrigger,
    story.nextCatalyst,
    ...story.themeKeys,
  ].filter(Boolean).join(" "), story.assets);
}

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

function sameSemanticRank(left: RankedStory, right: RankedStory) {
  return left.distinctiveMatchCount === right.distinctiveMatchCount
    && left.matchedStoryTerms.length === right.matchedStoryTerms.length;
}

function initialAssetRouteEligible(input: StoryRecruitmentInput) {
  return typeof input.acquisitionMateriality === "number"
    ? input.acquisitionMateriality >= 70
    : input.allowAssetRecruitment;
}

function diagnostic(
  input: StoryRecruitmentInput,
  reason: StoryRecruitmentDiagnostic["reason"],
  ranked: RankedStory[] = [],
  winner: { storyId: string; matchedStoryTerms: string[] } | null = null,
): StoryRecruitmentDiagnostic {
  const initiallyEligible = initialAssetRouteEligible(input);
  return {
    outcome: winner ? "matched" : "unresolved",
    reason,
    initialAssetRouteEligible: initiallyEligible,
    storyLocalEscalationEligible: Boolean(winner && !initiallyEligible && reason === "canonical_story_local_match"),
    candidateStoryIds: ranked.map((candidate) => candidate.story.id),
    matchedStoryId: winner?.storyId ?? null,
    matchedStoryTerms: winner?.matchedStoryTerms ?? [],
  };
}

/**
 * Finds a single deterministic existing-Story destination from canonical
 * Story/asset/theme state. Explicit upstream slugs remain authoritative. When
 * they are absent, an exact rank tie fails closed instead of choosing a Story
 * by title, prose similarity or slug ordering.
 */
export function evaluateCanonicalStoryRecruitment(
  input: StoryRecruitmentInput,
  stories: CanonicalStoryForRecruitment[],
): StoryRecruitmentDecision {
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
        matchedStoryTerms: [],
        reason: "explicit_story_slug" as const,
      }] : [];
    });
  if (explicit.length) {
    return {
      routes: explicit,
      diagnostic: diagnostic(input, "explicit_story_slug", [], {
        storyId: explicit[0]!.storyId,
        matchedStoryTerms: [],
      }),
    };
  }
  if (input.affectedStorySlugs.length) {
    return { routes: [], diagnostic: diagnostic(input, "explicit_story_not_found") };
  }
  if (!input.allowAssetRecruitment) {
    return { routes: [], diagnostic: diagnostic(input, "asset_recruitment_disabled") };
  }

  const evidenceAssets = uniqueNormalisedAssets(input.affectedAssets);
  if (!evidenceAssets.size) {
    return { routes: [], diagnostic: diagnostic(input, "missing_canonical_assets") };
  }

  const evidenceTermSet = semanticTerms(input.evidenceText ?? "", evidenceAssets.values());

  const ranked = stories.flatMap((story): RankedStory[] => {
    const storyAssets = uniqueNormalisedAssets(story.assets);
    const matchedAssets = [...evidenceAssets.entries()]
      .filter(([key]) => storyAssets.has(key))
      .map(([, value]) => value)
      .sort();
    if (!matchedAssets.length) return [];
    const storyTerms = storySemanticTerms(story);
    return [{
      story,
      matchedAssets,
      overlapCount: matchedAssets.length,
      evidenceCoverageBasisPoints: Math.round((matchedAssets.length / evidenceAssets.size) * 10_000),
      storyCoverageBasisPoints: Math.round((matchedAssets.length / Math.max(1, storyAssets.size)) * 10_000),
      taxonomyBacked: story.themeKeys.length ? 1 : 0,
      semanticTerms: storyTerms,
      matchedStoryTerms: [...evidenceTermSet].filter((term) => storyTerms.has(term)).sort(),
      distinctiveMatchCount: 0,
    }];
  });
  if (!ranked.length) {
    return { routes: [], diagnostic: diagnostic(input, "not_story_relevant") };
  }

  const termOwners = new Map<string, number>();
  for (const candidate of ranked) {
    for (const term of candidate.semanticTerms) termOwners.set(term, (termOwners.get(term) ?? 0) + 1);
  }
  for (const candidate of ranked) {
    candidate.distinctiveMatchCount = candidate.matchedStoryTerms.filter((term) => termOwners.get(term) === 1).length;
  }

  const assetRanked = [...ranked].sort((left, right) => right.overlapCount - left.overlapCount
    || right.evidenceCoverageBasisPoints - left.evidenceCoverageBasisPoints
    || right.storyCoverageBasisPoints - left.storyCoverageBasisPoints
    || right.taxonomyBacked - left.taxonomyBacked
    || left.story.id.localeCompare(right.story.id));

  const semanticRanked = ranked
    .filter((candidate) => candidate.matchedStoryTerms.length >= 2)
    .sort((left, right) => right.distinctiveMatchCount - left.distinctiveMatchCount
      || right.matchedStoryTerms.length - left.matchedStoryTerms.length
      || left.story.id.localeCompare(right.story.id));

  const initialRouteEligible = initialAssetRouteEligible(input);
  let winner: RankedStory | undefined;
  let reason: StoryRecruitmentRoute["reason"];
  if (!initialRouteEligible) {
    winner = semanticRanked[0];
    if (!winner) {
      const hasWeakSemanticOverlap = assetRanked.some((candidate) => candidate.matchedStoryTerms.length > 0);
      return {
        routes: [],
        diagnostic: diagnostic(
          input,
          hasWeakSemanticOverlap ? "below_initial_route_not_escalation_eligible" : "not_story_relevant",
          assetRanked,
        ),
      };
    }
    if (semanticRanked[1] && sameSemanticRank(winner, semanticRanked[1])) {
      return { routes: [], diagnostic: diagnostic(input, "ambiguous_story_match", semanticRanked) };
    }
    if (ranked.length > 1 && winner.distinctiveMatchCount === 0) {
      return {
        routes: [],
        diagnostic: diagnostic(input, "below_initial_route_not_escalation_eligible", semanticRanked),
      };
    }
    reason = "canonical_story_local_match";
  } else {
    const hasSeedCollision = assetRanked.some((candidate) => candidate.story.articleVerdict === "theme_seed_unverified")
      && assetRanked.some((candidate) => candidate.story.articleVerdict !== "theme_seed_unverified");
    if (hasSeedCollision) {
      if (semanticRanked[0] && (!semanticRanked[1] || !sameSemanticRank(semanticRanked[0], semanticRanked[1]))) {
        winner = semanticRanked[0];
        reason = "canonical_story_local_match";
      } else {
        return { routes: [], diagnostic: diagnostic(input, "ambiguous_story_match", assetRanked) };
      }
    } else {
      winner = assetRanked[0];
      if (!winner || (assetRanked[1] && sameRank(winner, assetRanked[1]))) {
        return { routes: [], diagnostic: diagnostic(input, "ambiguous_story_match", assetRanked) };
      }
      reason = "canonical_asset_overlap";
    }
  }

  const route = {
    storyId: winner.story.id,
    storySlug: winner.story.slug,
    evidenceRole: "context" as const,
    weight: Math.min(95, 70 + winner.overlapCount * 10 + winner.taxonomyBacked * 5),
    matchedAssets: winner.matchedAssets,
    matchedStoryTerms: winner.matchedStoryTerms,
    reason,
  };
  return {
    routes: [route],
    diagnostic: diagnostic(
      input,
      reason,
      reason === "canonical_story_local_match" ? semanticRanked : assetRanked,
      { storyId: winner.story.id, matchedStoryTerms: winner.matchedStoryTerms },
    ),
  };
}

export function recruitCanonicalStories(
  input: StoryRecruitmentInput,
  stories: CanonicalStoryForRecruitment[],
): StoryRecruitmentRoute[] {
  return evaluateCanonicalStoryRecruitment(input, stories).routes;
}
