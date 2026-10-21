import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { allowR1MarketsReadOnlyPreview, R1_MARKETS_PREVIEW_BRANCH } from "../lib/blue-desk-r1-preview-access.ts";

const permitted = {
  environment: "preview",
  branch: R1_MARKETS_PREVIEW_BRANCH,
  deploymentHostname: "alchemy-live-market-desk-r1-test-rogue-magazine.vercel.app",
  requestedHostname: "alchemy-live-market-desk-r1-test-rogue-magazine.vercel.app",
  pathname: "/blue-desk/markets",
  method: "GET",
} as const;

test("exact R1 Markets preview read-only document can bypass app login", () => {
  assert.equal(allowR1MarketsReadOnlyPreview(permitted), true);
  assert.equal(allowR1MarketsReadOnlyPreview({ ...permitted, method: "HEAD" }), true);
  assert.equal(allowR1MarketsReadOnlyPreview({ ...permitted, pathname: "/blue-desk/markets?group=all" }), false,
    "URL pathname is supplied separately from query, not as an arbitrary URL");
});

test("the R1 no-login exception fails closed on production, other branches or forged hosts", () => {
  for (const changed of [
    { environment: "production" },
    { environment: "development" },
    { environment: undefined },
    { branch: "main" },
    { branch: "preview/another-branch" },
    { branch: undefined },
    { deploymentHostname: undefined },
    { deploymentHostname: "" },
    { deploymentHostname: "alchemy-live-market-desk.vercel.app" , requestedHostname: "evil.example" },
    { requestedHostname: "bluebelly-desk.vercel.app" },
    { requestedHostname: "alchemy-live-market-desk.vercel.app" },
    { requestedHostname: "alchemy-live-market-desk-r1-test-rogue-magazine.vercel.app.evil.com" },
    { method: "POST" },
    { method: "PUT" },
    { method: "DELETE" },
    { pathname: "/blue-desk/newsroom" },
    { pathname: "/blue-desk/feed" },
    { pathname: "/blue-desk" },
    { pathname: "/owner/markets" },
    { pathname: "/api/market-monitor" },
    { pathname: "/api/cron/provider-acceptance" },
    { pathname: "/login" },
  ]) {
    assert.equal(allowR1MarketsReadOnlyPreview({ ...permitted, ...changed }), false, JSON.stringify(changed));
  }
});

test("middleware keeps blocked public hosts and exact preview gate ahead of private JWT auth", () => {
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const block = middleware.indexOf('if (accessScope === "blocked")');
  const preview = middleware.indexOf("if (allowR1MarketsReadOnlyPreview({");
  const jwt = middleware.indexOf("getClaims()");
  assert.ok(block >= 0 && preview > block && jwt > preview);
  assert.match(middleware, /environment: process\.env\.VERCEL_ENV/);
  assert.match(middleware, /branch: process\.env\.VERCEL_GIT_COMMIT_REF/);
  assert.match(middleware, /deploymentHostname: process\.env\.VERCEL_URL/);
  assert.match(middleware, /requestedHostname: request\.nextUrl\.hostname/);
  assert.match(middleware, /method: request\.method/);
  assert.match(middleware, /"Cache-Control", "private, no-store"/);
  assert.match(middleware, /"X-Robots-Tag", "noindex, nofollow, noarchive"/);
  assert.match(middleware, /app_access_allowlist/);
  assert.match(middleware, /startsWithAny\(pathname, MACHINE_AUTH_PATHS\)/);
  // A generic auth bypass for owner routes or APIs would be unacceptable.
  assert.doesNotMatch(middleware, /pathname\.startsWith\("\/blue-desk\/"\)\s*\)\s*return NextResponse\.next\(\)/);
});

test("read-only tape still uses the existing canonical market monitor and source-link paths", () => {
  const page = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");
  const market = readFileSync(new URL("../components/live-desk/MarketsMonitor.tsx", import.meta.url), "utf8");
  assert.match(page, /getMarketMonitor\(\),\s*getGlobalFlowMonitor\(\)/);
  assert.match(page, /<MarketsMonitor monitor=\{fullMonitor\} flows=\{flows\} hybridTape \/>/);
  assert.match(page, /if \(!isBlueDeskPublicReaderHost\(host\)\)/);
  assert.match(market, /row\.sourceUrl/);
  assert.match(market, /row\.points\.slice\(-42\)/);
  assert.doesNotMatch(page, /"use server"|server action|updateStory|insert\(/);
});
