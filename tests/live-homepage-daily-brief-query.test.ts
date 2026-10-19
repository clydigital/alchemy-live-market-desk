import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");

test("Live overview fetches exactly one current daily brief without scanning Presenter editions", () => {
  assert.match(homepage, /getLiveDeskHomepageDailyBrief\(\)\.catch\(\(\) => null\)/);
  assert.match(homepage, /projectMarketBriefArticles\(latestEdition\)/);
  assert.doesNotMatch(homepage, /getHybridPresenterEditionCandidates|editionCandidates\[0\]/);

  const homepageReader = publication.match(
    /export async function getLiveDeskHomepageDailyBrief[\s\S]*?(?=\n\/\*\* Daily briefs)/,
  )?.[0];
  assert.ok(homepageReader, "Home page must use a distinct latest-only reader");
  assert.match(homepageReader, /snapshot_type=eq\.daily_brief/);
  assert.match(homepageReader, /order=published_at\.desc,id\.desc&limit=1/);
  assert.match(homepageReader, /return rows\[0\] \|\| null/);
  assert.doesNotMatch(homepageReader, /offset=|limit=24|select=\*/);
});

test("Presenter keeps its 24-edition window and historical archive without Live overview changes", () => {
  const presenterReader = publication.match(
    /export async function getHybridPresenterEditionCandidates[\s\S]*?(?=\n\/\*\*\n \* Live Overview)/,
  )?.[0];
  assert.ok(presenterReader, "Presenter edition reader must remain intact");
  assert.match(presenterReader, /order=published_at\.desc,id\.desc&limit=24/);
  assert.match(publication, /async function getDailyBriefArchive/);
  assert.match(publication, /const EDITION_ARCHIVE_PAGE_SIZE = 250/);
});
