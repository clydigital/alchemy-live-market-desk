import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261008061500_canonical_story_evidence_coverage.sql", import.meta.url),
  "utf8",
);

test("Story evidence coverage projects the canonical intelligence evidence layer", () => {
  assert.match(migration, /public\.intelligence_story_evidence/);
  assert.match(migration, /public\.intelligence_evidence\b/);
  assert.match(migration, /public\.intelligence_evidence_sources/);
  assert.match(migration, /source\.source_tier = 1/);
  assert.match(migration, /link\.evidence_role in \('contradicting', 'invalidation'\)/);
  assert.match(migration, /public\.research_debt/);
  assert.match(migration, /public\.story_thesis_versions/);
  assert.match(migration, /canonical-story-reasoning\/v1/);
  assert.match(migration, /reasoning,nextTest,label/);
  assert.match(migration, /public\.story_events/);
  assert.match(migration, /with \(security_invoker = true\)/);

  assert.doesNotMatch(migration, /from public\.sources\b/);
  assert.doesNotMatch(migration, /from public\.evidence\b/);
  assert.doesNotMatch(migration, /from public\.story_updates\b/);
});

test("canonical projection keeps the existing eight-point evidence-room policy unchanged", () => {
  for (const condition of [
    "source_count >= 3",
    "tier1_source_count >= 1",
    "evidence_count >= 6",
    "linked_evidence_count >= 4",
    "contradiction_count >= 1",
    "unresolved_count >= 1",
    "chart_count >= 2",
    "update_count >= 1",
  ]) {
    assert.ok(migration.includes(condition), `Missing gate condition: ${condition}`);
  }
  assert.match(migration, /\) >= 6[\s\S]*then 'close'::text/);
  assert.match(migration, /then 'ready'::text/);
});
