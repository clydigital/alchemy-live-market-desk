import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const page = readFileSync("app/power-stack/page.tsx", "utf8");
test("bond watch remains behind private Google identity and owner-scoped RLS", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /app_access_allowlist/);
  assert.match(page, /\.eq\("owner_user_id", identity\.user\.id\)/);
  assert.match(page, /power_stack_idea_tracker/);
  assert.match(page, /data-power-stack-bond-watch="owner-research"/);
});
test("bond watch and quote ledger are collapsible instead of heavy default tables", () => {
  assert.match(page, /data-power-stack-quote-ledger="collapsed"/);
  assert.match(page, /data-power-stack-bond-details="collapsed"/);
  assert.match(page, /bondWatch\.map\(asset/);
});
test("source dates, currencies and one-off research remain distinct from a live quote", () => {
  assert.match(page, /quote\.currency/);
  assert.match(page, /quote\.observed_on/);
  assert.match(page, /not streaming prices/);
  assert.match(page, /not a live executable quote/);
});
