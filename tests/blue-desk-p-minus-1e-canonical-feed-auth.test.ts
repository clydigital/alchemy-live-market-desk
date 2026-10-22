import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptsCanonicalFeedRead,
  canonicalFeedReadConfigured,
} from "../lib/blue-desk-private-feed-auth.ts";
import { MACHINE_AUTH_PATHS, PUBLIC_AUTH_PATHS } from "../lib/supabase/config.ts";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = source("../app/api/internal/canonical-feed/route.ts");
const publisher = source("../lib/intelligence/desk-read-publication-route.ts");
const original = source("../app/api/intelligence-feed/route.ts");
const middleware = source("../middleware.ts");
const separateDossier = source("../app/api/internal/dossier-v2/route.ts");

const token = "synthetic-separate-canonical-read-token-20261022-abcdef";

test("canonical feed credential is separate and accepted only as a dedicated bearer", () => {
  for (const missing of [null, undefined, "", "short", " ".repeat(33), "a".repeat(39) + " "]) {
    assert.equal(canonicalFeedReadConfigured(missing), false);
    assert.equal(acceptsCanonicalFeedRead("Bearer " + token, missing), false);
  }
  assert.equal(canonicalFeedReadConfigured(token), true);
  assert.equal(acceptsCanonicalFeedRead("Bearer " + token, token), true);
  for (const wrong of [null, "", token, "Basic " + token, "bearer " + token,
    "Bearer " + token + " extra", "Bearer another-not-the-feed-secret"]) {
    assert.equal(acceptsCanonicalFeedRead(wrong, token), false);
  }
  assert.match(route, /process\.env\.LIVE_HYBRID_CANONICAL_FEED_READ_TOKEN/);
  assert.doesNotMatch(route, /process\.env\.LIVE_HYBRID_DOSSIER_READ_TOKEN|CRON_SECRET|RESEARCH_UPDATE_TOKEN/);
  assert.match(separateDossier, /process\.env\.LIVE_HYBRID_DOSSIER_READ_TOKEN/);
});

test("machine access is gated by Bluebelly host block, then route bearer before any reads", () => {
  assert.ok(MACHINE_AUTH_PATHS.includes("/api/internal/canonical-feed" as never));
  assert.ok(!PUBLIC_AUTH_PATHS.includes("/api/internal/canonical-feed" as never));
  for (const host of ["bluebelly-desk.vercel.app", "alchemy-blue-desk.vercel.app"]) {
    assert.equal(blueDeskHostAccess("/api/internal/canonical-feed", host), "blocked");
  }
  assert.equal(blueDeskHostAccess("/api/internal/canonical-feed", "alchemy-live-market-desk.vercel.app"), "private");
  assert.ok(middleware.indexOf('if (accessScope === "blocked")')
    < middleware.indexOf("startsWithAny(pathname, MACHINE_AUTH_PATHS)"));
  const bearer = route.indexOf('acceptsCanonicalFeedRead(request.headers.get("authorization"), token)');
  const published = route.indexOf("getCanonicalPublicationResponseWithDeskRead(edition)");
  assert.ok(bearer > 0 && published > bearer);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 503/);
});

test("current and exact edition use existing canonical publisher, unchanged status/body", () => {
  assert.match(route, /searchParams\.get\("edition"\)/);
  assert.match(route, /getCanonicalPublicationResponseWithDeskRead\(edition\)/);
  assert.match(route, /status: published\.status/);
  assert.match(route, /new Response\(published\.body/);
  assert.match(original, /getCanonicalPublicationResponseWithDeskRead\(new URL\(request\.url\)\.searchParams\.get\("edition"\)\)/);
  assert.match(publisher, /getCanonicalPublicationPayload\(editionId\)/);
  assert.match(route, /export const revalidate = 0/);
  assert.doesNotMatch(route, /runIntelligenceEngine|updateStory|persistStory|createSupabaseAdminClient/);
});

test("private feed is not cached or CORS-exposed; error message is fixed", () => {
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /"Vary": "Authorization"/);
  assert.match(route, /headers\.set\("Cache-Control", "private, no-store"\)/);
  assert.match(route, /headers\.delete\("Access-Control-Allow-Origin"\)/);
  assert.match(route, /headers\.delete\("Content-Length"\)/);
  assert.match(route, /error: "Canonical feed temporarily unavailable\."/);
  assert.doesNotMatch(route, /error\.message|String\(error\)|Access-Control-Allow-Origin": "\*"/);
});
