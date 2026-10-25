import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectMarketBriefArticles } from "../lib/market-brief-articles.ts";
import { buildEditorialBrief, type EditorialEvidenceRow } from "../lib/market-brief-editorial.ts";
import { selectFrozenSourceFact } from "../lib/blue-desk-factual-feature.ts";
import { buildBlueDeskPublicStoryEvidenceV1 } from "../lib/blue-desk-public-story-evidence.ts";

// Compact, independently inspected 19 Oct 2026 production edition fixture.
// These values came from that frozen publication; no new thesis is generated.
const asOf = "2026-10-19T16:19:19.317Z";
const canonicalIds = [
  "c3776638-d2cb-40e1-acf7-36850d992edc",
  "e41e3ff2-65a4-4429-866f-08b6648ebabd",
  "cf1ecffd-b6f1-4431-bd34-a54657251b9e",
  "d847a1cd-bdc8-43d5-bacb-5557e6e42bfa",
  "0730fc3b-a14e-4008-a8da-7f16f15d34b9",
  "3a78cc54-c83c-45cd-8a88-3350d538f85b",
  "8055339a-e18d-47b9-bb08-d3753afc2f1e",
  "e4aef596-21ef-4ac2-a2c4-8aa7ed3b7e47",
];
const snapshot = {
  id: "fcea17ef-f575-4283-a363-7d5fa9c918c7",
  published_at: asOf,
  payload: {
    canonicalStoryManifest: [],
    marketTape: { sources: [] },
    dossier: {
      generatedAt: asOf,
      lessons: [{
        storyId: "6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e",
        title: "Why is the market rewarding AI-related backlog and guidance (e.g. Dell jump) despite evidence that backlog growth may not translate into near-term cash conversion or sustainable margins?",
        body: [
          "Issuer releases materially strengthen the supplier‑upstream observation and provide direct operator capex/capitalisation data that increase the plausibility of financing sensitivity; the Story is elevated from speculative to detected/watch.",
          "Combined canonical issuer results indicate that robust AI hardware demand is currently supporting supplier revenue and margins while neocloud operators are undertaking large, front‑loaded capacity investments and capitalising significant internal‑use software, which weakens near‑term operating cash conversion and raises external financing dependence.",
        ],
        evidenceRefs: canonicalIds,
        causeEffect: [
          { from: "AI compute demand (customers)", to: "Foundry demand/orders",
            relationship: "increases orders for accelerators/advanced wafers", evidenceStatus: "inferred", evidenceRefs: [] },
          { from: "Foundry demand/orders", to: "TSMC net revenue and operating margin (2026Q3)",
            relationship: "drives higher revenue and operating margin at foundries", evidenceStatus: "observed",
            evidenceRefs: [canonicalIds[1], canonicalIds[0]] },
          { from: "AI compute demand", to: "CoreWeave high cash PP&E and capitalised internal-use software (2026Q2)",
            relationship: "requires large capacity builds at cloud operators", evidenceStatus: "observed",
            evidenceRefs: [canonicalIds[2]] },
          { from: "Large capex and capitalised software",
            to: "CoreWeave modest operating cash flow (2026Q2) and financing sensitivity",
            relationship: "reduces near-term operating cash conversion and raises financing dependence", evidenceStatus: "observed",
            evidenceRefs: [canonicalIds[3], canonicalIds[2]] },
          { from: "Operator financing sensitivity", to: "Potential future impact on supplier demand/multiples",
            relationship: "may limit future capex or increase refinancing/default risk, feeding back to demand for accelerators",
            evidenceStatus: "inferred", evidenceRefs: [] },
        ],
        icon: "equities",
      }],
    },
  },
};

const evidence = (id: string, claimText: string, url: string, sourceName: string, createdAt: string): EditorialEvidenceRow => ({
  id, claimText, evidenceClass: "company_primary", supportDirection: "neutral",
  sourceTier: 1, sourceName, sourceUrl: url, provenanceUrls: [url],
  availableAt: "2026-10-18T01:01:16.085Z", createdAt,
});
const sourceRows: EditorialEvidenceRow[] = [
  evidence(canonicalIds[0], "TSMC reported 2026 Q3 operating margin of 58.7 percent.",
    "https://pr.tsmc.com/english/news/3346", "TSMC issuer release", "2026-10-18T01:01:27.846236Z"),
  evidence(canonicalIds[1], "TSMC reported 2026 Q3 revenue of USD 46.72 billion.",
    "https://pr.tsmc.com/english/news/3346", "TSMC issuer release", "2026-10-18T01:01:22.784933Z"),
  evidence(canonicalIds[2], "CoreWeave reported 2026 Q2 cash PPE purchases of USD 6.422 billion.",
    "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx", "CoreWeave issuer release", "2026-10-18T01:01:36.140482Z"),
  evidence(canonicalIds[3], "CoreWeave reported 2026 Q2 operating cash flow of USD 0.679 billion.",
    "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx", "CoreWeave issuer release", "2026-10-18T01:01:32.470118Z"),
];

