import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LIVE_DESK_PRESENTATION_HOST, blueDeskHostAccess, blueDeskPublicHref, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

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
    "alchemy-live-market-desk-rogue-magazine.vercel.app",
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
      assert.equal(blueDeskPresentationTarget(path, "alchemy-live-market-desk-rogue-magazine.vercel.app"), null);
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
  assert.match(middleware, /accessScope === "public"/);
  assert.match(middleware, /return copyCookies\(supabaseResponse, rewritten\)/);
});

test("Story detail fetches exact immutable edition independent of recent picker", () => {
  const detail = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
  assert.match(detail, /getHybridExactDailyBriefEdition\(edition\)/);
  assert.match(detail, /if \(!frozen\) notFound\(\)/);
  assert.match(detail, /item\.articleId === normalizedArticleId && item\.editionId === edition/);
  assert.match(detail, /httpsSource\(source\.url\)/);
  assert.match(detail, /decodeURIComponent\(articleId\)/);
  assert.doesNotMatch(detail, /getHybridPresenterEditionCandidates/);
  assert.match(publication, /export async function getHybridExactDailyBriefEdition/);
  assert.match(publication, /&id=eq\.\$\{editionId\}&limit=1/);
  assert.match(publication, /\{ fresh: true \}/);
  assert.match(publication, /return rows\[0\]\?\.id === editionId \? rows\[0\] : null/);
});

test("Bluebelly exposes only explicitly approved public reading routes", () => {
  const host = "bluebelly-desk.vercel.app";
  for (const path of [
    "/", "/calendar", "/blue-desk", "/blue-desk/calendar",
    "/stories/article%3Afcea17ef-f575-4283-a363-7d5fa9c918c7%3A6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e",
  ]) {
    assert.equal(blueDeskHostAccess(path, host), "public", path);
  }
  for (const path of [
    "/hybrid-output/prepare", "/dossier", "/markets", "/articles",
    "/api/dossier-v2", "/api/presenter/technical-checks", "/api/cron/research/morning",
    "/auth/callback", "/login", "/stories",
    "/stories/article%3Agarbage", "/stories/article%2F../../dossier",
  ]) {
    assert.equal(blueDeskHostAccess(path, host), "blocked", path);
  }
});

test("Other aliases never gain access to the Bluebelly public allowlist", () => {
  assert.equal(blueDeskHostAccess("/", "alchemy-blue-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/dossier", "alchemy-blue-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/dossier", "alchemy-live-market-desk.vercel.app"), "private");
  assert.equal(blueDeskHostAccess("/hybrid-output/prepare", "preview-abcd.vercel.app"), "private");
});

test("Non-public pages require owner auth even with missing dashboard flag", () => {
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const pageGuard = middleware.indexOf("getClaims()");
  const publicBranch = middleware.indexOf('if (accessScope === "public")');
  assert.ok(publicBranch >= 0 && pageGuard > publicBranch);
  assert.doesNotMatch(middleware, /if (!dashboardAuthRequired()) return presentationResponse(request)/);
  assert.ok(middleware.includes('pathname.startsWith("/api/cron/")'));
  assert.ok(middleware.includes("startsWithAny(pathname, MACHINE_AUTH_PATHS)"));
  assert.match(middleware, /Cache-Control": "private, no-store"/);
  const login = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /Continue with Google/);
  assert.doesNotMatch(login, /login system is installed but not enforced/);
});

test("canonical Live hostname opens only published Blue Desk reading routes anonymously", () => {
  const host = LIVE_DESK_PRESENTATION_HOST;
  const article = "/stories/article%3Afcea17ef-f575-4283-a363-7d5fa9c918c7%3A6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
  for (const pathname of ["/", "/blue-desk", "/calendar", "/blue-desk/calendar", article]) {
    assert.equal(blueDeskHostAccess(pathname, host), "public", pathname);
  }
  assert.equal(blueDeskPresentationTarget("/", host), "/blue-desk");
  assert.equal(blueDeskPresentationTarget("/calendar", host), "/blue-desk/calendar");
  assert.equal(blueDeskPresentationTarget(article, host), "/blue-desk" + article);
  assert.equal(blueDeskPublicHref("/blue-desk", host), "/");
  assert.equal(blueDeskPublicHref("/blue-desk/calendar", host), "/calendar");

  for (const pathname of [
    "/owner/live", "/dossier", "/hybrid-output/prepare", "/presenter/technical-checks",
    "/markets", "/articles", "/whats-new", "/api/presenter/technical-checks",
    "/api/research-update", "/api/cron/research/morning", "/auth/callback",
  ]) {
    assert.equal(blueDeskHostAccess(pathname, host), "private", pathname);
    assert.equal(blueDeskPresentationTarget(pathname, host), null, pathname);
  }
  assert.equal(blueDeskHostAccess("/owner/live", "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/", "preview.example.vercel.app"), "private");
});

test("legacy Live overview moves to an owner-only page and root tab bookmarks retain it", () => {
  const route = readFileSync(new URL("../app/owner/live/page.tsx", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(route, /export \\{ default \\} from "\\.\\.\\/\\.\\.\\/page"/);
  assert.ok(middleware.indexOf('oldLive.pathname = "/owner/live"') < middleware.indexOf('if (accessScope === "public")'));
  assert.ok(middleware.includes('request.nextUrl.searchParams.has("tab")'));
  assert.ok(middleware.indexOf('if (accessScope === "public")') < middleware.indexOf("getClaims()"));
  assert.ok(middleware.includes('pathname.startsWith("/api/cron/")'));
});
