import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
const feed = readFileSync(new URL("../lib/intelligence/publication-feed-data.ts", import.meta.url), "utf8");

test("immutable raw publication archive is read with a server-only credential", () => {
  assert.match(publication, /const serverKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(publication, /\["hybrid_publication_snapshots", "story_events", "story_thesis_versions"\]\.includes\(table\) \? serverKey : key/);
  assert.match(publication, /if \(!url \|\| !credential\) return \[\]/);
  assert.match(publication, /Authorization: `Bearer \$\{credential\}`/);
  assert.match(feed, /\["hybrid_publication_snapshots", "story_events", "story_thesis_versions"\]\.includes\(table\) \? serviceKey : key/);
  assert.match(feed, /if \(!url \|\| !credential\) return \[\]/);
  assert.match(feed, /Authorization: `Bearer \$\{credential\}`/);
});

test("legacy unrelated public feed tables keep their original read contracts", () => {
  assert.match(publication, /\? serverKey : key/);
  assert.match(feed, /\? serviceKey : key/);
  assert.match(feed, /query<Story>\("stories"/);
  assert.match(publication, /getHybridExactDailyBriefEdition\(editionId: string\)/);
  assert.match(publication, /snapshot_type=eq\.daily_brief&id=eq\.\$\{editionId\}&limit=1/);
});
