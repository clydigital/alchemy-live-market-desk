import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20261019224156_postgres_public_future_tables_sequences_opt_in_20261020.sql", import.meta.url), "utf8");

test("future postgres-owned public tables and sequences are opt-in for client roles", () => {
  assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated/);
  assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated/);
  assert.doesNotMatch(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin/);
  assert.doesNotMatch(migration, /ON FUNCTIONS|FROM PUBLIC|TO service_role/);
  assert.doesNotMatch(migration, /REVOKE .* ON ALL TABLES IN SCHEMA|REVOKE .* ON TABLE public\./);
});

test("migration does not mutate RLS, canonical Story records, or existing grants", () => {
  assert.doesNotMatch(migration, /ALTER TABLE|DROP POLICY|UPDATE public|DELETE FROM public|TRUNCATE/);
  assert.match(migration, /BEGIN;/);
  assert.match(migration, /COMMIT;/);
});
