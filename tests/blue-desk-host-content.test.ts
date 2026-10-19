import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blueDeskPublicHref, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

test("Bluebelly homepage and calendar use clean public URLs", () => {
  assert.equal(blueDeskPublicHref("/blue-desk", "bluebelly-desk.vercel.app"), "/");
  assert.equal(
    blueDeskPublicHref("/blue-desk/calendar?window=30d", "bluebelly-desk.vercel.app"),
    "/calendar?window=30d",
  );
  assert.equal(
    blueDeskPublicHref("/blue-desk/stories/article%3A123?edition=abc", "bluebelly-desk.vercel.app"),
    "/stories/article%3A123?edition=abc",
  );
});

test("Legacy domain, third-party hosts and internal routes are unchanged", () => {
  for (const host of [
    "alchemy-live-market-desk.vercel.app",
    "alchemy-blue-desk.vercel.app",
    "attacker.vercel.app",
  ]) {
    assert.equal(blueDeskPublicHref("/blue-desk", host), "/blue-desk");
    assert.equal(blueDeskPublicHref("/blue-desk/calendar", host), "/blue-desk/calendar");
  }
  assert.equal(blueDeskPublicHref("/api/presenter-calendar", "bluebelly-desk.vercel.app"), "/api/presenter-calendar");
  assert.equal(blueDeskPublicHref("//evil.invalid", "bluebelly-desk.vercel.app"), "//evil.invalid");
});

test("Bluebelly middleware owns precise clean-root rewrites without touching APIs", () => {
  assert.equal(blueDeskPresentationTarget("/", "bluebelly-desk.vercel.app"), "/blue-desk");
  assert.equal(blueDeskPresentationTarget("/calendar", "bluebelly-desk.vercel.app"), "/blue-desk/calendar");
  assert.equal(
    blueDeskPresentationTarget("/stories/article%3Aedition%3Astory", "bluebelly-desk.vercel.app"),
    "/blue-desk/stories/article%3Aedition%3Astory",
  );
  for (const path of ["/api/presenter-calendar", "/api/cron/research/morning", "/auth/callback", "/markets", "/hybrid-output/prepare", "/stories", "/"]) {
    if (path === "/") {
      assert.equal(blueDeskPresentationTarget(path, "alchemy-live-market-desk.vercel.app"), null);
    } else {
      assert.equal(blueDeskPresentationTarget(path, "bluebelly-desk.vercel.app"), null);
    }
  }
  assert.equal(blueDeskPresentationTarget("/calendar", "alchemy-blue-desk.vercel.app"), null);
  assert.equal(blueDeskPresentationTarget("/blue-desk", "bluebelly-desk.vercel.app"), null);
});

test("Presentation rewrites are gated by the existing auth middleware", () => {
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const authGate = middleware.indexOf("getClaims()");
  const authorisedRewrite = middleware.lastIndexOf("const rewritten = presentationResponse(request)");
  assert.ok(authGate >= 0 && authorisedRewrite > authGate);
  assert.match(middleware, /if \(!dashboardAuthRequired\(\)\) return presentationResponse\(request\)/);
  assert.match(middleware, /return copyCookies\(supabaseResponse, rewritten\)/);
});

test("Story detail is pinned to exact edition, with no latest-edition fallback", () => {
  const detail = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /snapshots\.find\(snapshot => snapshot\.id === edition\)/);
  assert.match(detail, /if \(!frozen\) notFound\(\)/);
  assert.match(detail, /item\.articleId === articleId && item\.editionId === edition/);
  assert.match(detail, /httpsSource\(source\.url\)/);
  assert.match(detail, /getHybridPresenterEditionCandidates\(\)/);
  assert.equal(detail.includes("getHybridPresenterEditionCandidates({ fresh: true })"), false);
});
