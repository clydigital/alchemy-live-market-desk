import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20261019224607_restrict_research_definer_views_20261020.sql", import.meta.url), "utf8");

test("internal research views invoke RLS as caller and deny visitor SELECT", () => {
  for (const name of ["research_story_completeness", "research_debt_queue"]) {
    assert.match(sql, new RegExp("ALTER VIEW public\\." + name + " SET \\(security_invoker = true\\)"));
  }
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]+?FROM anon, authenticated/);
  assert.match(sql, /GRANT SELECT ON TABLE[\s\S]+?TO service_role/);
  assert.doesNotMatch(sql, /ALTER TABLE|DROP POLICY|CREATE POLICY|UPDATE public|DELETE FROM public/i);
});
