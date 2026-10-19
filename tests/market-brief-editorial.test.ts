import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEditorialBrief, editorialEvidenceIds,
  type EditorialEvidenceRow,
} from "../lib/market-brief-editorial.ts";
import type { MarketBriefArticlesProjectionResult, MarketBriefArticleV1 } from "../lib/market-brief-articles.ts";

const asOf = "2026-10-19T16:19:19.317Z";
const id1 = "cf1ecffd-b6f1-4431-bd34-a54657251b9e";
const id2 = "fa33fe80-9f17-40cb-8c2c-caea8b113e48";
const id3 = "df1ecffd-b6f1-4431-bd34-a54657251b9e";

const baseArticle = (id: string, title: string, evidenceIds: string[]): MarketBriefArticleV1 => ({
  contractVersion: "market-brief-article/1",
  articleId: "article:edition-1:" + id,
  editionId: "edition-1",
  dossierId: null,
  dossierAsOf: asOf,
  generatedAt: asOf,
  title,
  deck: "An observed market development.",
  category: "Equities & Earnings",
  paragraphs: [
    { role: "opening", text: "CoreWeave reported spending.", sourceRefs: [], canonicalEvidenceIds: evidenceIds },
    { role: "mechanism", text: "Funding costs complicate expansion.", sourceRefs: [], canonicalEvidenceIds: evidenceIds },
  ],
  sourceLinks: [],
  interpretationStatus: "UNRESOLVED",
  conditionalOutlook: "Await the next earnings release.",
});
const packageOf = (articles: MarketBriefArticleV1[]): MarketBriefArticlesProjectionResult => ({
  contractVersion: "market-brief-article/1",
  editionId: "edition-1", dossierId: null, generatedAt: asOf, articles, status: "PARTIAL",
});

function evidence(id: string, overrides: Partial<EditorialEvidenceRow> = {}): EditorialEvidenceRow {
  return {
    id,
    claimText: "CoreWeave issuer release shows capital expenditure.",
    evidenceClass: "company_primary",
    supportDirection: "neutral",
    sourceTier: 1,
    sourceName: "CoreWeave investor relations",
    sourceUrl: "https://investors.coreweave.com",
    provenanceUrls: ["https://investors.coreweave.com/news/news-details/2026/quarterly-results"],
    createdAt: "2026-10-18T16:00:00Z",
    availableAt: "2026-10-18T15:00:00Z",
    ...overrides,
  };
}

test("current primary evidence creates a client-ready article with an exact original source link", () => {
  const article = { ...baseArticle("1", "CoreWeave spending raises funding questions", [id1]), dossierId: id3, interpretationStatus: "SUPPORTED" as const };
  const brief = buildEditorialBrief(packageOf([article]), [evidence(id1)]);
  assert.equal(brief.readerReadyCount, 1);
  assert.equal(brief.articles[0].editorial.readiness, "READY");
  assert.deepEqual(brief.articles[0].sourceLinks.map(s => s.url), [
    "https://investors.coreweave.com/news/news-details/2026/quarterly-results",
  ]);
  assert.equal(brief.articles[0].editorial.qualifiedEvidenceCount, 1);
  assert.deepEqual(brief.articles[0].editorial.evidenceClaims.map(c => c.evidenceId), [id1]);
  assert.equal(brief.articles[0].editorial.evidenceClaims[0].sourceUrl,
    "https://investors.coreweave.com/news/news-details/2026/quarterly-results");
});

test("Research Gap discovery evidence is context only, never independently editorial confirmation", () => {
  const brief = buildEditorialBrief(packageOf([baseArticle("2", "US rates react to CPI", [id2])]), [
    evidence(id2, { claimText: "Observed by Research Gap; page did not expose a release value",
      evidenceClass: "news_report", sourceTier: 3 }),
  ]);
  assert.equal(brief.readerReadyCount, 0);
  assert.equal(brief.articles[0].editorial.readiness, "DEVELOPING");
  assert.equal(brief.articles[0].editorial.qualifiedEvidenceCount, 0);
});

test("operational evidence and provenance headlines stay in research, never lead the market", () => {
  const article = baseArticle("3", "Primary-source timestamps as the decisive evidence for record reclassification", [id1]);
  const brief = buildEditorialBrief(packageOf([article]), [evidence(id1)]);
  assert.equal(brief.articles[0].editorial.readiness, "RESEARCH_ONLY");
  assert.equal(brief.readerReadyCount, 0);
  assert.equal(brief.researchOnlyCount, 1);
});

