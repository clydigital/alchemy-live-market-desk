/**
 * A featured Story is one approved edition, expressed at two reading depths.
 * This module formats existing editorial material; it does not discover,
 * verify, infer price reactions, or grant publication permission.
 */
export interface FeaturedStoryInput {
  editionId: string;
  headline: string;
  recap: string;
  marketEffects: string;
  outlook: string;
  nextCatalyst: string;
  catalystAtEt: string | null;
  confirmation: string;
  invalidation: string;
  sourceUrls: string[];
  evidenceStatus: "ORIGINAL_VERIFIED" | "CORROBORATED" | "RESEARCH_LEAD" | "UNKNOWN";
  published: boolean;
}
export interface FeaturedStory {
  editionId: string;
  headline: string;
  recap: string;
  marketEffects: string;
  outlook: string;
  nextCatalyst: string;
  catalystAtEt: string | null;
  confirmation: string;
  invalidation: string;
  sourceUrls: string[];
}
const isUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname;
  } catch { return false; }
};
const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Fail closed on incomplete, unapproved or unsupported public Story data. */
export function selectPublicFeaturedStory(input: FeaturedStoryInput | null): FeaturedStory | null {
  if (!input || !input.published ||
    !["ORIGINAL_VERIFIED", "CORROBORATED"].includes(input.evidenceStatus)) return null;
  const required = [
    input.editionId, input.headline, input.recap, input.marketEffects,
    input.outlook, input.nextCatalyst, input.confirmation, input.invalidation
  ];
  if (!required.every(hasText) || !Array.isArray(input.sourceUrls) ||
    input.sourceUrls.length === 0 || !input.sourceUrls.every(isUrl)) return null;
  if (input.catalystAtEt !== null &&
    (!/^\d{4}-\d{2}-\d{2}T/.test(input.catalystAtEt) ||
      !/[+-]\d\d:\d\d$/.test(input.catalystAtEt) ||
      !Number.isFinite(Date.parse(input.catalystAtEt)))) return null;
  const { editionId, headline, recap, marketEffects, outlook, nextCatalyst,
    catalystAtEt, confirmation, invalidation, sourceUrls } = input;
  return { editionId, headline, recap, marketEffects, outlook, nextCatalyst,
    catalystAtEt, confirmation, invalidation, sourceUrls: [...sourceUrls] };
}

/** One approved story produces both the short home card and full reader outline. */
export function featuredStoryViews(story: FeaturedStory) {
  return {
    card: {
      headline: story.headline,
      recap: story.recap,
      marketEffects: story.marketEffects,
      whatComesNext: story.outlook,
      editionId: story.editionId
    },
    reader: {
      ...story,
      sections: [
        { heading: "What happened", text: story.recap },
        { heading: "What it means for markets", text: story.marketEffects },
        { heading: "What comes next", text: story.outlook },
        { heading: "Next catalyst", text: story.nextCatalyst },
        { heading: "What would confirm it", text: story.confirmation },
        { heading: "What would change the view", text: story.invalidation }
      ]
    }
  };
}
