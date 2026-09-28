import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260928065000_story_catalyst_expiry_recalibration.sql"),
  "utf8",
);

test("expired catalyst migration is operational housekeeping, not thesis mutation", () => {
  assert.match(migration, /current_catalyst_expired boolean := false/);
  assert.match(migration, /review_context ->> 'catalystRecalibrationRequired'/);
  assert.match(migration, /review_context -> 'expiredCatalysts'/);
  assert.match(migration, /new_next_catalyst := null/);
  assert.match(migration, /operational_refresh_allowed := true/);
  assert.match(migration, /material_change_applied=\(material_allowed and story_changed\)/);
});

test("valid future replacement wins over expired-catalyst clearing", () => {
  assert.match(migration, /proposal_next_label is not null and candidate_valid/);
  assert.match(migration, /current_catalyst_due or current_catalyst_expired/);
  assert.match(migration, /story_maintenance_next_test_for_candidate/);
});

test("clearing an expired catalyst preserves an immutable expired nextTest marker", () => {
  assert.match(migration, /'status', 'expired'/);
  assert.match(migration, /expired_next_test/);
  assert.match(migration, /jsonb_build_object\('nextTest', expired_next_test\)/);
  assert.match(migration, /story_maintenance_reasoning_for_version/);
});

test("migration cannot accept an arbitrary model catalyst outside frozen candidates", () => {
  assert.match(migration, /story_maintenance_catalyst_candidate_is_valid/);
  assert.match(migration, /candidate_valid/);
});
