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
  const brief = buildEditorialBrief(packageOf([baseArticle("1", "CoreWeave spending raises funding questions", [id1])]), [evidence(id1)]);
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
  const ready = baseArticle("c", "CoreWeave earnings and financing costs", [id1]);
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

test("missing or future provenance timestamps cannot qualify a source", () => {
  const article = baseArticle("6", "Issuer fundamentals update", [id1]);
  for (const override of [
    { createdAt: null },
    { availableAt: null },
    { createdAt: "2026-10-20T01:00:00Z" },
    { availableAt: "2026-10-20T01:00:00Z" },
  ]) {
    const out = buildEditorialBrief(packageOf([article]), [evidence(id1, override)]);
    assert.equal(out.articles[0].editorial.qualifiedEvidenceCount, 0);
    assert.equal(out.articles[0].sourceLinks.length, 0);
  }
});

test("original evidence provenance is preferred over an umbrella publisher URL", () => {
  const out = buildEditorialBrief(packageOf([baseArticle("7", "Company capex disclosure", [id1])]), [
    evidence(id1, {
      sourceUrl: "https://example.org/market-data",
      provenanceUrls: ["https://example.org/filings/2026/q3-official-results"],
    }),
  ]);
  assert.deepEqual(out.articles[0].sourceLinks.map(x => x.url),
    ["https://example.org/filings/2026/q3-official-results"]);
  assert.deepEqual(out.articles[0].editorial.evidenceClaims.map(x => x.sourceUrl),
    ["https://example.org/filings/2026/q3-official-results"]);
});


test("source-ready Dossier analysis does not become an accepted hero Story without canonical adjudication", () => {
  const provisional = baseArticle("unresolved", "AI capex funding divergence", [id1]);
  const analysis = buildEditorialBrief(packageOf([provisional]), [evidence(id1)]).articles[0];
  assert.equal(analysis.editorial.readiness, "READY");
  assert.equal(analysis.editorial.storyEligible, false);
  assert.ok(analysis.editorial.gaps.includes("No canonical Story adjudication"));
  const accepted = { ...provisional, dossierId: id3, interpretationStatus: "SUPPORTED" as const };
  const feature = buildEditorialBrief(packageOf([accepted]), [evidence(id1)]).articles[0];
  assert.equal(feature.editorial.readiness, "READY");
  assert.equal(feature.editorial.storyEligible, true);
  const mixed = { ...accepted, interpretationStatus: "MIXED" as const };
  assert.equal(buildEditorialBrief(packageOf([mixed]), [evidence(id1)]).articles[0].editorial.storyEligible, true);
});


test("Dossier causal arrows require attributable source available by edition time", () => {
  const article = { ...baseArticle("causal", "AI investment and financing", [id1]),
    causalLinks: [{ from: "Compute demand", to: "Supplier revenue", relationship: "raises",
      evidenceStatus: "inferred" as const, canonicalEvidenceIds: [id1] }],
  };
  const verified = buildEditorialBrief(packageOf([article]), [evidence(id1)]).articles[0];
  assert.equal(verified.editorial.causalLinks.length, 1);
  assert.equal(verified.editorial.causalLinks[0].evidenceStatus, "inferred",
    "Source-backed data does not upgrade an inferred mechanism to confirmed causality");
  assert.equal(verified.editorial.causalLinks[0].sourceUrl,
    "https://investors.coreweave.com/news/news-details/2026/quarterly-results");
  assert.equal(verified.editorial.storyEligible, false);
  const stale = buildEditorialBrief(packageOf([article]), [evidence(id1, {
    availableAt: "2026-10-21T10:00:00Z",
  })]).articles[0];
  assert.deepEqual(stale.editorial.causalLinks, []);
  const contextual = buildEditorialBrief(packageOf([article]), [evidence(id1, {
    evidenceClass: "news_report", sourceTier: 3,
  })]).articles[0];
  assert.deepEqual(contextual.editorial.causalLinks, []);
});

test("a question-only frozen lesson displays a cited reported fact, not an internal status", () => {
  const article = baseArticle("market-question", "", [id1]);
  const row = evidence(id1, {
    claimText: "CoreWeave reported US$6.422 billion in cash property and equipment additions for Q2 2026.",
  });
  const brief = buildEditorialBrief(packageOf([article]), [row]);
  assert.equal(brief.articles[0].editorial.readiness, "READY");
  assert.equal(brief.articles[0].title,
    "CoreWeave reported US$6.422 billion in cash property and equipment additions…");
  assert.equal(brief.articles[0].sourceLinks.length, 1);
  assert.equal(brief.articles[0].interpretationStatus, "UNRESOLVED");
});

