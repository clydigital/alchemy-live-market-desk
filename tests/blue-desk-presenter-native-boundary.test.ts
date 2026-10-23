import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Blue Desk Presenter is private on all public hosts and uses the existing owner gate", () => {
  const nav = read("components/blue-desk/BlueDeskHeader.tsx");
  const middleware = read("middleware.ts");
  assert.match(nav, /\["Presenter Prep", "\/blue-desk\/presenter"\]/);
  const publicNav = nav.slice(nav.indexOf("const PUBLIC_NAV"), nav.indexOf("const NAV_ICONS"));
  assert.match(publicNav, /\["Presenter Prep", "\/presenter"\]/);
  assert.doesNotMatch(publicNav, /\["Presenter Prep", "\/blue-desk\/presenter"\]/);
  assert.equal(blueDeskHostAccess("/presenter", "bluebelly-desk.vercel.app"), "private");
  assert.equal(blueDeskHostAccess("/blue-desk/presenter", "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/blue-desk/presenter", "alchemy-live-market-desk.vercel.app"), "private");
  assert.equal(blueDeskHostAccess("/blue-desk/presenter", "private-preview.vercel.app"), "private");
  const v6Host = "bluebelly-v6-review.vercel.app";
  assert.equal(blueDeskHostAccess("/", v6Host), "public");
  assert.equal(blueDeskHostAccess("/learn", v6Host), "public");
  assert.equal(blueDeskHostAccess("/key-stories", v6Host), "public");
  assert.equal(blueDeskHostAccess("/presenter", v6Host), "private");
  assert.equal(blueDeskHostAccess("/blue-desk/presenter", v6Host), "blocked");
  assert.equal(blueDeskHostAccess("/api/presenter/technical-checks", v6Host), "private");
  assert.equal(blueDeskHostAccess("/api/internal-research", v6Host), "blocked");
  assert.equal(blueDeskHostAccess("/auth/google", v6Host), "public");
  assert.match(middleware, /isBluebellyReaderHost\(host\)/);
  assert.match(middleware, /supabase\.auth\.getClaims\(\)/);
  assert.match(middleware, /app_access_allowlist/);
});

test("native Presenter shell reuses the existing technical-checks/3 authority", () => {
  const page = read("app/blue-desk/presenter/page.tsx");
  const check = read("components/live-desk/PresenterTechnicalChecks.tsx");
  assert.match(page, /<BlueDeskHeader activePath="\/blue-desk\/presenter" \/>/);
  assert.match(page, /<PresenterTechnicalChecks compact \/>/);
  assert.match(check, /technical-checks\/3/);
  assert.match(check, /\/api\/presenter\/technical-checks/);
  assert.match(check, /dxy-4h/);
  assert.match(check, /us02y-30y/);
  assert.doesNotMatch(page, /createStory|updateStory|new reasoning engine|service_role/);
});

test("native presenter forwards exact edition references, never silently substitutes latest", () => {
  const page = read("app/blue-desk/presenter/page.tsx");
  const full = read("app/blue-desk/presenter/full-prep/page.tsx");
  const host = read("lib/blue-desk-host.ts");
  assert.match(page, /editionPinnedPrepHref\(query\)/);
  assert.match(page, /EXACT_UUID\.test\(value\)\) notFound\(\)/);
  assert.match(page, /typeof value !== "string"/);
  assert.match(page, /params\.set\(key, value\)/);
  assert.match(page, /"\/presenter\/full-prep"/);
  assert.doesNotMatch(page, /\/hybrid-output/);
  assert.match(host, /if \(pathname === "\/presenter\/full-prep"\) return "\/blue-desk\/presenter\/full-prep"/);
  assert.match(host, /if \(pathname === "\/presenter\/technical-checks" && isBluebellyReaderHost\(host\)\) return "\/blue-desk\/presenter\/technical-checks"/);
  assert.match(full, /resolvePresenterPrepExactSelection\(/);
  assert.match(full, /getHybridExactDailyBriefEdition\(requested\)/);
  assert.match(full, /getHybridDirectDailyBriefSuperseders\(requested\)/);
  assert.match(read("app/blue-desk/presenter/technical-checks/page.tsx"), /<PresenterTechnicalChecks\/>/);
  assert.match(full, /<PresenterPrepSession/);
});
