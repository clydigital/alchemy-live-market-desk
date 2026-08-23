import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "migrations",
    "20260824065000_canonical_story_publication_linkage_v1.sql",
  ),
  "utf8",
);
const sqlContract = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "tests",
    "canonical_story_publication_linkage_v1.sql",
  ),
  "utf8",
);

test("PR3A freezes Story publications to the authoritative current thesis version", () => {
  assert.match(migration, /if new\.snapshot_type <> 'story' then[\s\S]*return new/);
  assert.match(migration, /select story\.current_thesis_version_id[\s\S]*into current_version_id/);
  assert.match(migration, /new\.story_thesis_version_id := current_version_id/);
  assert.match(migration, /state_version_id is distinct from current_version_id/);
  assert.match(migration, /new\.story_thesis_version_id is distinct from current_version_id/);
  assert.match(migration, /version\.id = current_version_id[\s\S]*version\.story_id = new\.story_id/);
});

test("PR3A materialises V1 from the exact immutable version and lets direct columns win", () => {
  assert.match(migration, /materialise_story_reasoning_for_publication_v1/);
  assert.match(migration, /reasoning ->> 'contractVersion' <> 'canonical-story-reasoning\/v1'/);
  assert.match(migration, /return reasoning \|\| jsonb_build_object/);
  for (const projection of [
    "storyId",
    "storyVersionId",
    "versionNumber",
    "effectiveAt",
    "title",
    "centralQuestion",
    "lifecycle",
    "confidence",
    "thesis",
  ]) {
    assert.match(migration, new RegExp(`'${projection}'`));
  }
  assert.match(migration, /'storyVersionId', version_row\.id::text/);
});

test("PR3A persists the exact version projection and materialised reasoning in the append-only payload", () => {
  assert.match(migration, /\{canonicalStoryState,thesisVersion\}/);
  assert.match(migration, /\{canonicalStoryReasoning\}/);
  assert.match(migration, /coalesce\(materialised_reasoning, 'null'::jsonb\)/);
  assert.match(migration, /before insert on public\.hybrid_publication_snapshots/);
  assert.doesNotMatch(migration, /update public\.hybrid_publication_snapshots/i);
  assert.doesNotMatch(migration, /delete from public\.hybrid_publication_snapshots/i);
});

test("PR3A executable SQL contract covers V1, legacy, stale-version rejection and replay immutability", () => {
  for (const phrase of [
    "V1 Story snapshot did not freeze exact current thesis version",
    "Materialised V1 storyVersionId does not match snapshot FK",
    "Empty V1 visual plan must remain exactly empty",
    "Historical Story publication changed after current Story advanced",
    "Stale/non-current Story thesis version must be rejected",
    "Legacy Story snapshot did not freeze exact immutable thesis version",
    "Legacy/core-only Story publication must not manufacture V1 reasoning",
  ]) {
    assert.match(sqlContract, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(sqlContract, /^begin;/m);
  assert.match(sqlContract, /^rollback;/m);
});

test("PR3A does not pretend to implement visual-plan authoring", () => {
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /story_synthesis/i);
  assert.doesNotMatch(migration, /seriesId|entityId|edgeIds|claimIds/);
});
