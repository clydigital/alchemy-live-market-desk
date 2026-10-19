import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20261019222435_blue_desk_legacy_public_tables_read_only_20261020.sql", import.meta.url), "utf8");

test("legacy public readers lose visitor write grants without hiding Hybrid data", () => {
  for (const name of ["evidence", "research_source_registry", "research_schedule_slots"]) {
    assert.match(migration, new RegExp("public\\." + name));
  }
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER/);
  assert.match(migration, /FROM anon, authenticated/);
  assert.doesNotMatch(migration, /REVOKE[^;]*SELECT|DROP POLICY|DISABLE ROW LEVEL SECURITY|GRANT\s+(?:INSERT|UPDATE|DELETE)/i);
  assert.doesNotMatch(migration, /(?:TRUNCATE|DELETE FROM|UPDATE)\s+public\.(?:evidence|research_source_registry|research_schedule_slots)/i);
});

test("canonical private intelligence evidence is not reclassified public", () => {
  assert.doesNotMatch(migration, /public\.intelligence_evidence\b/);
  assert.doesNotMatch(migration, /public\.story_thesis_versions\b/);
});
