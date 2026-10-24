import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LIVE_DESK_PRESENTATION_HOST, blueDeskHostAccess, blueDeskPublicHref, blueDeskPresentationTarget, publicLiveLegacyTabDestination } from "../lib/blue-desk-host.ts";

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
  assert.equal(blueDeskPresentationTarget("/markets", "bluebelly-desk.vercel.app"), "/blue-desk/markets");
  assert.equal(
    blueDeskPresentationTarget("/stories/article%3Aedition%3Astory", "bluebelly-desk.vercel.app"),
    "/blue-desk/stories/article%3Aedition%3Astory",
  );
  for (const path of ["/api/presenter-calendar", "/api/cron/research/morning", "/auth/callback", "/hybrid-output/prepare", "/stories", "/"]) {
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
    "/", "/calendar", "/blue-desk", "/blue-desk/calendar", "/markets", "/blue-desk/markets",
    "/key-stories", "/blue-desk/key-stories", "/rates", "/blue-desk/rates",
    "/what-changed", "/blue-desk/what-changed",
    "/stories/article%3Afcea17ef-f575-4283-a363-7d5fa9c918c7%3A6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e",
  ]) {
    assert.equal(blueDeskHostAccess(path, host), "public", path);
  }
  for (const path of [
    "/hybrid-output/prepare", "/dossier", "/articles",
    "/api/dossier-v2", "/api/cron/research/morning", "/stories",
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
  for (const pathname of ["/", "/blue-desk", "/calendar", "/blue-desk/calendar", "/markets", "/blue-desk/markets", article]) {
    assert.equal(blueDeskHostAccess(pathname, host), "public", pathname);
  }
  assert.equal(blueDeskHostAccess("/owner/live", host), "public");
  assert.equal(blueDeskPresentationTarget("/owner/live", host), "/blue-desk");
  assert.equal(blueDeskPresentationTarget("/", host), "/blue-desk");
  assert.equal(blueDeskPresentationTarget("/calendar", host), "/blue-desk/calendar");
  assert.equal(blueDeskPresentationTarget("/markets", host), "/blue-desk/markets");
  assert.equal(blueDeskPresentationTarget(article, host), "/blue-desk" + article);
  assert.equal(blueDeskPublicHref("/blue-desk", host), "/");
  assert.equal(blueDeskPublicHref("/blue-desk/calendar", host), "/calendar");

  for (const pathname of [
    "/dossier", "/hybrid-output/prepare", "/presenter/technical-checks",
    "/articles", "/whats-new", "/api/presenter/technical-checks",
    "/api/research-update", "/api/cron/research/morning", "/auth/callback",
  ]) {
    assert.equal(blueDeskHostAccess(pathname, host), "private", pathname);
    assert.equal(blueDeskPresentationTarget(pathname, host), null, pathname);
  }
  assert.equal(blueDeskHostAccess("/owner/live", "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/", "preview.example.vercel.app"), "private");
});

