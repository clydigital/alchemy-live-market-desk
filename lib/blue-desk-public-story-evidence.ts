import type { EditorialBrief } from "./market-brief-editorial.ts";

/**
 * Independently reviewable P−1 field-allowlisted public Story evidence DTO.
 * The canonical Dossier, thesis ledger, raw provenance metadata and research
 * diagnostics MUST NOT be spread into public responses. No API is exposed by
 * this module until nested-field, licensing and consumer review (#834).
 */
export type BlueDeskPublicStoryEvidenceV1 = {
  contractVersion: "blue-desk-public-story-evidence/1";
  editionId: string;
  articleId: string;
  publishedAt: string;
  interpretation: "UNRESOLVED" | "SUPPORTED" | "MIXED";
  storyAdmission: "CANONICALLY_ADJUDICATED" | "NOT_ADJUDICATED";
  evidenceAvailability: "SOURCE_LINKED" | "SOURCE_GAP";
  facts: Array<{
    evidenceId: string;
    reportedClaim: string;
    sourceName: string;
    originalSourceUrl: string;
    availableAt: string;
  }>;
  marketReaction: { status: "NOT_VERIFIED"; observation: null };
  causalAttribution: { status: "NOT_VERIFIED"; explanation: null };
  confirmation: { status: "NOT_ADMITTED"; checks: [] };
  unavailableReason: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGINAL_PRIMARY_EVIDENCE = new Set(["official_release", "company_primary", "official_statistic", "official_measurement", "verified_macro", "official_document", "filing", "regulatory_filing"]);

/** Reject provider landing pages and all non-HTTPS, credentialed source URLs. */
function exactSource(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password
        || url.hostname.length < 4 || (url.pathname === "/" && !url.search)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Project facts admitted by the exact frozen edition. Never infer Story thesis,
 * causality or observed market reactions from a pool of Dossier evidence.
 *
 * This is a **non-routed**, pure projection: it does not open any public API,
 * change an existing Legacy Hybrid response or author new evidence/Story rows.
 */
export function buildBlueDeskPublicStoryEvidenceV1(
  brief: EditorialBrief,
  articleId: string,
): BlueDeskPublicStoryEvidenceV1 | null {
  if (!UUID.test(brief.editionId) || !Number.isFinite(Date.parse(brief.generatedAt))) return null;
  const match = /^article:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(articleId);
  if (!match || !UUID.test(match[1]) || !UUID.test(match[2])
      || match[1].toLowerCase() !== brief.editionId.toLowerCase()) return null;

  const article = brief.articles.find(item =>
    item.articleId === articleId && item.editionId === brief.editionId
  );
  if (!article || article.editorial.readiness === "RESEARCH_ONLY") return null;
  const published = Date.parse(brief.generatedAt);
  if (!Number.isFinite(Date.parse(article.generatedAt))
      || Date.parse(article.generatedAt) !== published) return null;

  const allowedLinks = new Set(article.sourceLinks.map(link => exactSource(link.url)).filter(Boolean));
  const seen = new Set<string>();
  const facts = article.editorial.evidenceClaims.flatMap(claim => {
    if (!ORIGINAL_PRIMARY_EVIDENCE.has(claim.evidenceClass.toLowerCase()) || !UUID.test(claim.evidenceId) || !claim.claimText.trim() || !claim.sourceName.trim()
        || !claim.availableAt || !Number.isFinite(Date.parse(claim.availableAt))
        || Date.parse(claim.availableAt) > published) return [];
    const originalSourceUrl = exactSource(claim.sourceUrl);
    if (!originalSourceUrl || !allowedLinks.has(originalSourceUrl)) return [];
    const evidenceId = claim.evidenceId.toLowerCase();
    if (seen.has(evidenceId)) return [];
    seen.add(evidenceId);
    return [{
      evidenceId,
      reportedClaim: claim.claimText.trim().slice(0, 700),
      sourceName: claim.sourceName.trim().slice(0, 100),
      originalSourceUrl,
      availableAt: claim.availableAt,
    }];
  }).slice(0, 12);

  // An issuer observation and the Dossier's proposed causal arrows are not
  // independent proof of a traded-market reaction or causal mechanism.
  // Editorial admission is not evidence of an actual frozen canonical
  // Story-thesis version join. That join must be checked separately before
  // this DTO can ever expose an accepted System 2 conclusion.
  return {
    contractVersion: "blue-desk-public-story-evidence/1",
    editionId: brief.editionId,
    articleId,
    publishedAt: brief.generatedAt,
    interpretation: "UNRESOLVED",
    storyAdmission: "NOT_ADJUDICATED",
    evidenceAvailability: facts.length ? "SOURCE_LINKED" : "SOURCE_GAP",
    facts,
    marketReaction: { status: "NOT_VERIFIED", observation: null },
    causalAttribution: { status: "NOT_VERIFIED", explanation: null },
    confirmation: { status: "NOT_ADMITTED", checks: [] },
    unavailableReason: facts.length
      ? null
      : "No edition-admitted, direct original-source facts meet the public evidence contract.",
  };
}
