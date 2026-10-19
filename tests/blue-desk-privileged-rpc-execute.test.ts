import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20261019224500_restrict_security_definer_rpc_execute.sql", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/intelligence/supabase.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

test("public and authenticated roles cannot execute the three SECURITY DEFINER functions", () => {
  for (const f of [
    "public.claim_intelligence_stage(uuid,text,uuid,jsonb,integer)",
    "public.refresh_research_debt()",
    "public.rls_auto_enable()",
  ]) assert.ok(migration.includes(f), f);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION[\s\S]+?FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]+?TO service_role/);
  assert.doesNotMatch(migration, /DROP FUNCTION|ALTER FUNCTION|CREATE OR REPLACE FUNCTION|DROP EVENT TRIGGER/i);
});

test("intelligence-stage RPC is called only through server-only service credentials", () => {
  assert.match(client, /import "server-only"/);
  assert.match(client, /const serviceKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(client, /Authorization: `Bearer \$\{serviceKey\}`/);
  assert.match(runtime, /"rpc\/claim_intelligence_stage"/);
});
