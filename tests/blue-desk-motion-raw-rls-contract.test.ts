import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20261019221108_blue_desk_owner_only_raw_motion_20261020.sql", import.meta.url), "utf8");
const motion = readFileSync(new URL("../lib/market-motion.ts", import.meta.url), "utf8");
const published = readFileSync(new URL("../lib/market-motion-edition.ts", import.meta.url), "utf8");

test("raw Motion and invoker view prohibit anonymous SELECT", () => {
  assert.match(migration, /DROP POLICY IF EXISTS public_read_market_motion_items/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.market_motion_items FROM anon, authenticated/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.current_market_motion_items FROM anon, authenticated/);
  assert.match(migration, /ALTER VIEW public\.current_market_motion_items SET \(security_invoker = true\)/);
  assert.match(migration, /FOR SELECT TO authenticated/);
  assert.match(migration, /app_access_allowlist/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /auth\.jwt\(\)/);
  assert.doesNotMatch(migration, /GRANT SELECT[^;]*TO anon|USING \(true\)/i);
});

test("published Motion consumers remain on server-only admin adapter", () => {
  assert.match(motion, /createSupabaseAdminClient/);
  assert.match(published, /createSupabaseAdminClient/);
  assert.doesNotMatch(published, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});
