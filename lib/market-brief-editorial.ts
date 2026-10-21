import { marketStoryHeadline } from "./market-story-headline.ts";
import type { MarketBriefArticleV1, MarketBriefArticlesProjectionResult, MarketBriefSourceLinkV1, MarketBriefParagraphV1 } from "./market-brief-articles.ts";

export type EditorialEvidenceRow = {
  id: string;
  claimText: string | null;
  evidenceClass: string | null;
  sourceTier: number | null;
  sourceName: string | null;
  supportDirection: string | null;
  sourceUrl: string | null;
  provenanceUrls: string[];
  createdAt: string | null;
  availableAt: string | null;
};

export type EditorialReadiness = "READY" | "DEVELOPING" | "RESEARCH_ONLY";

/**
 * An additive, edition-pinned editorial recommendation, not a new published
 * schema or an authorisation to extend an immutable article's body.
 */
export type EditorialArticleSectionsV2 = {
  contractVersion: "article-sections/2";
  recommendedFormat: "FULL_ARTICLE" | "FACTUAL_BRIEF" | "RESEARCH_ONLY";
  reporting: Array<{ text: string; role: MarketBriefParagraphV1["role"]; evidenceIds: string[]; originalUrls: string[] }>;
  interpretation: Array<{ text: string; role: MarketBriefParagraphV1["role"]; evidenceIds: string[]; originalUrls: string[] }>;
  gaps: string[];
};

export type EditorialArticle = MarketBriefArticleV1 & {
  editorial: {
    readiness: EditorialReadiness;
    /** Publication admission only; NOT a replacement for canonical System 2. */
    storyEligible: boolean;
    /** Qualified article sections are sourced from distinct itemised claims only. */
    sections: EditorialArticleSectionsV2;
    qualifiedEvidenceCount: number;
    directSourceCount: number;
    evidenceClaims: Array<{
      evidenceId: string;
      claimText: string;
      evidenceClass: string;
      sourceName: string;
      sourceUrl: string;
      availableAt: string | null;
    }>;
    /** A Dossier relationship is displayed only with a contemporaneous direct original source. */
    causalLinks: Array<{
      from: string;
      to: string;
      relationship: string;
      evidenceStatus: "observed" | "strongly_supported" | "inferred" | "speculative";
      sourceUrl: string;
      sourceName: string;
      evidenceIds: string[];
    }>;
    gaps: string[];
  };
};

export type EditorialBrief = Omit<MarketBriefArticlesProjectionResult, "articles"> & {
  articles: EditorialArticle[];
  readerReadyCount: number;
  developingCount: number;
  researchOnlyCount: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Operational routing, verification and ingestion work belongs in research
// diagnostics, not in the client-facing market-story carousel.
const PROCESS_HEADLINE = /(?:^|[\s:])(?:evidence gap|research gap|record reclassification|primary.source timestamps|source coverage|source audit|provider authentication|sensor validation|migration|ingestion pipeline|system 2|canonical (?:lineage|evidence)|dossier status|thesis version|test case)(?:$|[\s:])/i;
const PROCESS_CLAIM = /^(?:observed by research gap|detected:|detected\b|story:\s*detected|verification pending|awaiting provider|source retrieval failed|research gap)/i;
const PRIMARY_CLASSES = new Set([
  "official_release", "company_primary", "official_statistic",
  "official_measurement", "verified_macro", "official_document", "filing", "regulatory_filing",
]);

function sourceUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2_048) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.hostname.length < 4) return null;
    // A domain-level landing page is not a citation to the evidence claim.
    if (u.pathname === "/" && !u.search) return null;
    return u.href;
  } catch {
    return null;
  }
}

function allowedAsOf(row: EditorialEvidenceRow, asOf: string) {
  const reference = Date.parse(asOf);
  if (!Number.isFinite(reference)) return false;
  // Both admission timestamps must be known; missing provenance timing cannot
  // establish that this evidence was available in the frozen publication.
  if (!row.createdAt || !row.availableAt) return false;
  return [row.createdAt, row.availableAt].every(date =>
    Number.isFinite(Date.parse(date)) && Date.parse(date) <= reference);
}

function relevantIds(article: MarketBriefArticleV1) {
  return [...new Set([...article.paragraphs.flatMap(p => p.canonicalEvidenceIds),
    ...(article.causalLinks || []).flatMap(edge => edge.canonicalEvidenceIds)])]
    .filter(id => UUID.test(id)).slice(0, 48);
}

export function editorialEvidenceIds(brief: MarketBriefArticlesProjectionResult): string[] {
  return [...new Set(brief.articles.flatMap(relevantIds))].slice(0, 120);
}