test("when no issuer observation is admitted, a question never becomes a fabricated headline", () => {
  const article = baseArticle("no-headline", "", [id1]);
  const brief = buildEditorialBrief(packageOf([article]), [evidence(id1, {
    claimText: "Market financing might tighten if bond yields rise further",
    evidenceClass: "news_report", sourceTier: 3,
  })]);
  assert.equal(brief.articles[0].title, "");
  assert.equal(brief.articles[0].editorial.readiness, "RESEARCH_ONLY");
});


test("V7 article sections keep a source-ready item as a factual brief unless five distinct qualifying claims exist", () => {
  const article = baseArticle("brief", "Source-backed issuer fact without a complete report", [id1]);
  const ready = buildEditorialBrief(packageOf([article]), [evidence(id1)]).articles[0];
  assert.equal(ready.editorial.readiness, "READY", "Legacy issuer-fact suitability stays compatible");
  assert.equal(ready.editorial.sections.contractVersion, "article-sections/2");
  assert.equal(ready.editorial.sections.recommendedFormat, "FACTUAL_BRIEF");
  assert.equal(ready.editorial.sections.reporting.length, 0,
    "Story-wide references never become three factual source claims");
  assert.equal(ready.editorial.sections.interpretation.length, 0);
  assert.ok(ready.editorial.sections.gaps.some(x => x.includes("Fewer than three")));
  const unsupported = buildEditorialBrief(packageOf([article]), [evidence(id1, {
    createdAt: "2026-10-21T00:00:00Z",
  })]).articles[0];
  assert.equal(unsupported.editorial.sections.recommendedFormat, "RESEARCH_ONLY");
});

test("V7 admits long-form sections only from three primary facts and two adjudicated interpretations", () => {
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ];
  const texts = [
    "The company's quarterly statement disclosed capital expenditure of several billion dollars and reported the figure on the same accounting basis as the prior quarter.",
    "Its official results separately reported quarterly operating cash flow, providing a directly attributable measure of cash generated before investment in fixed assets.",
    "The issuer's accompanying debt note itemised the financing commitments, which must not be mistaken for either customer orders or sales that were already recognised.",
    "The timing gap between capital investment and cash collections could increase reliance on borrowing unless customer receipts improve, even as near-term supplier revenue rises.",
    "A more constructive interpretation requires utilisation and recurring cash receipts to catch up with hardware installations, with contract cancellation rights remaining a significant uncertainty.",
  ];
  const paragraphs = texts.map((text, i) => ({
    role: (i < 3 ? "context" : "mechanism") as "context" | "mechanism",
    text, sourceRefs: [], canonicalEvidenceIds: [ids[i]],
    evidenceScope: "claim" as const,
    claimType: (i < 3 ? "fact" : "interpretation") as "fact" | "interpretation",
  }));
  const accepted = {
    ...baseArticle("long", "Issuer spending and customer cash conversion", ids),
    paragraphs,
    dossierId: "99999999-9999-4999-8999-999999999999",
    interpretationStatus: "MIXED" as const,
  };
  const sources = ids.map((id, i) => evidence(id, {
    claimText: texts[i],
    provenanceUrls: ["https://issuer.example.com/results/2026/q3-claim-" + (i + 1)],
  }));
  const ready = buildEditorialBrief(packageOf([accepted]), sources).articles[0];
  assert.equal(ready.editorial.sections.recommendedFormat, "FULL_ARTICLE");
  assert.equal(ready.editorial.sections.reporting.length, 3);
  assert.equal(ready.editorial.sections.interpretation.length, 2);
  assert.deepEqual(ready.editorial.sections.reporting.map(p => p.evidenceIds[0]), ids.slice(0, 3));
  assert.deepEqual(ready.editorial.sections.interpretation.map(p => p.evidenceIds[0]), ids.slice(3));
  assert.ok(ready.editorial.sections.reporting.every(p => p.originalUrls[0]?.startsWith("https://issuer.example.com/results/")));
  assert.equal(ready.editionId, "edition-1");
  assert.equal(ready.contractVersion, "market-brief-article/1", "Legacy article identity and contract are unchanged");

  const unresolved = buildEditorialBrief(packageOf([{ ...accepted,
    interpretationStatus: "UNRESOLVED",
  }]), sources).articles[0];
  assert.equal(unresolved.editorial.sections.recommendedFormat, "FACTUAL_BRIEF");
  assert.equal(unresolved.editorial.sections.interpretation.length, 0,
    "No canonical System 2 verdict means no publication-ready market interpretation");

  const late = buildEditorialBrief(packageOf([accepted]), sources.map((row, i) =>
    i === 0 ? { ...row, availableAt: "2026-10-22T00:00:00Z" } : row)).articles[0];
  assert.equal(late.editorial.sections.recommendedFormat, "FACTUAL_BRIEF");
  assert.equal(late.editorial.sections.reporting.length, 2,
    "A source first available after the immutable edition cannot count");
});
