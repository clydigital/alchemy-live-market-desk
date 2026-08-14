import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const repairMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260814123000_repair_intelligence_engine_run_run_key_contract.sql",
);
const contractPath = path.join(repoRoot, "supabase", "tests", "market_intelligence_contract.sql");

test("forward repair migration backfills run_key and installs a unique constraint", () => {
  const migration = readFileSync(repairMigrationPath, "utf8");

  assert.match(migration, /add column if not exists run_key text/i);
  assert.match(migration, /set run_key = 'legacy:' \|\| id::text/i);
  assert.match(migration, /:legacy-duplicate:/i);
  assert.match(migration, /alter column run_key set not null/i);
  assert.match(migration, /add constraint intelligence_engine_runs_run_key_unique unique \(run_key\)/i);
});

test("market intelligence contract verifies the run_key conflict contract", () => {
  const contract = readFileSync(contractPath, "utf8");

  assert.match(contract, /column_name = 'run_key'/);
  assert.match(contract, /is_nullable = 'NO'/);
  assert.match(contract, /constraint_row\.contype = 'u'/);
  assert.match(contract, /attribute_row\.attname = 'run_key'/);
  assert.match(contract, /usable by on_conflict=run_key/);
});