const SUPPORTED_INTERPRETATION = new Set(["SUPPORTED", "MIXED"]);
const UNSUPPORTED_PARAGRAPH_STYLE = /(?:^|\s)(?:verification pending|research gap|ingestion pipeline|canonical evidence|source audit|dossier status)(?:\s|$)/i;

/**
 * Full editorial coverage requires separate, substantive, claim-owned original
 * observations and adjudicated interpretations. Never stretch a lesson-wide
 * source pool or append speculative copy to reach paragraph quotas.
 */
function articleSections(
  article: MarketBriefArticleV1,
  approved: EditorialArticle["editorial"]["evidenceClaims"],
  researchOnly: boolean,
): EditorialArticleSectionsV2 {
  const seen = new Set<string>();
  const selected: Array<{
    type: "fact" | "interpretation";
    text: string; role: MarketBriefParagraphV1["role"];
    evidenceIds: string[]; originalUrls: string[];
  }> = [];
  for (const paragraph of article.paragraphs) {
    if (paragraph.evidenceScope !== "claim"
      || (paragraph.claimType !== "fact" && paragraph.claimType !== "interpretation")) continue;
    // Neither a generic Story source pool nor a price reaction without
    // aligned market clocks can count towards reported observations.
    if (paragraph.role === "reaction") continue;
    const text = paragraph.text.trim();
    if (text.split(/\s+/u).length < 20 || UNSUPPORTED_PARAGRAPH_STYLE.test(text)) continue;
    const key = text.toLocaleLowerCase("en-GB").replace(/\s+/gu, " ");
    if (seen.has(key)) continue;
    const ids = new Set(paragraph.canonicalEvidenceIds.map(id => id.toLowerCase()));
    const sources = approved.filter(source => ids.has(source.evidenceId.toLowerCase()));
    if (!sources.length) continue;
    seen.add(key);
    selected.push({
      type: paragraph.claimType,
      text, role: paragraph.role,
      evidenceIds: [...new Set(sources.map(source => source.evidenceId))],
      originalUrls: [...new Set(sources.map(source => source.sourceUrl))],
    });
  }
  const reporting = selected.filter(item => item.type === "fact").slice(0, 5)
    .map(({ type: _type, ...section }) => section);
  const interpreted = Boolean(article.dossierId)
    && SUPPORTED_INTERPRETATION.has(article.interpretationStatus);
  const interpretation = interpreted
    ? selected.filter(item => item.type === "interpretation").slice(0, 5)
      .map(({ type: _type, ...section }) => section)
    : [];
  const gaps: string[] = [];
  if (reporting.length < 3) gaps.push("Fewer than three substantial original-source factual claim paragraphs");
  if (interpretation.length < 2) gaps.push("Fewer than two source-linked, canonical-adjudicated interpretation paragraphs");
  if (article.paragraphs.some(p => p.role === "reaction"))
    gaps.push("Event-aligned market-price reaction not independently established by this section contract");
  const recommendedFormat = researchOnly || !approved.length
    ? "RESEARCH_ONLY"
    : reporting.length >= 3 && interpretation.length >= 2
      ? "FULL_ARTICLE" : "FACTUAL_BRIEF";
  return {
    contractVersion: "article-sections/2",
    recommendedFormat, reporting, interpretation, gaps,
  };
}

