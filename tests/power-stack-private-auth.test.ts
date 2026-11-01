import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Power Stack has exactly one protected owner route on Bluebelly", () => {
  const host = "bluebelly-desk.vercel.app";
  assert.equal(blueDeskHostAccess("/power-stack", host), "private");
  assert.equal(blueDeskPresentationTarget("/power-stack", host), null);
  for (const path of [
    "/power-stack/", "/power-stack/data", "/power-stack/api", "/api/owner/power-stack",
    "/blue-desk/power-stack", "/data/holdings-fundamentals.json",
  ]) assert.equal(blueDeskHostAccess(path, host), "blocked", path);
  assert.equal(blueDeskHostAccess("/markets", host), "public");
});

test("Power Stack reuses existing Google session and server-side owner allowlist", () => {
  const page = source("app/power-stack/page.tsx");
  const oauth = source("app/auth/google/route.ts");
  const login = source("app/login/page.tsx");
  const middleware = source("middleware.ts");
  assert.match(page, /createSupabaseServerClient/);
  assert.match(page, /auth\.getUser\(\)/);
  assert.match(page, /app_access_allowlist/);
  assert.match(page, /\.eq\("active", true\)/);
  assert.match(page, /redirect\("\/auth\/google\?next=%2Fpower-stack"\)/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /export const revalidate = 0/);
  assert.match(middleware, /getClaims\(\)/);
  assert.match(oauth, /auth\.getClaims\(\)/);
  assert.match(oauth, /return NextResponse\.redirect\(new URL\(next, requestUrl\.origin\)\)/);
  assert.doesNotMatch(oauth, /prompt:\s*["']select_account["']/);
  assert.match(login, /if \(approvedSession\) redirect\(next\)/);
});

test("No public Power Stack holdings fallback; private RLS and retirement gate required", () => {
  const page = source("app/power-stack/page.tsx");
  const sql = source("supabase/migrations/20261101091500_power_stack_owner_snapshots.sql");
  assert.match(page, /legacy_source_retired === true/);
  assert.match(page, /ready \? parseOwnerHoldings\(row\.snapshot\) : \[\]/);
  assert.match(page, /\.eq\("owner_user_id", identity\.user\.id\)/);
  assert.doesNotMatch(page, /clydigital\.github\.io|raw\.githubusercontent\.com|\/data\/holdings-fundamentals\.json/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.power_stack_owner_snapshots from anon, authenticated/);
  assert.match(sql, /for select to authenticated/);
  assert.match(sql, /owner_user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /legacy_source_retired boolean not null default false/);
});

test("Private Power Stack is in owner navigation only", () => {
  const header = source("components/blue-desk/BlueDeskHeader.tsx");
  const afterPrivate = header.split("const PRIVATE_NAV = ")[1].split("const PUBLIC_NAV = ")[0];
  const afterPublic = header.split("const PUBLIC_NAV = ")[1].split("const NAV_ICONS")[0];
  assert.match(afterPrivate, /\["Power Stack", "\/power-stack"\]/);
  assert.doesNotMatch(afterPublic, /Power Stack/);
  assert.match(header, /activePath === "\/power-stack"/);
});
