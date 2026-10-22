import type { EditorialBrief, EditorialArticle, EditorialArticleSectionsV2 } from "./market-brief-editorial.ts";

export type NewsroomPreviewCard = {
  articleId: string;
  editionId: string;
  title: string;
  deck: string;
  category: string;
  interpretationStatus: EditorialArticle["interpretationStatus"];
  readiness: EditorialArticle["editorial"]["readiness"];
  format: EditorialArticleSectionsV2["recommendedFormat"];
  isAcceptedStory: boolean;
  /** Short issuer or official observations; not synthetic article paragraphs. */
  observations: Array<{ claim: string; sourceName: string; sourceUrl: string }>;
  reporting: EditorialArticleSectionsV2["reporting"];
  interpretation: EditorialArticleSectionsV2["interpretation"];
  gaps: string[];
};

/**
 * OWNER-ONLY preview of the existing frozen publication. Not a public DTO,
 * endpoint, a Story writer, a new editorial verdict, or a news admission path.
 */
export function buildV7NewsroomPreview(brief: EditorialBrief): NewsroomPreviewCard[] {
  return brief.articles.slice(0, 8).map(article => {
    const sections = article.editorial.sections;
    const isFull = sections.recommendedFormat === "FULL_ARTICLE"
      && article.editorial.readiness === "READY";
    const isReadable = article.editorial.readiness !== "RESEARCH_ONLY";
    return {
      articleId: article.articleId,
      editionId: article.editionId,
      title: article.title || "Report awaiting source verification",
      deck: article.deck,
      category: article.category,
      interpretationStatus: article.interpretationStatus,
      readiness: article.editorial.readiness,
      format: isFull ? "FULL_ARTICLE" : isReadable && article.editorial.evidenceClaims.length
        ? "FACTUAL_BRIEF" : "RESEARCH_ONLY",
      isAcceptedStory: article.editorial.storyEligible,
      observations: isReadable && !isFull
        ? article.editorial.evidenceClaims.slice(0, 5).map(claim => ({
          claim: claim.claimText, sourceName: claim.sourceName, sourceUrl: claim.sourceUrl,
        }))
        : [],
      reporting: isFull ? sections.reporting.slice(0, 5) : [],
      interpretation: isFull ? sections.interpretation.slice(0, 5) : [],
      gaps: sections.gaps.slice(0, 5),
    };
  });
}
