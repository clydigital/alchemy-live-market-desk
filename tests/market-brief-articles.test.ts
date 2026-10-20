import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { projectMarketBriefArticles, splitExistingWatchTests, readerFacingMarketText } from "../lib/market-brief-articles.ts";

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
              { id: "c1", type: "fact", text: "Labor market strength delayed anticipated rate cuts.", evidenceIds: ["ev-uuid-001"] },
              { id: "c2", type: "fact", text: "Sticky inflation expectations drive term premium expansion across US Treasuries.", evidenceIds: ["ev-uuid-002"] }
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
  assert.ok(article1.paragraphs.length >= 1, "Has paragraphs for explicitly supplied roles");
  assert.deepEqual(article1.confirmationTests, ["10-year yields hold above 4.25%"]);
  assert.deepEqual(article1.invalidationTests, ["Sub-50k payroll print or core CPI decelerates below 0.2% MoM"]);

  // Check roles in paragraph sequence
  const roles = article1.paragraphs.map(p => p.role);
  assert.ok(roles.includes("opening"));

  // Check evidence UUID retention
  const evIds = article1.paragraphs.flatMap(p => p.canonicalEvidenceIds);
  assert.ok(evIds.includes("ev-uuid-001") || evIds.includes("ev-uuid-002"));
  assert.equal(article1.paragraphs.find(p => p.role === "opening")?.evidenceScope, "claim",
    "Only an exact upstream claim match can receive sentence-level attribution");
  assert.ok(article1.paragraphs.filter(p => p.role === "context").every(p => p.evidenceScope === "lesson"));


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


test("watch-condition display normalises punctuation, preserves author intent and exact order", () => {
  assert.deepEqual(splitExistingWatchTests("  A holds above 4%.; B falls below 2%..; A holds above 4%. ; C normalises. "), [
    "A holds above 4%", "B falls below 2%", "C normalises"
  ]);
  assert.deepEqual(splitExistingWatchTests(null), []);
  assert.deepEqual(splitExistingWatchTests(""), []);
});

test("Deep Dive shows structured conditions only once and preserves older outlook fallback", () => {
  const route = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(route, /hasStructuredWatch && p\.role === "outlook"/);
  assert.match(route, /confirmations\.map/);
  assert.match(route, /invalidations\.map/);
  assert.match(route, /What strengthens this view/);
  assert.match(route, /What would weaken it/);
  assert.match(route, /article\.conditionalOutlook \? \(/);
  assert.match(route, /getHybridExactDailyBriefEdition\(edition\)/);
});


test("reader edits only explicit workflow-tail jargon and leaves numeric evidence intact", () => {
  const original = "Issuer results showed USD 6.422 billion capex; the Story is elevated from speculative to detected/watch.";
  assert.equal(readerFacingMarketText(original), "Issuer results showed USD 6.422 billion capex.");
  assert.equal(readerFacingMarketText("Combined canonical issuer results indicate AI spending is high."),
    "Issuer results indicate AI spending is high.");
  assert.equal(readerFacingMarketText("Yields fell 12 bps while equities sold off."),
    "Yields fell 12 bps while equities sold off.");
  assert.ok(original.includes("detected/watch"), "Input is not mutated");
});

test("Deep Dive renders direct issuer facts before unresolved commentary, not pooled IDs as claim proof", () => {
  const route = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(route, /What the original sources report/);
  assert.match(route, /article\.editorial\.evidenceClaims\.slice\(0, 8\)/);
  assert.match(route, /readerFacingMarketText\(paragraph\.text\)/);
  assert.match(route, /readerParagraphSources\(paragraph, article\.editorial\.evidenceClaims\)/);
  assert.match(route, /Lesson-level evidence only; this particular statement is not independently verified/);
  assert.match(route, /No independently source-linked price reaction is available/);
  assert.match(route, /Working explanation/);
  assert.match(route, /getHybridExactDailyBriefEdition\(edition\)/);
});


test("only evidence-pinned canonical Dossier arrows become visible, preserving exact status", () => {
  const id = "c3776638-d2cb-40e1-acf7-36850d992edc";
  const frozen = { id: "edition-2026-10-19", published_at: "2026-10-19T16:19:19Z", payload: {
    dossier: { id: "7e9582cb-21c8-4f63-9814-dfd5ef0fb911", generatedAt: "2026-10-19T16:19:19Z", lessons: [{
      storyId: "6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e",
      title: "AI investment and supplier demand",
      body: ["Issuer results show rising supplier sales.", "Funding strain remains a possible consequence."],
      evidenceRefs: [id],
      causeEffect: [
        { from: "Compute orders", to: "Foundry utilisation", relationship: "lift", evidenceStatus: "inferred", evidenceRefs: [id] },
        { from: "Invented fact", to: "New trend", relationship: "proves", evidenceStatus: "observed", evidenceRefs: [] },
        { from: "Unsourced", to: "Conclusion", relationship: "moves", evidenceStatus: "observed", evidenceRefs: ["not-a-uuid"] },
      ],
    }] },
  } };
  const result = projectMarketBriefArticles(frozen);
  assert.equal(result.articles.length, 1);
  assert.deepEqual(result.articles[0].causalLinks, [{
    from: "Compute orders", to: "Foundry utilisation", relationship: "lift",
    evidenceStatus: "inferred", canonicalEvidenceIds: [id],
  }]);
  assert.equal(result.articles[0].interpretationStatus, "UNRESOLVED");
});

test("frozen US rates and energy lessons omit workflow status without inventing a market reaction", () => {
  const rates = "Detected: hot Sept CPI contemporaneous with front-end repricing, a MOVE spike, heterogeneous intraday 10Y snapshots and a sustained rise in 10Y TIPS real yields; intraday/tick archives remain outstanding.";
  const oil = "Evidence shows front-month backwardation in WTI/Brent and CME documentation supports the roll-yield/storage mechanism; Story established in detected state.";
  const diesel = "story: detected awaiting EIA/AIS/trade confirmation";
  const working = "The accepted explanation is that the Sept CPI surprise mechanically raised short-term Fed-rate expectations.";
  assert.equal(readerFacingMarketText(rates),
    "hot Sept CPI contemporaneous with front-end repricing, a MOVE spike, heterogeneous intraday 10Y snapshots and a sustained rise in 10Y TIPS real yields; intraday/tick archives remain outstanding.");
  assert.equal(readerFacingMarketText(oil),
    "Evidence shows front-month backwardation in WTI/Brent and CME documentation supports the roll-yield/storage mechanism.");
  assert.equal(readerFacingMarketText(diesel), "", "An operational placeholder is not a public market fact");
  assert.equal(readerFacingMarketText(working),
    "A working explanation is that the Sept CPI surprise mechanically raised short-term Fed-rate expectations.");
  assert.equal(readerFacingMarketText("Story: oil appears volatile"), "Story: oil appears volatile",
    "Do not broadly strip ordinary market language");
  assert.ok(oil.includes("Story established"), "The original frozen Dossier text remains intact");
});

test("Rates and oil Deep Dive visibly disclose no primary sources and omit process-only paragraphs", () => {
  const page = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /!article\.editorial\.evidenceClaims\.length/);
  assert.match(page, /No original-source observation has passed the evidence and publication-time checks/);
  assert.match(page, /readerFacingMarketText\(p\.text\)\.length > 0/);
  assert.match(page, /No independently source-linked price, yield or futures reaction/);
  assert.doesNotMatch(page, /issuer figures alone cannot establish/i);
  assert.match(page, /getHybridExactDailyBriefEdition\(edition\)/);
});
