import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20261005070000_dossier_live_regime_integration.sql", import.meta.url), "utf8");

test("dossier integration extends the existing Regime taxonomy without a second persistence store", () => {
  assert.match(migration, /'private-capital','Private AI Capital'/);
  assert.match(migration, /'control-governance','AI Control \/ Governance'/);
  assert.match(migration, /on conflict\(regime_id,subgroup_key\) do update/);
  assert.doesNotMatch(migration, /create table/i);
});

test("dossier-derived Story identities remain unverified until canonical evidence arrives", () => {
  for (const slug of ["ai-control-risk","private-ai-capital","global-credit-transmission","global-sovereign-stress"]) assert.match(migration, new RegExp(slug));
  assert.match(migration, /theme_seed_unverified/);
  assert.match(migration, /verificationState','unverified'/);
  assert.match(migration, /No canonical evidence or fact claim is attached/);
});