test("actual 19 October AI lesson compiles source-supported facts, not an accepted thesis", () => {
  const projected = projectMarketBriefArticles(snapshot);
  assert.equal(projected.editionId, snapshot.id);
  assert.equal(projected.dossierId, null);
  assert.equal(projected.articles.length, 1);
  assert.equal(projected.articles[0].interpretationStatus, "UNRESOLVED");
  const compiled = buildEditorialBrief(projected, sourceRows);
  const article = compiled.articles[0];
  assert.equal(article.editionId, snapshot.id);
  assert.equal(article.editorial.qualifiedEvidenceCount, 4);
  assert.equal(article.editorial.evidenceClaims.length, 4);
  // Full frozen 19 October edition contains five edges; only three carry
  // primary issuer IDs. The two uncited inferred arrows must remain hidden.
  assert.equal(projected.articles[0].causalLinks?.length, 3);
  assert.equal(article.editorial.causalLinks.length, 3);
  assert.ok(article.editorial.causalLinks.every(edge => edge.evidenceStatus === "observed"));
  assert.ok(article.editorial.causalLinks.every(edge => edge.sourceUrl.startsWith("https://")));
  assert.equal(article.editorial.storyEligible, false,
    "Sourced causal context is not an accepted System 2 thesis");
  assert.equal(article.paragraphs.filter(p => p.role === "opening" || p.role === "mechanism").length, 2);
  assert.ok(article.paragraphs.every(p => p.evidenceScope === "lesson"),
    "Eight lesson-wide UUIDs are not individual proof of both paragraphs");
  assert.equal(article.paragraphs[0].canonicalEvidenceIds.length, 8,
    "Original frozen lesson evidence references remain intact");
  assert.ok(article.editorial.evidenceClaims.some(claim => claim.claimText.includes("cash PPE purchases")),
    "Source-linked issuer fact remains available to lead the reader");
  assert.equal(article.editorial.evidenceClaims.every(c => c.sourceUrl.startsWith("https://")), true);
  assert.equal(article.editorial.evidenceClaims.some(c => c.claimText.includes("Research Gap")), false);
});

test("later issuer disclosure cannot rewrite the 19 October edition", () => {
  const projected = projectMarketBriefArticles(snapshot);
  const later = sourceRows.map(row => row.id === canonicalIds[0]
    ? { ...row, createdAt: "2026-10-21T00:00:00Z" } : row);
  const compiled = buildEditorialBrief(projected, later);
  assert.equal(compiled.articles[0].editorial.evidenceClaims.length, 3);
  assert.equal(compiled.articles[0].dossierId, null);
});


test("unaccepted frozen AI story cannot become the current public home feature", () => {
  const projected = projectMarketBriefArticles(snapshot);
  const compiled = buildEditorialBrief(projected, sourceRows);
  assert.equal(compiled.articles[0].editorial.storyEligible, false);
  const home = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /article\.editorial\.storyEligible|projectMarketBriefArticles/);
  assert.match(home, /listPublishedReports/);
  assert.match(home, /projectLivingMarketTopics/);
});

test("Blue Desk explains only actual evidence-linked mechanism edges", () => {
  const detail = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /article\.editorial\.causalLinks\.length/);
  assert.match(detail, /These are the Dossier's existing evidence-linked causal steps/);
  assert.match(detail, /edge\.evidenceStatus\.replace/);
  assert.match(detail, /edge\.sourceUrl/);
});


test("a frozen real causal arrow disappears when all its issuer data postdate the edition", () => {
  const projected = projectMarketBriefArticles(snapshot);
  const after = sourceRows.map(row => [canonicalIds[0], canonicalIds[1]].includes(row.id)
    ? { ...row, availableAt: "2026-10-21T00:00:00Z" }
    : row);
  const result = buildEditorialBrief(projected, after).articles[0];
  assert.equal(result.editorial.causalLinks.length, 2);
  assert.ok(result.editorial.causalLinks.every(edge => !edge.to.includes("TSMC")));
});

test("latest unresolved AI edition can headline one exact issuer-reported fact, never a Story verdict", () => {
  const editorial = buildEditorialBrief(projectMarketBriefArticles(snapshot), sourceRows);
  const fact = selectFrozenSourceFact(editorial, new Date("2026-10-20T02:27:00Z"));
  assert.ok(fact);
  assert.equal(fact.contractVersion, "frozen-source-fact/1");
  assert.equal(fact.editionId, snapshot.id);
  assert.equal(fact.interpretation, "UNRESOLVED");
  assert.ok(canonicalIds.includes(fact.evidenceId));
  assert.match(fact.claimText, /reported/i);
  assert.match(fact.sourceUrl, /^https:\/\//);
  assert.ok(sourceRows.some(row => row.id === fact.evidenceId && row.provenanceUrls.includes(fact.sourceUrl)));
  assert.equal(editorial.articles[0].editorial.storyEligible, false);

  const home = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /PRIMARY-SOURCE OBSERVATION/);
  assert.doesNotMatch(home, /selectFrozenSourceFact|sourceFact|article\\.editorial\\.storyEligible/);
  assert.match(home, /LATEST VERIFIED DEVELOPMENT/);
  assert.match(home, /newsFeature\\.sourceUrl/);
});