/** Content presentation only. Does not adjudicate Regimes, mutate Stories, or create canonical evidence. */
export function buildEditorialBrief(
  projected: MarketBriefArticlesProjectionResult,
  evidenceRows: readonly EditorialEvidenceRow[],
): EditorialBrief {
  const evidence = new Map(evidenceRows.filter(row => UUID.test(row.id)).map(row => [row.id.toLowerCase(), row]));
  const articles: EditorialArticle[] = projected.articles.map(article => {
    const records = relevantIds(article)
      .map(id => evidence.get(id.toLowerCase()))
      .filter((row): row is EditorialEvidenceRow => Boolean(row))
      .filter(row => allowedAsOf(row, article.dossierAsOf || article.generatedAt));
    const qualified = records.filter(row =>
      row.sourceTier !== null && row.sourceTier <= 2
      && PRIMARY_CLASSES.has((row.evidenceClass || "").toLowerCase())
      && !PROCESS_CLAIM.test((row.claimText || "").trim())
    );

    // Rebuild citations from exact admitted evidence. The legacy projector used
    // fuzzy URL overlap, which cannot establish claim-to-source ownership.
    const urls = new Map<string, MarketBriefSourceLinkV1>();
    // Only link actual original evidence source URLs, never parent/provider homepage.
    for (const row of records) {
      const candidates = row.provenanceUrls.length ? row.provenanceUrls : row.sourceUrl ? [row.sourceUrl] : [];
      for (const value of candidates) {
        const url = sourceUrl(value);
        if (!url || urls.has(url)) continue;
        urls.set(url, {
          url,
          title: (row.sourceName || new URL(url).hostname).slice(0, 90),
          accessedAt: row.availableAt,
        } satisfies MarketBriefSourceLinkV1);
      }
    }
    const links = [...urls.values()].slice(0, 12);
    // Public evidence explorer: only exact cited first-tier original claims
    // already available by this immutable edition's as-of. Contextual
    // Research Gap observations and later records are not public proof.
    const evidenceClaims = qualified.flatMap(row => {
      const candidates = row.provenanceUrls.length ? row.provenanceUrls : row.sourceUrl ? [row.sourceUrl] : [];
      const direct = candidates.map(sourceUrl).find(Boolean);
      if (!direct || !row.claimText?.trim()) return [];
      return [{
        evidenceId: row.id,
        claimText: row.claimText.trim(),
        evidenceClass: row.evidenceClass || "unspecified",
        sourceName: row.sourceName || new URL(direct).hostname,
        sourceUrl: direct,
        availableAt: row.availableAt,
      }];
    }).slice(0, 12);
    // Evidence-linked causal arrows are sourced market interpretations, not
    // independent causal proof. Source IDs must belong to this exact edition.
    const sourcedClaims = new Map(evidenceClaims.map(claim => [claim.evidenceId.toLowerCase(), claim]));
    const causalLinks = (article.causalLinks || []).flatMap(edge => {
      const match = edge.canonicalEvidenceIds
        .map(id => sourcedClaims.get(id.toLowerCase()))
        .filter((claim): claim is (typeof evidenceClaims)[number] => Boolean(claim));
      if (!match.length) return [];
      return [{
        from: edge.from, to: edge.to, relationship: edge.relationship,
        evidenceStatus: edge.evidenceStatus,
        sourceUrl: match[0].sourceUrl,
        sourceName: match[0].sourceName,
        evidenceIds: match.map(claim => claim.evidenceId),
      }];
    }).slice(0, 6);
    // Choose a factual issuer statement already qualified against the exact
    // frozen evidence and original-source URL, rather than an unsourced
    // workflow placeholder. No causal claim is generated by this presentation.
    const observed = evidenceClaims.find(claim =>
      /\b(?:reported|published|released|recorded|disclosed)\b/i.test(claim.claimText)
      && /\d/.test(claim.claimText)
      && !/\b(?:will|may|might|could|suggests|indicates|implies|expected to)\b/i.test(claim.claimText)
    );
    const displayTitle = article.title || (observed ? marketStoryHeadline([observed.claimText]) : "");
    const processOnly = !displayTitle || PROCESS_HEADLINE.test(displayTitle)
      || article.paragraphs.every(p => PROCESS_CLAIM.test(p.text.trim()));
    const gaps: string[] = [];
    if (processOnly) gaps.push("Operational or research-process headline");
    if (!evidenceClaims.length) gaps.push("No attributable first-tier claim with a direct source page");
    if (!links.length) gaps.push("No direct evidence source links");
    if (article.paragraphs.length < 2) gaps.push("Insufficient sourced explanation");
    const readiness: EditorialReadiness = processOnly
      ? "RESEARCH_ONLY"
      : evidenceClaims.length && links.length && article.paragraphs.length >= 2
        ? "READY" : "DEVELOPING";
    // A source-backed lesson may be reader-ready as analysis without an
    // accepted canonical Story. Never elevate it to the homepage Story hero.
    const storyEligible = readiness === "READY" && Boolean(article.dossierId)
      && (article.interpretationStatus === "SUPPORTED" || article.interpretationStatus === "MIXED");
    if (readiness === "READY" && !storyEligible) gaps.push("No canonical Story adjudication");
    const sections = articleSections(article, evidenceClaims, processOnly);
    if (sections.recommendedFormat !== "FULL_ARTICLE") {
      gaps.push(...sections.gaps);
    }

    return {
      ...article,
      title: displayTitle,
      sourceLinks: links,
      editorial: {
        readiness,
        storyEligible,
        sections,
        qualifiedEvidenceCount: evidenceClaims.length,
        directSourceCount: links.length,
        evidenceClaims,
        causalLinks,
        gaps,
      },
    };
  });

  // Upstream source/story evidence is the controlling order within each grade.
  // Original order remains stable among articles with the same readiness.
  const grade = (article: EditorialArticle) => article.editorial.readiness === "READY" ? 0
    : article.editorial.readiness === "DEVELOPING" ? 1 : 2;
  articles.sort((a, b) => grade(a) - grade(b));
  return {
    ...projected,
    articles,
    readerReadyCount: articles.filter(a => a.editorial.readiness === "READY").length,
    developingCount: articles.filter(a => a.editorial.readiness === "DEVELOPING").length,
    researchOnlyCount: articles.filter(a => a.editorial.readiness === "RESEARCH_ONLY").length,
  };
}
