import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectMarketBriefArticles } from "../lib/market-brief-articles.ts";
import { buildEditorialBrief, type EditorialEvidenceRow } from "../lib/market-brief-editorial.ts";

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


test("exact Story route retains historical reader and pinned provenance", () => {
  const page = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getHybridExactDailyBriefEdition\(edition\)/);
  assert.match(page, /loadEditorialMarketBrief\(projectMarketBriefArticles\(frozen\)\)/);
  assert.match(page, /item\.articleId === normalizedArticleId && item\.editionId === edition/);
  assert.match(page, /decodeURIComponent\(articleId\)/);
});