test("factual lead refuses stale, future, missing and post-edition evidence", () => {
  const baseline = projectMarketBriefArticles(snapshot);
  const eligible = buildEditorialBrief(baseline, sourceRows);
  assert.equal(selectFrozenSourceFact(eligible, new Date("2026-10-22T17:00:00Z")), null);
  assert.equal(selectFrozenSourceFact(eligible, new Date("2026-10-19T15:00:00Z")), null);
  assert.equal(selectFrozenSourceFact(buildEditorialBrief(baseline, []), new Date("2026-10-20T02:27:00Z")), null);
  const futureRows = sourceRows.map(row => ({ ...row, availableAt: "2026-10-21T00:00:00Z" }));
  assert.equal(selectFrozenSourceFact(buildEditorialBrief(baseline, futureRows), new Date("2026-10-20T02:27:00Z")), null);
});

test("P-1 public Story DTO admits four pinned issuer observations but not its causal thesis", () => {
  const compiled = buildEditorialBrief(projectMarketBriefArticles(snapshot), sourceRows);
  const article = compiled.articles[0];
  const result = buildBlueDeskPublicStoryEvidenceV1(compiled, article.articleId);
  assert.ok(result, "exact production-derived AI Story ID must resolve");
  assert.equal(result.contractVersion, "blue-desk-public-story-evidence/1");
  assert.equal(result.editionId, snapshot.id);
  assert.equal(result.facts.length, 4);
  assert.equal(result.storyAdmission, "NOT_ADJUDICATED");
  assert.equal(result.interpretation, "UNRESOLVED");
  assert.deepEqual(result.causalAttribution, { status: "NOT_VERIFIED", explanation: null });
  assert.deepEqual(result.marketReaction, { status: "NOT_VERIFIED", observation: null });
  assert.equal(result.confirmation.checks.length, 0);
  assert.deepEqual(result.facts.map(item => item.evidenceId).sort(), canonicalIds.slice(0, 4).sort());
  assert.ok(result.facts.every(item => item.originalSourceUrl.startsWith("https://")));
  assert.deepEqual(Object.keys(result), [
    "contractVersion", "editionId", "articleId", "publishedAt", "interpretation",
    "storyAdmission", "evidenceAvailability", "facts", "marketReaction",
    "causalAttribution", "confirmation", "unavailableReason",
  ]);
  const json = JSON.stringify(result);
  for (const secretField of ["diagnostics", "memory", "researchGaps", "evidenceGovernance", "dossierId", "sourceTier", "provenanceUrls", "thesisChanges"]) {
    assert.equal(json.includes('"' + secretField + '"'), false, secretField + " must never leak");
  }
});

test("public Story DTO fails closed for forged identity, missing evidence or post-edition additions", () => {
  const compiled = buildEditorialBrief(projectMarketBriefArticles(snapshot), sourceRows);
  const id = compiled.articles[0].articleId;
  assert.equal(buildBlueDeskPublicStoryEvidenceV1(compiled, "article:00000000-0000-4000-8000-000000000000:6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e"), null);
  assert.equal(buildBlueDeskPublicStoryEvidenceV1(compiled, "article:garbage"), null);
  const future = structuredClone(compiled);
  future.articles[0].editorial.evidenceClaims[0].availableAt = "2026-10-20T00:00:00Z";
  const result = buildBlueDeskPublicStoryEvidenceV1(future, id);
  assert.ok(result);
  assert.equal(result.facts.length, 3);
  const noEvidence = buildEditorialBrief(projectMarketBriefArticles(snapshot), []);
  const missing = buildBlueDeskPublicStoryEvidenceV1(noEvidence, id);
  // No qualifying cited observation and no declarative statement means no
  // public Story at all, rather than a fake verification-status headline.
  assert.equal(missing, null);
});

test("an editorial READY flag and later inferred Dossier ID cannot upgrade a frozen Story", () => {
  const compiled = buildEditorialBrief(projectMarketBriefArticles(snapshot), sourceRows);
  const forged = structuredClone(compiled);
  forged.articles[0].editorial.storyEligible = true;
  forged.articles[0].dossierId = "cf977394-ca7c-49da-93cc-4f3da98d873b";
  forged.articles[0].interpretationStatus = "SUPPORTED";
  const dto = buildBlueDeskPublicStoryEvidenceV1(forged, forged.articles[0].articleId);
  assert.ok(dto);
  assert.equal(dto.interpretation, "UNRESOLVED");
  assert.equal(dto.storyAdmission, "NOT_ADJUDICATED");
});
