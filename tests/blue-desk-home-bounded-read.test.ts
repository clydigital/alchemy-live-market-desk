import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");

test("Bluebelly homepage prioritises observed facts and persistent Stories, not public copy-pasted articles", () => {
  assert.match(page, /getCurrentVerifiedMarketMotion/);
  assert.match(page, /selectVerifiedNewsBriefs\(verifiedMotions, now/);
  assert.doesNotMatch(page, /listPublishedReports/);
  assert.match(page, /getPublicThesisLedger/);
  assert.match(page, /getPublicSourceObservations/);
  assert.match(page, /data-public-thesis-ledger="read-only"/);
  assert.doesNotMatch(page, /getLiveDeskHomepageDailyBrief|projectMarketBriefArticles|projectFrozenTrackedStories/);
  assert.doesNotMatch(page, /loadEditorialMarketBrief|sourceFact|story_thesis_versions/);
});

test("legacy immutable Dossier readers are preserved for migration and historical safety", () => {
  assert.match(publication, /export async function getLiveDeskHomepageDailyBrief/);
  assert.match(publication, /&order=published_at\.desc,id\.desc&limit=1/);
  assert.match(publication, /\["hybrid_publication_snapshots", "story_events", "story_thesis_versions"\]\.includes\(table\) \? serverKey : key/);
});
