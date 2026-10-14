import assert from "node:assert/strict";
import { test } from "node:test";
import { projectMarketBriefArticles } from "../lib/market-brief-articles.ts";

test("projectMarketBriefArticles projects canonical articles from a daily brief edition snapshot", () => {
  const sampleSnapshot = {
    id: "edition-2026-10-15-01",
    published_at: "2026-10-15T08:00:00.000Z",
    source_record_refs: ["source-ref-bls-01", "source-ref-fed-02"],
    payload: {
      dossier: {
        id: "7e9582cb-21c8-4f63-9814-dfd5ef0fb911",
        generatedAt: "2026-10-15T08:00:00.000Z",
        lessons: [
          {
            storyId: "story-us-rates-01",
            title: "US Treasury Yields Reprice as Inflation Risks Linger",
            question: "Will the Fed hold rates higher for longer?",
            icon: "bonds",
            confidence: 85,
            body: [
              "US Nonfarm Payrolls and CPI data exceeded expectations, prompting front-end yield repricing.",
              "Higher short-end rates increase borrowing costs and compress credit spreads across corporate markets.",
              "Term premium expansion is transmitting directly into 10-year yields and mortgage rates.",
              "Historical precedent suggests prolonged rate pauses keep real yields restrictive."
            ],
            callouts: [
              { type: "confirmation", text: "10-year yields hold above 4.25%" },
              { type: "invalidation", text: "Sub-50k payroll print or core CPI decelerates below 0.2% MoM" },
              { type: "warning", text: "Labor market softness could trigger rapid rate cut expectations" }
            ],
            evidenceRefs: ["ev-uuid-001", "ev-uuid-002"]
          },
          {
            storyId: "story-oil-supply-02",
            title: "Crude Oil Spikes on Hormuz Supply Concerns",
            question: "Does energy supply disruption threaten European growth?",
            icon: "energy",
            confidence: 75,
            body: [
              "Middle East shipping friction tightened physical Brent crude differentials.",
              "Refinery margin expansion increases European energy import bills and headline inflation risk.",
              "Freight rate spikes directly pass through into spot energy benchmark pricing."
            ],
            callouts: [
              { type: "confirmation", text: "Brent holds above $85/bbl" },
              { type: "invalidation", text: "Friction resolves and tanker traffic normalises" }
            ],
            evidenceRefs: ["ev-uuid-003"]
          }
        ]
      },
      canonicalStoryManifest: [
        {
          storyId: "story-us-rates-01",
          state: {
            confidence: 85,
            status: "confirmed"
          },
          reasoning: {
            title: "US Treasury Yields Reprice as Inflation Risks Linger",
            centralQuestion: "Will the Fed hold rates higher for longer?",
            thesis: "Persistent wage growth and core CPI force short-end Treasury repricing.",
            acceptedExplanation: "Sticky inflation expectations drive term premium expansion across US Treasuries.",
            whatChanged: "Labor market strength delayed anticipated rate cuts.",
            marketReaction: "US 2Y yield rose 12 bps while S&P 500 slipped 0.8%.",
            claims: [
              { id: "c1", type: "fact", text: "Core CPI printed 0.3% MoM", evidenceIds: ["ev-uuid-001"] }
            ],
            causalChain: [
              { id: "e1", sourceHypothesisId: "h1", from: "Inflation", relationship: "drives", to: "Yields", evidenceState: "observed", evidenceIds: ["ev-uuid-002"] }
            ],
            countercase: {
              strongest: "Labor market softness could trigger rapid rate cut expectations",
              evidenceIds: ["ev-uuid-004"]
            }
          }
        }
      ],
      marketTape: {
        sources: [
          { title: "U.S. Bureau of Labor Statistics", url: "https://www.bls.gov/news.release/empsit.htm" }
        ]
      }
    }
  };

  const result = projectMarketBriefArticles(sampleSnapshot);

  assert.equal(result.contractVersion, "market-brief-article/1");
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.editionId, "edition-2026-10-15-01");
  assert.equal(result.dossierId, "7e9582cb-21c8-4f63-9814-dfd5ef0fb911");
  assert.ok(result.articles.length >= 2, "Projects multiple distinct topical articles");

  const article1 = result.articles[0];
  assert.equal(article1.contractVersion, "market-brief-article/1");
  assert.equal(article1.articleId, "article:edition-2026-10-15-01:story-us-rates-01");
  assert.equal(article1.editionId, "edition-2026-10-15-01");
  assert.equal(article1.dossierId, "7e9582cb-21c8-4f63-9814-dfd5ef0fb911");
  assert.equal(article1.category, "Rates & Policy");
  assert.equal(article1.interpretationStatus, "UNRESOLVED");
  assert.ok(article1.title.length <= 63, "Title length is concise");
  assert.ok(article1.paragraphs.length >= 2, "Has paragraphs for explicitly supplied roles");

  // Check roles in paragraph sequence
  const roles = article1.paragraphs.map(p => p.role);
  assert.ok(roles.includes("opening"));

  // Check evidence UUID retention
  const evIds = article1.paragraphs.flatMap(p => p.canonicalEvidenceIds);
  assert.ok(evIds.includes("ev-uuid-001") || evIds.includes("ev-uuid-002"));

  // Check second article category & structure
  const article2 = result.articles[1];
  assert.equal(article2.category, "Energy & Commodities");
  assert.equal(article2.articleId, "article:edition-2026-10-15-01:story-oil-supply-02");
});

test("projectMarketBriefArticles handles missing or invalid input gracefully", () => {
  const resultEmpty = projectMarketBriefArticles(null);
  assert.equal(resultEmpty.contractVersion, "market-brief-article/1");
  assert.equal(resultEmpty.status, "INSUFFICIENT_DATA");
  assert.equal(resultEmpty.articles.length, 0);
  assert.ok(resultEmpty.blockedReason?.includes("No valid publication or snapshot"));

  const resultNoStories = projectMarketBriefArticles({ id: "empty-edition", payload: {} });
  assert.equal(resultNoStories.status, "INSUFFICIENT_DATA");
  assert.equal(resultNoStories.articles.length, 0);
  assert.ok(resultNoStories.blockedReason?.includes("No durable, source-grounded story or lesson records"));
});
