import type { EditorialBrief } from "./market-brief-editorial.ts";
import {
  buildBlueDeskPublicStoryEvidenceV1,
  type BlueDeskPublicStoryEvidenceV1,
} from "./blue-desk-public-story-evidence.ts";

/**
 * Exact archived editorial article, not a direct canonical persistent Story
 * ledger lookup. The latter requires a separately reviewed join to the
 * immutable Story thesis-version identity.
 */
export const BLUEBELLY_PRIVATE_PUBLISHED_STORY_V1 = "bluebelly-private-published-story/1" as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ARTICLE = /^article:([0-9a-f-]{36}):([0-9a-f-]{36})$/i;

export type ExactPublishedStorySelection = {
  editionId: string;
  articleId: string;
};

/** No UUID guessing, title matching, fuzzy edition search or latest fallback. */
export function parseExactPublishedStorySelection(
  edition: string | null,
  article: string | null,
): ExactPublishedStorySelection | null {
  if (!edition || !article || !UUID.test(edition)) return null;
  const match = ARTICLE.exec(article);
  if (!match || !UUID.test(match[1]) || !UUID.test(match[2])
      || match[1].toLowerCase() !== edition.toLowerCase()) return null;
  return { editionId: edition, articleId: article };
}

export type BluebellyPrivatePublishedStoryV1 = {
  contractVersion: typeof BLUEBELLY_PRIVATE_PUBLISHED_STORY_V1;
  recordType: "PUBLISHED_EDITORIAL_ARTICLE";
  editionId: string;
  articleId: string;
  publishedAt: string;
  title: string;
  deck: string;
  category: string;
  interpretation: BlueDeskPublicStoryEvidenceV1["interpretation"];
  storyAdmission: BlueDeskPublicStoryEvidenceV1["storyAdmission"];
  evidenceAvailability: BlueDeskPublicStoryEvidenceV1["evidenceAvailability"];
  facts: BlueDeskPublicStoryEvidenceV1["facts"];
  marketReaction: BlueDeskPublicStoryEvidenceV1["marketReaction"];
  causalAttribution: BlueDeskPublicStoryEvidenceV1["causalAttribution"];
  confirmation: BlueDeskPublicStoryEvidenceV1["confirmation"];
};

/**
 * The existing source-gated publication evidence projector owns fact
 * admission. Do NOT expose article.canonicalEvidenceIds, raw source refs,
 * mutable Story states, diagnostics or speculative causal chains here.
 */
export function projectBluebellyPrivatePublishedStory(
  brief: EditorialBrief,
  articleId: string,
): BluebellyPrivatePublishedStoryV1 | null {
  const evidence = buildBlueDeskPublicStoryEvidenceV1(brief, articleId);
  if (!evidence || evidence.evidenceAvailability !== "SOURCE_LINKED"
      || evidence.facts.length === 0) return null;
  const article = brief.articles.find(item =>
    item.articleId === articleId && item.editionId === brief.editionId
    && item.editorial.readiness !== "RESEARCH_ONLY");
  if (!article || !article.title || !article.deck) return null;
  return {
    contractVersion: BLUEBELLY_PRIVATE_PUBLISHED_STORY_V1,
    recordType: "PUBLISHED_EDITORIAL_ARTICLE",
    editionId: evidence.editionId,
    articleId: evidence.articleId,
    publishedAt: evidence.publishedAt,
    title: article.title,
    deck: article.deck,
    category: article.category,
    interpretation: evidence.interpretation,
    storyAdmission: evidence.storyAdmission,
    evidenceAvailability: evidence.evidenceAvailability,
    facts: evidence.facts,
    marketReaction: evidence.marketReaction,
    causalAttribution: evidence.causalAttribution,
    confirmation: evidence.confirmation,
  };
}
