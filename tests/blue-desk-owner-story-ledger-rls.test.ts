import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20261019220537_blue_desk_owner_only_story_ledger_20261020.sql", import.meta.url), "utf8");
const pub = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
const feed = readFileSync(new URL("../lib/intelligence/publication-feed-data.ts", import.meta.url), "utf8");

test("raw canonical Story ledgers have no anonymous read grant or true-for-all policy", () => {
  for (const table of ["story_events", "story_thesis_versions"]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`DROP POLICY IF EXISTS public_read_${table}`));
    assert.match(sql, new RegExp(`REVOKE ALL PRIVILEGES ON TABLE public\\.${table} FROM anon, authenticated`));
    assert.match(sql, new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO authenticated`));
    assert.match(sql, new RegExp(`CREATE POLICY approved_presenter_read_${table}`));
  }
  assert.equal((sql.match(/FOR SELECT TO authenticated/g)||[]).length, 2);
  assert.equal((sql.match(/allowlist\.active = true/g)||[]).length, 2);
  assert.equal((sql.match(/SELECT auth\.uid\(\)/g)||[]).length, 2);
  assert.equal((sql.match(/auth\.jwt\(\)/g)||[]).length, 2);
  assert.doesNotMatch(sql, /GRANT SELECT[^;]*TO anon|FOR SELECT TO public|USING \(true\)/i);
});

test("all publication compatibility callers use privileged server read for raw history", () => {
  for (const file of [pub, feed]) {
    assert.match(file, /\["hybrid_publication_snapshots", "story_events", "story_thesis_versions"\]\.includes\(table\)/);
    assert.match(file, /Authorization: `Bearer \$\{credential\}`/);
  }
});
