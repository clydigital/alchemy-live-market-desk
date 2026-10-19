import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20261019212725_blue_desk_archive_owner_only_20261020.sql", import.meta.url), "utf8");
const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
const feed = readFileSync(new URL("../lib/intelligence/publication-feed-data.ts", import.meta.url), "utf8");

test("raw archive is denied to anonymous clients and remains RLS-enforced", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /DROP POLICY IF EXISTS public_read_hybrid_publication_snapshots/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.hybrid_publication_snapshots FROM anon, authenticated/);
  assert.doesNotMatch(migration, /GRANT SELECT[^;]* TO anon/);
  assert.match(migration, /FOR SELECT TO authenticated/);
  assert.match(migration, /app_access_allowlist/);
  assert.match(migration, /allowlist\.active = true/);
  assert.match(migration, /auth\.jwt\(\)/);
  assert.match(migration, /auth\.uid\(\)/);
});

test("both application archive readers are server-only before RLS hardening", () => {
  assert.match(publication, /\["hybrid_publication_snapshots", "story_events", "story_thesis_versions"\]\.includes\(table\) \? serverKey : key/);
  assert.match(feed, /\["hybrid_publication_snapshots", "story_events", "story_thesis_versions"\]\.includes\(table\) \? serviceKey : key/);
  assert.match(publication, /getHybridExactDailyBriefEdition\(editionId: string\)/);
});
