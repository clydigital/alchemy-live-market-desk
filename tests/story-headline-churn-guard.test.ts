import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261006163500_story_headline_churn_guard.sql"),
  "utf8",
);
const sqlContract = fs.readFileSync(
  path.join(root, "supabase", "tests", "story_headline_churn_guard.sql"),
  "utf8",
);

test("Story headline changes require a material immutable thesis-version change", () => {
  assert.match(migration, /Story headline change requires a material thesis-version change/);
  assert.match(migration, /story_headline_material_signature_v1/);
  assert.match(migration, /before insert on public\.story_thesis_versions/);
  assert.match(migration, /new\.title is not distinct from prior\.title/);
  assert.match(migration, /next_signature is not distinct from prior_signature/);
  assert.match(sqlContract, /Headline-only thesis version unexpectedly succeeded/);
  assert.match(sqlContract, /when check_violation then/);
});

test("authorised headline changes stay on the existing immutable Story version path", () => {
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /insert into public\.stories/i);
  assert.match(migration, /'contractVersion', 'story-headline-change\/v1'/);
  assert.match(migration, /'priorHeadline', prior\.title/);
  assert.match(migration, /'newHeadline', new\.title/);
  assert.match(migration, /'reason', headline_reason/);
  assert.match(migration, /'authorizingStoryThesisVersionId', new\.id/);
  assert.match(migration, /'priorStoryThesisVersionId', prior\.id/);
  assert.match(sqlContract, /headline_hygiene_contract_test/);
});

test("headline materiality follows the documented Story semantic fields", () => {
  for (const field of [
    "thesis",
    "marketQuestion",
    "acceptedExplanation",
    "dominantNarrative",
    "lifecycle",
    "currentState",
    "causalChain",
    "confirmation",
    "invalidation",
    "nextTest",
  ]) {
    assert.match(migration, new RegExp("'" + field + "'"));
  }

  assert.doesNotMatch(
    migration.match(/jsonb_build_object\([\s\S]*?\);\n\$\$;/)?.[0] ?? "",
    /'confidence'/,
  );
});
