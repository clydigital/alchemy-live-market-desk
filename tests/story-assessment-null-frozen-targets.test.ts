import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261002163530_guard_story_assessment_null_frozen_targets.sql", import.meta.url),
  "utf8",
);

test("Story assessment apply tolerates JSON-null frozen Story targets", () => {
  assert.match(
    migration,
    /jsonb_array_elements\(case[\s\S]*jsonb_typeof\(run\.metadata #> '\{frozenInputs,storyReviewTargets\}'\) = 'array'[\s\S]*else '\[\]'::jsonb[\s\S]*end\) target/,
  );
  assert.doesNotMatch(
    migration,
    /jsonb_array_elements\(coalesce\(run\.metadata #> '\{frozenInputs,storyReviewTargets\}', '\[\]'::jsonb\)\)/,
  );
});

test("null-target fallback changes only review-context lookup", () => {
  assert.match(migration, /select target -> 'reviewContext'/);
  assert.match(migration, /where run\.id = assessment\.engine_run_id/);
  assert.match(migration, /target -> 'story' ->> 'id' = assessment\.story_id::text/);
  assert.match(migration, /review_context := coalesce\(review_context, '\{\}'::jsonb\)/);
});
