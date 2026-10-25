import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptsHybridDossierRead,
  hybridDossierReadConfigured,
} from "../lib/blue-desk-private-dossier-auth.ts";
import { MACHINE_AUTH_PATHS } from "../lib/supabase/config.ts";

const route = readFileSync(new URL("../app/api/internal/dossier-v2/route.ts", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const oldRoute = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");

const secret = "test-only-dedicated-hybrid-dossier-token-0123456789";

test("missing, short, malformed or previously accepted cron/research tokens never authorize", () => {
  for (const missing of [undefined, null, "", "short", "contains a space even if it is long enough"]) {
    assert.equal(hybridDossierReadConfigured(missing), false);
    assert.equal(acceptsHybridDossierRead(`Bearer ${secret}`, missing), false);
  }
  assert.equal(hybridDossierReadConfigured(secret), true);
  for (const header of [
    null, "", secret, `Basic ${secret}`, `bearer ${secret}`,
    `Bearer ${secret} extra`, "Bearer a-different-token",
    "Bearer old-cron-secret", "Bearer manual-research-token",
  ]) {
    assert.equal(acceptsHybridDossierRead(header, secret), false);
  }
  assert.equal(acceptsHybridDossierRead(`Bearer ${secret}`, secret), true);
});

test("private route performs authorization before ANY legacy Dossier read", () => {
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /export const revalidate = 0/);
  assert.match(route, /process\.env\.LIVE_HYBRID_DOSSIER_READ_TOKEN/);
  assert.match(route, /status: 503/);
  assert.match(route, /status: 401/);
  assert.match(route, /acceptsHybridDossierRead\(request\.headers\.get\("authorization"\), token\)/);
  const authCheck = route.indexOf("acceptsHybridDossierRead(request.headers.get");
  const read = route.indexOf("readExistingDossierV2(request)");
  assert.ok(authCheck >= 0 && read > authCheck);
  assert.match(route, /GET as readExistingDossierV2/);
  assert.match(oldRoute, /getDossierV2PresentationSelectionById\(requestedId\)/);
  assert.doesNotMatch(route, /runIntelligenceEngine|executeResearchBrain|createSupabaseAdminClient/);
});

test("the private response cannot be shared-cached or read with browser CORS", () => {
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /headers\.set\("Cache-Control", "private, no-store"\)/);
  assert.match(route, /headers\.delete\("Access-Control-Allow-Origin"\)/);
  assert.match(route, /headers\.delete\("Access-Control-Allow-Credentials"\)/);
  assert.match(route, /"Vary": "Authorization"/);
  assert.match(route, /status: legacy\.status/);
  assert.doesNotMatch(route, /"Access-Control-Allow-Origin": "\*"/);
});

test("middleware bypasses owner session only for existing machine-auth routes", () => {
  assert.ok(MACHINE_AUTH_PATHS.includes("/api/internal/dossier-v2" as never));
  assert.match(middleware, /if \(accessScope === "blocked"\)/);
  assert.ok(middleware.indexOf('if (accessScope === "blocked")') <
    middleware.indexOf("startsWithAny(pathname, MACHINE_AUTH_PATHS)"));
  assert.match(middleware, /startsWithAny\(pathname, MACHINE_AUTH_PATHS\)/);
  const host = readFileSync(new URL("../lib/blue-desk-host.ts", import.meta.url), "utf8");
  assert.match(host, /hostname === BLUEBELLY_PRESENTATION_HOST \? "blocked" : hostname === BLUEBELLY_QA_PREVIEW_HOST \? "blocked" : "private"/);
});