test("cannot launder post-edition facts into historical publication", () => {
  const brief = buildEditorialBrief(packageOf([baseArticle("4", "CoreWeave capex market report", [id1])]), [
    evidence(id1, { createdAt: "2026-10-20T10:00:00Z" }),
  ]);
  assert.equal(brief.articles[0].editorial.qualifiedEvidenceCount, 0);
  assert.equal(brief.articles[0].sourceLinks.length, 0);
  assert.equal(brief.articles[0].editorial.evidenceClaims.length, 0);
});

test("homepages, unsecured URLs, and unreferenced evidence are not citations", () => {
  const brief = buildEditorialBrief(packageOf([baseArticle("5", "CoreWeave capex report", [id1])]), [
    evidence(id1, { sourceUrl: "https://example.org", provenanceUrls: [
      "https://example.org/", "http://example.org/insecure",
      "https://user:password@example.org/private",
    ] }),
    evidence(id3),
  ]);
  assert.equal(brief.articles[0].sourceLinks.length, 0);
  assert.equal(brief.articles[0].editorial.readiness, "DEVELOPING");
  assert.deepEqual(editorialEvidenceIds(brief), [id1]);
});

test("a valid article outranks developing and research process items without rewriting frozen IDs", () => {
  const developing = baseArticle("a", "Rates ahead of data", [id2]);
  const process = baseArticle("b", "Source audit and provider authentication", [id1]);
  const ready = { ...baseArticle("c", "CoreWeave earnings and financing costs", [id1]), dossierId: id3, interpretationStatus: "SUPPORTED" as const };
  const brief = buildEditorialBrief(packageOf([developing, process, ready]), [evidence(id1), evidence(id2, { sourceTier: 3 })]);
  assert.deepEqual(brief.articles.map(a => a.articleId), [ready.articleId, developing.articleId, process.articleId]);
  assert.ok(brief.articles.every(a => a.editionId === "edition-1"));
});

test("unrelated contextual URL cannot launder an uncited issuer claim into READY", () => {
  const article = baseArticle("mixed", "AI capex and credit spreads", [id1, id2]);
  const primaryWithoutLink = evidence(id1, { sourceUrl: "https://investors.coreweave.com/",
    provenanceUrls: [] });
  const contextWithLink = evidence(id2, { evidenceClass: "news_report",
    sourceTier: 3, claimText: "Unverified Research Gap hypothesis from reporting",
    sourceUrl: "https://research.example.com/articles/ai-credit-2026",
    provenanceUrls: [] });
  const brief = buildEditorialBrief(packageOf([article]), [primaryWithoutLink, contextWithLink]);
  assert.equal(brief.articles[0].editorial.readiness, "DEVELOPING");
  assert.equal(brief.articles[0].editorial.qualifiedEvidenceCount, 0);
  assert.equal(brief.articles[0].editorial.evidenceClaims.length, 0);
  assert.equal(brief.articles[0].sourceLinks.length, 1);
});


test("missing first-available or created timestamp cannot become historical proof", () => {
  const article = baseArticle("missing-time", "CoreWeave financing", [id1]);
  for (const override of [{ availableAt: null }, { createdAt: null }, { createdAt: null, availableAt: null }]) {
    const compiled = buildEditorialBrief(packageOf([article]), [evidence(id1, override)]);
    assert.equal(compiled.readerReadyCount, 0);
    assert.equal(compiled.articles[0].sourceLinks.length, 0);
    assert.equal(compiled.articles[0].editorial.evidenceClaims.length, 0);
  }
});


test("primary-sourced but UNRESOLVED Dossier lesson remains developing, not a canonical Story", () => {
  const article = baseArticle("provisional", "AI financing remains an open regime question", [id1]);
  const result = buildEditorialBrief(packageOf([article]), [evidence(id1)]);
  assert.equal(result.readerReadyCount, 0);
  assert.equal(result.articles[0].editorial.readiness, "DEVELOPING");
  assert.equal(result.articles[0].editorial.evidenceClaims.length, 1);
  assert.ok(result.articles[0].editorial.gaps.some(x => x.includes("adjudication")));
});
