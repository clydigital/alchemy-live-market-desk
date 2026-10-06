import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const seedMigration = readFileSync(
  new URL("../supabase/migrations/20261005070000_dossier_live_regime_integration.sql", import.meta.url),
  "utf8",
);
const repairMigration = readFileSync(
  new URL("../supabase/migrations/20261006000059_repair_dossier_seed_story_version_pointers.sql", import.meta.url),
  "utf8",
);

test("Dossier seed pointer repair is narrowly bound to the exact immutable seed version", () => {
  assert.match(seedMigration, /snapshot,change_reason,effective_at\)[\s\S]*'dossier_live_integration_seed'/);
  assert.match(repairMigration, /story\.current_thesis_version_id is null/);
  assert.match(repairMigration, /version\.version_number = 1/);
  assert.match(repairMigration, /version\.snapshot ->> 'origin' = 'dossier_live_integration_seed'/);
  assert.match(repairMigration, /having count\(version\.id\) = 1/);
  assert.match(repairMigration, /count\(\*\) filter[\s\S]*= 1/);
  assert.doesNotMatch(repairMigration, /order by[\s\S]*limit 1/i);
});

test("Dossier seed pointer repair never rewrites an existing Story pointer", () => {
  assert.match(
    repairMigration,
    /update public\.stories story[\s\S]*set current_thesis_version_id = candidates\.version_id[\s\S]*story\.current_thesis_version_id is null/,
  );
  assert.doesNotMatch(repairMigration, /set\s+thesis\s*=|set\s+status\s*=|set\s+confidence\s*=/i);
  assert.doesNotMatch(repairMigration, /insert into public\.story_thesis_versions/i);
});

test("Dossier seed pointer repair fails closed if the pointer invariant is still broken", () => {
  assert.match(
    repairMigration,
    /left join public\.story_thesis_versions current_version[\s\S]*current_version\.id = story\.current_thesis_version_id/,
  );
  assert.match(repairMigration, /story\.current_thesis_version_id is null/);
  assert.match(repairMigration, /current_version\.story_id is distinct from story\.id/);
  assert.match(repairMigration, /raise exception 'Dossier Live seed Story thesis-version pointer repair is incomplete'/);
});
