import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");

test("public homepage reads exactly one published daily brief, not 24 Presenter editions", () => {
  assert.match(page, /getLiveDeskHomepageDailyBrief\(\{ fresh: true \}\)/);
  assert.doesNotMatch(page, /getHybridPresenterEditionCandidates/);
  assert.match(page, /projectMarketBriefArticles\(latest\)/);
  assert.match(publication, /export async function getLiveDeskHomepageDailyBrief/);
  assert.match(publication, /&order=published_at\.desc,id\.desc&limit=1/);
});

test("single-edition homepage projection still uses server-owned archive permissions", () => {
  assert.match(publication, /\["hybrid_publication_snapshots", "story_events", "story_thesis_versions"\]\.includes\(table\) \? serverKey : key/);
  assert.match(page, /loadEditorialMarketBrief\(projectMarketBriefArticles\(latest\)\)/);
});
