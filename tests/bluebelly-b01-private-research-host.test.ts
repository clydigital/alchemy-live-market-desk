import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const bluebelly = "bluebelly-desk.vercel.app";
const ownerReviewPaths = [
  "/owner/daily-report",
  "/api/owner/macropulse-briefs",
  "/api/owner/daily-research",
] as const;

test("Branch 01 allows only three exact owner research paths as private, never public", () => {
  for (const path of ownerReviewPaths) {
    assert.equal(blueDeskHostAccess(path, bluebelly), "private", path);
    assert.equal(blueDeskPresentationTarget(path, bluebelly), null, path);
    assert.equal(blueDeskHostAccess(path + "/", bluebelly), "blocked", path + "/");
    assert.equal(blueDeskHostAccess(path + "/any", bluebelly), "blocked", path + "/any");
    assert.equal(blueDeskHostAccess(path, "alchemy-blue-desk.vercel.app"), "blocked");
    assert.notEqual(blueDeskHostAccess(path, "preview-unauthorised.vercel.app"), "public");
  }

  for (const path of [
    "/api/owner/editorial-publish", "/api/internal/canonical-feed",
    "/api/dossier-v2", "/api/hybrid-feed-v2", "/api/cron/research/morning",
    "/owner/publications", "/owner/research", "/owner/x-wire",
  ]) {
    assert.equal(blueDeskHostAccess(path, bluebelly), "blocked", path);
  }
});

test("the two private research APIs cannot use legacy unauthenticated API bypass", () => {
  const mw = read("middleware.ts");
  assert.match(mw, /pathname === "\/api\/owner\/macropulse-briefs"/);
  assert.match(mw, /pathname === "\/api\/owner\/daily-research"/);
  assert.match(mw, /!dashboardAuthRequired\(\) && !ownerReviewApi/);
  assert.ok(mw.indexOf('if (accessScope === "blocked")') <
    mw.indexOf('if (accessScope === "public")'));
  assert.ok(mw.indexOf("getClaims()") < mw.indexOf('"app_access_allowlist"'));
  assert.match(mw, /Cache-Control", "private, no-store"/);

  const sources = [
    read("app/api/owner/macropulse-briefs/route.ts"),
    read("app/api/owner/daily-research/route.ts"),
  ];
  for (const route of sources) {
    assert.match(route, /blueDeskHostAccess/);
    assert.match(route, /auth\.getUser\(\)/);
    assert.match(route, /app_access_allowlist/);
    assert.match(route, /eq\("active",\s*true\)/);
    assert.match(route, /401/);
    assert.match(route, /403/);
    assert.match(route, /private, no-store/);
    assert.doesNotMatch(route, /getCanonicalPublicationPayload|\.upsert\(|\.insert\(/);
  }
});

test("the studio is a private owner page, not a public redirect or report publisher", () => {
  const page = read("app/owner/daily-report/page.tsx");
  assert.match(page, /data-private-daily-report="owner-only"/);
  assert.match(page, /<MacroPulseBriefQueue\/>/);
  assert.match(page, /<DailyReportWriter\/>/);
  assert.match(page, /<OwnerAutomaticReportReader\/>/);
  assert.doesNotMatch(page, /redirect\(|getCanonicalPublicationPayload|\/hybrid-output/);
});
