import type { EditorialBrief } from "./market-brief-editorial";

/**
 * A factual, primary-source observation can headline a quiet public edition
 * without becoming a News Brief, accepted Story, Market Motion or System 2
 * adjudication. This helper only reads evidence already admitted as-of the
 * frozen publication. It does not touch the canonical DB or author analysis.
 */
export type FrozenSourceFactV1 = {
  contractVersion: "frozen-source-fact/1";
  evidenceId: string;
  articleId: string;
  editionId: string;
  claimText: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  /** Always explicitly distinguishes this fact from any causal thesis. */
  interpretation: "UNRESOLVED";
};

const FACT_LEAD_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** Display-only unit typography; the canonical source claim is unchanged. */
function displayClaim(raw: string): string {
  return raw.trim()
    .replace(/\b(\d{4})Q([1-4])\b/g, "Q$2 $1")
    .replace(/(\d+(?:\.\d+)?) USD_billion\b/g, "US$$$1 billion");
}

export function selectFrozenSourceFact(
  brief: EditorialBrief,
  now: Date = new Date(),
): FrozenSourceFactV1 | null {
  const currentTime = now.getTime();
  if (!Number.isFinite(currentTime)) return null;
  for (const article of brief.articles) {
    if (article.editorial.storyEligible || article.editorial.readiness !== "READY") continue;
    if (article.editionId !== brief.editionId) continue;
    const asOf = Date.parse(article.generatedAt);
    if (!Number.isFinite(asOf) || asOf > currentTime || currentTime - asOf > FACT_LEAD_MAX_AGE_MS) continue;
    for (const fact of article.editorial.evidenceClaims) {
      // Only literal reported measurements qualify. No forward-looking thesis,
      // sentiment prediction or broad market-reaction language is rewritten.
      const claim = fact.claimText.trim();
      if (!/\b(?:reported|recorded|published|released|disclosed)\b/i.test(claim)) continue;
      if (!/\d/.test(claim)) continue;
      if (/\b(?:will|may|might|could|suggests|indicates|implies|expected to)\b/i.test(claim)) continue;
      if (!article.sourceLinks.some(link => link.url === fact.sourceUrl)) continue;
      const evidenceTime = Date.parse(fact.availableAt || "");
      if (!Number.isFinite(evidenceTime) || evidenceTime > asOf) continue;
      return {
        contractVersion: "frozen-source-fact/1",
        evidenceId: fact.evidenceId,
        articleId: article.articleId,
        editionId: article.editionId,
        claimText: displayClaim(claim),
        sourceName: fact.sourceName,
        sourceUrl: fact.sourceUrl,
        publishedAt: article.generatedAt,
        interpretation: "UNRESOLVED",
      };
    }
  }
  return null;
}
