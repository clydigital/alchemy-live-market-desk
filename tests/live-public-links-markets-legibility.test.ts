import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LIVE_DESK_PRESENTATION_HOST, blueDeskHostAccess,
  blueDeskPresentationTarget, publicLiveLegacyTabDestination,
} from "../lib/blue-desk-host.ts";

test("no-login legacy Live links resolve only to an exact public reading allowlist", () => {
  const host = LIVE_DESK_PRESENTATION_HOST;
  for (const [tab, destination] of [
    ["markets", "/owner/markets"], ["MARKET", "/owner/markets"],
    ["calendar", "/calendar"], ["bonds", "/#rates-title"],
    ["stories", "/key-stories"], ["what changed", "/#motion-title"],
    ["research", "/"], ["unknown", "/"], ["//evil.example", "/"],
  ]) {
    assert.equal(publicLiveLegacyTabDestination(tab), destination, tab);
    const path = destination.split("#")[0];
    assert.equal(blueDeskHostAccess(path, host), "public");
  }
  assert.equal(publicLiveLegacyTabDestination(null), "/");
  assert.equal(blueDeskHostAccess("/owner/live", host), "public");
  assert.equal(blueDeskPresentationTarget("/owner/live", host), "/blue-desk");
  assert.equal(blueDeskHostAccess("/owner/live", "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/owner/live", "r1-preview.vercel.app"), "private");
  assert.equal(blueDeskHostAccess("/dossier", host), "private");
  assert.equal(blueDeskHostAccess("/api/research-update", host), "private");
});

test("legacy browser redirect must be host-pinned and never build a URL from raw tab content", () => {
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const pub = middleware.indexOf('if (accessScope === "public")');
  const redirect = middleware.indexOf("publicLiveLegacyTabDestination(request.nextUrl.searchParams.get(\"tab\"))");
  assert.ok(redirect >= 0 && redirect < pub);
  assert.match(middleware, /LIVE_DESK_PRESENTATION_HOST/);
  assert.match(middleware, /url.pathname = safePath/);
  assert.match(middleware, /url.search = ""/);
  assert.doesNotMatch(middleware, /oldLive.pathname = "\/owner\/live"/);
  assert.match(middleware, /getClaims\(\)/);
  assert.match(middleware, /app_access_allowlist/);
});

test("Bluebelly market instrument boxes use legible text sizes without changing data contracts", () => {
  const page = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/blue-desk/markets/legibility.module.css", import.meta.url), "utf8");
  assert.match(page, /legibility\.publicMarketsLegibility/);
  assert.match(page, /data-blue-desk-markets="public-observations"/);
  assert.match(page, /const monitoredRows=publicMarketObservations/);
  assert.match(css, /table\s*\{\s*font-size:\s*16px/);
  assert.match(css, /table thead th\s*\{\s*font-size:\s*13px/);
  assert.match(css, /table tbody th span,[\s\S]*?font-size:\s*14px/);
  assert.match(css, /table td a\s*\{\s*font-size:\s*14px/);
  assert.match(css, /nav\[aria-label="Market group"\] a\s*\{[\s\S]*?font-size:\s*15px/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(page, /getGlobalFlowMonitor|attentionScore|hot:\s*true/);
});