test("legacy Live overview remains private on owner hosts but public Live bookmarks show a safe reading view", () => {
  const route = readFileSync(new URL("../app/owner/live/page.tsx", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.ok(route.includes('export { default } from "../../page"'));
  assert.ok(middleware.indexOf('publicLiveLegacyTabDestination(request.nextUrl.searchParams.get("tab"))') < middleware.indexOf('if (accessScope === "public")'));
  assert.ok(middleware.includes('request.nextUrl.searchParams.has("tab")'));
  assert.doesNotMatch(middleware, /oldLive.pathname = "\/owner\/live"/);
  assert.equal(blueDeskHostAccess("/owner/live", "preview-abcd.vercel.app"), "private");
  assert.equal(blueDeskHostAccess("/owner/live", "bluebelly-desk.vercel.app"), "blocked");
  assert.ok(middleware.indexOf('if (accessScope === "public")') < middleware.indexOf("getClaims()"));
  assert.ok(middleware.includes('pathname.startsWith("/api/cron/")'));
});


test("full Markets terminal is public only on the exact canonical Live URL", () => {
  const legacy = readFileSync(new URL("../app/owner/markets/page.tsx", import.meta.url), "utf8");
  const current = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");
  assert.match(legacy, /<MarketsMonitor monitor=\{monitor\} flows=\{flows\} \/>/);
  assert.doesNotMatch(legacy, /LiveDeskShell|createSupabaseAdminClient|service_role|mutation|use server/);
  assert.match(current, /getMarketMonitor\(\)/);
  assert.match(current, /publicMarketObservations\(monitor\?\.rows \|\| \[\], group\)/);
  for (const host of ["bluebelly-desk.vercel.app", LIVE_DESK_PRESENTATION_HOST]) {
    assert.equal(blueDeskHostAccess("/markets", host), "public");
    assert.equal(blueDeskPresentationTarget("/markets", host), "/blue-desk/markets");
    assert.equal(blueDeskHostAccess("/owner/markets", host),
      host === LIVE_DESK_PRESENTATION_HOST ? "public" : "blocked");
    assert.equal(blueDeskHostAccess("/api/research-update", host),
      host === LIVE_DESK_PRESENTATION_HOST ? "private" : "blocked");
  }
});

test("full Markets public exception never leaks to owner siblings, APIs or preview origins", () => {
  const full = "/owner/markets";
  const live = LIVE_DESK_PRESENTATION_HOST;
  assert.equal(blueDeskHostAccess(full, live), "public");
  assert.equal(blueDeskPresentationTarget(full, live), null,
    "Exact page is rendered directly, not rewritten to the limited public Markets view");
  for (const path of [
    "/owner/markets/private", "/owner/markets/terminal",
    "/owner/markets/", "/owner/markets.json", "/presenter/technical-checks",
    "/api/market-intelligence-snapshot", "/api/presenter/technical-checks",
    "/api/research-update", "/dossier",
  ]) {
    assert.equal(blueDeskHostAccess(path, live), "private", path);
  }
  for (const host of [
    "bluebelly-desk.vercel.app", "alchemy-blue-desk.vercel.app",
  ]) {
    assert.equal(blueDeskHostAccess(full, host), "blocked", host);
  }
  assert.equal(blueDeskHostAccess(full, "preview-abc.vercel.app"), "private");
  assert.equal(blueDeskPresentationTarget(full, "bluebelly-desk.vercel.app"), null);

  assert.equal(blueDeskHostAccess("/owner/live", live), "public");
  assert.equal(blueDeskPresentationTarget("/owner/live", live), "/blue-desk");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.ok(middleware.indexOf('if (accessScope === "public")') <
    middleware.indexOf("getClaims()"), "Only explicit reader routes bypass login");
  const terminal = readFileSync(new URL("../app/owner/markets/page.tsx", import.meta.url), "utf8");
  assert.match(terminal, /getMarketMonitor\(\)/);
  assert.match(terminal, /getGlobalFlowMonitor\(\)/);
  assert.match(terminal, /<BlueDeskHeader activePath="\/blue-desk\/markets" \/>/);
  assert.doesNotMatch(terminal, /LiveDeskShell|<form|signout|use server|fetch\("\/api\//);
});

test("P1a native Presenter remains private with only existing owner API exceptions", () => {
  const host = "bluebelly-desk.vercel.app";
  assert.equal(blueDeskPresentationTarget("/presenter", host), "/blue-desk/presenter");
  assert.equal(blueDeskHostAccess("/presenter", host), "private");
  for (const route of ["/login", "/auth/google", "/auth/callback", "/auth/signout"]) {
    assert.equal(blueDeskHostAccess(route, host), "public", route);
  }
  for (const route of ["/api/owner/editorial-generate", "/api/presenter/technical-checks"]) {
    assert.equal(blueDeskHostAccess(route, host), "private", route);
    assert.equal(blueDeskPresentationTarget(route, host), null, route);
  }
  assert.equal(blueDeskHostAccess("/presenter/full-prep", host), "private");
  for (const route of ["/presenter/editorial", "/owner/presenter",
    "/api/owner/bluebelly/v1/overview", "/api/cron/research/morning"]) {
    assert.equal(blueDeskHostAccess(route, host), "blocked", route);
  }
  const header = readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx", import.meta.url), "utf8");
  const presenter = readFileSync(new URL("../app/blue-desk/presenter/page.tsx", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(header, /\["Presenter Prep", "\/presenter"\]/);
  assert.match(presenter, /<EditorialWorkbench priceCards=\{priceCards\} mode="presenter"/);
  assert.match(presenter, /<PresenterTechnicalChecks compact \/>/);
  assert.match(presenter, /getLatestEditorialSlate\(\)/);
  assert.match(presenter, /notFound\(\)/, "pinned edition must not silently use current brief");
  assert.doesNotMatch(presenter, /href=\{[^}]*hybrid-output/);
  assert.match(presenter, /href="\/presenter\/full-prep"/);
  assert.match(middleware, /bluebellyOwnerApi/);
  assert.ok(middleware.indexOf("getClaims()") > middleware.indexOf("bluebellyOwnerApi"));
  assert.equal(blueDeskHostAccess("/api/owner/editorial-generate", "alchemy-blue-desk.vercel.app"), "blocked");
});

test("integration public insight routes and owner Presenter both retain narrow host boundaries", () => {
  const host = "bluebelly-desk.vercel.app";
  for (const [pathname, target] of [
    ["/key-stories", "/blue-desk/key-stories"],
    ["/rates", "/blue-desk/rates"],
    ["/what-changed", "/blue-desk/what-changed"],
  ]) {
    assert.equal(blueDeskHostAccess(pathname, host), "public", pathname);
    assert.equal(blueDeskPresentationTarget(pathname, host), target, pathname);
    assert.equal(blueDeskHostAccess(target, host), "public", target);
    assert.equal(blueDeskPresentationTarget(pathname, LIVE_DESK_PRESENTATION_HOST), target);
  }
  assert.equal(blueDeskHostAccess("/presenter", host), "private");
  assert.equal(blueDeskHostAccess("/presenter/full-prep", host), "private");
  assert.equal(blueDeskPresentationTarget("/presenter", host), "/blue-desk/presenter");
  assert.equal(blueDeskPresentationTarget("/presenter/full-prep", host), "/blue-desk/presenter/full-prep");
  for (const path of ["/api/owner/editorial-generate", "/api/presenter/technical-checks"]) {
    assert.equal(blueDeskHostAccess(path, host), "private");
    assert.equal(blueDeskPresentationTarget(path, host), null);
  }
  for (const path of ["/hybrid-output/prepare", "/owner/presenter",
    "/api/owner/bluebelly/v1/overview", "/api/research-update",
    "/api/cron/research/morning", "/presenter/technical-checks"]) {
    assert.equal(blueDeskHostAccess(path, host), "blocked", path);
  }
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.ok(middleware.indexOf("getClaims()") > middleware.indexOf("bluebellyOwnerApi"));
  assert.match(middleware, /app_access_allowlist/);
  for (const [tab, expected] of [["bonds", "/rates"], ["stories", "/key-stories"], ["motion", "/what-changed"]]) {
    assert.equal(publicLiveLegacyTabDestination(tab), expected);
  }
});
