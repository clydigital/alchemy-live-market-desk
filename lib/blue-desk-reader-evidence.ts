import type { MarketBriefParagraphV1 } from "./market-brief-articles.ts";
import type { EditorialArticle } from "./market-brief-editorial.ts";

type ApprovedSource = EditorialArticle["editorial"]["evidenceClaims"][number];

/**
 * A lesson can cite a whole packet of evidence, but that does not make every
 * individual sentence a sourced original claim. Only explicitly itemised
 * canonical reasoning claims may acquire paragraph-specific source links.
 * ApprovedSource has already passed as-of and source-tier checks upstream.
 */
export function readerParagraphSources(
  paragraph: MarketBriefParagraphV1,
  approvedSources: readonly ApprovedSource[],
): ApprovedSource[] {
  if (paragraph.evidenceScope !== "claim") return [];
  const ids = new Set(paragraph.canonicalEvidenceIds.map(id => id.toLowerCase()));
  const seen = new Set<string>();
  return approvedSources.filter(source => {
    const key = source.evidenceId.toLowerCase();
    if (!ids.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

/**
 * Never describe a price move as a verified market reaction unless its
 * particular paragraph resolves to a qualifying original-source record.
 */
export function readerVerifiedReaction(
  paragraphs: readonly MarketBriefParagraphV1[],
  approvedSources: readonly ApprovedSource[],
): boolean {
  return paragraphs.some(paragraph =>
    paragraph.role === "reaction" && readerParagraphSources(paragraph, approvedSources).length > 0);
}
