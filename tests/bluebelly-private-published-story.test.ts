import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
import {
  BLUEBELLY_PRIVATE_PUBLISHED_STORY_V1,
  parseExactPublishedStorySelection,
  projectBluebellyPrivatePublishedStory,
} from "../lib/bluebelly-private-published-story.ts";
import { projectMarketBriefArticles } from "../lib/market-brief-articles.ts";
import { buildEditorialBrief, type EditorialEvidenceRow } from "../lib/market-brief-editorial.ts";

const editionId = "fcea17ef-f575-4283-a363-7d5fa9c918c7";
const storyId = "6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const articleId = "article:" + editionId + ":" + storyId;
const asOf = "2026-10-19T16:19:19.317Z";
const evidenceIds = [
  "c3776638-d2cb-40e1-acf7-36850d992edc",
  "e41e3ff2-65a4-4429-866f-08b6648ebabd",
];
// Production-derived 19 October AI narrative fixture, already used in the
// existing blue-desk-real-ai-edition regression. Not a new live market claim.
const frozen = {
  id: editionId,
  published_at: asOf,
  payload: {
    canonicalStoryManifest: [],
    marketTape: { sources: [] },
    dossier: {
      generatedAt: asOf,
      lessons: [{
        storyId,
        title: "Why is AI backlog rising despite questions about cash conversion?",
        body: [
          "Issuer results point to higher foundry demand while capital spending rises across AI suppliers.",
          "Demand growth does not resolve the question of operating cash generation at AI infrastructure providers.",
        ],
        evidenceRefs: evidenceIds,
        icon: "equities",
      }],
    },
  },
};
const src = "https://pr.tsmc.com/english/news/3346";
const original: EditorialEvidenceRow[] = evidenceIds.map((id, i) => ({
  id,
  claimText: i === 0
    ? "TSMC reported 2026 Q3 operating margin of 58.7 percent."
    : "TSMC reported 2026 Q3 revenue of USD 46.72 billion.",
  evidenceClass: "company_primary",
  supportDirection: "neutral",
  sourceTier: 1,
  sourceName: "TSMC issuer release",
  sourceUrl: src,
  provenanceUrls: [src],
  availableAt: "2026-10-18T01:01:16.085Z",
  createdAt: "2026-10-18T01:01:27.846236Z",
}));
const brief = () => buildEditorialBrief(projectMarketBriefArticles(frozen), original);

test("exact identity only, no mismatched edition or title search", () => {
  assert.deepEqual(parseExactPublishedStorySelection(editionId, articleId), { editionId, articleId });
  assert.equal(parseExactPublishedStorySelection(null, articleId), null);
  assert.equal(parseExactPublishedStorySelection(editionId, "not-an-article"), null);
  assert.equal(parseExactPublishedStorySelection(editionId, "article:11111111-1111-4111-8111-111111111111:" + storyId), null);
  assert.equal(parseExactPublishedStorySelection(editionId, articleId + "extra"), null);
  assert.equal(parseExactPublishedStorySelection("invalid", articleId), null);
});

test("published editorial article exposes exactly dated original facts, not an accepted Story thesis", () => {
  const compiled = brief();
  assert.equal(compiled.articles[0].articleId, articleId);
  const dto = projectBluebellyPrivatePublishedStory(compiled, articleId);
  assert.ok(dto);
  assert.equal(dto.contractVersion, BLUEBELLY_PRIVATE_PUBLISHED_STORY_V1);
  assert.equal(dto.recordType, "PUBLISHED_EDITORIAL_ARTICLE");
  assert.equal(dto.editionId, editionId);
  assert.equal(dto.publishedAt, asOf);
  assert.equal(dto.storyAdmission, "NOT_ADJUDICATED");
  assert.equal(dto.interpretation, "UNRESOLVED");
  assert.equal(dto.evidenceAvailability, "SOURCE_LINKED");
  assert.equal(dto.facts.length, 2);
  assert.deepEqual(dto.facts.map(f => f.evidenceId), evidenceIds);
  assert.ok(dto.facts.every(f => f.originalSourceUrl === src));
  assert.deepEqual(dto.marketReaction, { status: "NOT_VERIFIED", observation: null });
  assert.deepEqual(dto.causalAttribution, { status: "NOT_VERIFIED", explanation: null });
  assert.deepEqual(Object.keys(dto).sort(), [
    "contractVersion", "recordType", "editionId", "articleId", "publishedAt",
    "title", "deck", "category", "interpretation", "storyAdmission",
    "evidenceAvailability", "facts", "marketReaction", "causalAttribution", "confirmation",
  ].sort());
  const json = JSON.stringify(dto);
  for (const field of ["memory", "diagnostics", "researchGaps", "thesisChanges",
    "canonicalEvidenceIds", "sourceRecordRefs", "sourceTier", "dossierId"]) {
    assert.equal(json.includes('"' + field + '"'), false, "private " + field);
  }
});

test("later evidence and forged edition identity cannot leak or rewrite archived evidence", () => {
  const compiled = brief();
  assert.equal(projectBluebellyPrivatePublishedStory(compiled, "article:11111111-1111-4111-8111-111111111111:" + storyId), null);
  const later = structuredClone(compiled);
  later.articles[0].editorial.evidenceClaims.forEach(item => {
    item.availableAt = "2026-10-22T00:00:00.000Z";
  });
  assert.equal(projectBluebellyPrivatePublishedStory(later, articleId), null);
  const noSources = buildEditorialBrief(projectMarketBriefArticles(frozen), []);
  assert.equal(projectBluebellyPrivatePublishedStory(noSources, articleId), null);
});

test("published story API is owner-only and shares exact frozen public reader path", () => {
  const route = "/api/owner/bluebelly/v1/published-story";
  assert.equal(blueDeskHostAccess(route, "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess(route, "alchemy-live-market-desk.vercel.app"), "private");
  const source = readFileSync(new URL("../app/api/owner/bluebelly/v1/published-story/route.ts", import.meta.url), "utf8");
  assert.match(source, /client\.auth\.getUser\(\)/);
  assert.match(source, /app_access_allowlist/);
  assert.match(source, /getHybridExactDailyBriefEdition/);
  assert.match(source, /loadEditorialMarketBrief\(projectMarketBriefArticles\(frozen\)\)/);
  assert.match(source, /parseExactPublishedStorySelection/);
  assert.match(source, /private, no-store/);
  assert.doesNotMatch(source, /getLiveDeskHomepageDailyBrief|getHybridPresenterEditionCandidates|Access-Control-Allow-Origin|SUPABASE_SERVICE_ROLE_KEY/);
});
