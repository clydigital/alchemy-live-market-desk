import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
import { MACHINE_AUTH_PATHS, PUBLIC_AUTH_PATHS } from "../lib/supabase/config.ts";
import { acceptsHybridDossierRead } from "../lib/blue-desk-private-dossier-auth.ts";
import { isPublicFieldApproved } from "../lib/blue-desk-public-api-field-review.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const middleware = read("../middleware.ts");
const machineRoute = read("../app/api/internal/dossier-v2/route.ts");
const techRoute = read("../app/api/presenter/technical-checks/route.ts");
const callback = read("../app/auth/callback/route.ts");

test("P−1d public/owner/machine access matrix is host-specific and fail-closed", () => {
  const cases: Array<[string, string, "public" | "private" | "blocked"]> = [
    ["bluebelly-desk.vercel.app", "/", "public"],
    ["bluebelly-desk.vercel.app", "/markets", "public"],
    ["bluebelly-desk.vercel.app", "/api/internal/dossier-v2", "blocked"],
    ["bluebelly-desk.vercel.app", "/api/dossier-v2", "blocked"],
    ["bluebelly-desk.vercel.app", "/api/dossier-v2/history", "blocked"],
    ["bluebelly-desk.vercel.app", "/api/presenter/technical-checks", "blocked"],
    ["bluebelly-desk.vercel.app", "/auth/callback", "blocked"],
    ["bluebelly-desk.vercel.app", "/hybrid-output/prepare", "blocked"],
    ["alchemy-live-market-desk.vercel.app", "/", "public"],
    ["alchemy-live-market-desk.vercel.app", "/api/internal/dossier-v2", "private"],
    ["alchemy-live-market-desk.vercel.app", "/dossier", "private"],
    ["alchemy-live-market-desk.vercel.app", "/api/presenter/technical-checks", "private"],
    ["alchemy-live-market-desk-rogue-magazine.vercel.app", "/owner/live", "private"],
    ["alchemy-live-market-desk-rogue-magazine.vercel.app", "/api/internal/dossier-v2", "private"],
    ["alchemy-live-market-desk-rogue-magazine.vercel.app", "/api/dossier-v2/history", "private"],
    ["alchemy-blue-desk.vercel.app", "/", "blocked"],
    ["alchemy-blue-desk.vercel.app", "/api/internal/dossier-v2", "blocked"],
  ];
  for (const [host, path, expected] of cases) {
    assert.equal(blueDeskHostAccess(path, host), expected, host + path);
  }
  // "private" denotes host classification, NOT proof of a denied anonymous API.
});

test("host-blocking precedes machine-auth bypass and owner-session checks", () => {
  const blocked = middleware.indexOf('if (accessScope === "blocked")');
  const publicPage = middleware.indexOf('if (accessScope === "public")');
  const machine = middleware.indexOf("startsWithAny(pathname, MACHINE_AUTH_PATHS)");
  const ownerClaims = middleware.indexOf("supabase.auth.getClaims()");
  assert.ok(blocked >= 0 && blocked < publicPage && publicPage < machine && machine < ownerClaims);
  assert.ok(MACHINE_AUTH_PATHS.includes("/api/internal/dossier-v2" as never));
  assert.ok(!PUBLIC_AUTH_PATHS.includes("/api/internal/dossier-v2" as never));
  assert.match(middleware, /pathname\.startsWith\("\/api\/cron\/"\)/);
  assert.match(middleware, /\.eq\("active", true\)/);
  assert.match(middleware, /getClaims\(\)/);
});

test("private internal Dossier validates independent machine bearer before the old handler", () => {
  const secret = "synthetic-machine-read-only-token-01234567890123";
  assert.equal(acceptsHybridDossierRead(`Bearer ${secret}`, secret), true);
  assert.equal(acceptsHybridDossierRead("Bearer legacy-cron", secret), false);
  assert.equal(acceptsHybridDossierRead(null, secret), false);
  assert.match(machineRoute, /process\.env\.LIVE_HYBRID_DOSSIER_READ_TOKEN/);
  assert.doesNotMatch(machineRoute, /CRON_SECRET|RESEARCH_UPDATE_TOKEN|ALCHEMY_INTELLIGENCE_TOKEN/);
  const auth = machineRoute.indexOf('acceptsHybridDossierRead(request.headers.get("authorization"), token)');
  const legacy = machineRoute.indexOf("readExistingDossierV2(request)");
  assert.ok(auth >= 0 && auth < legacy);
  assert.match(machineRoute, /headers\.set\("Cache-Control", "private, no-store"\)/);
  assert.match(machineRoute, /headers\.delete\("Access-Control-Allow-Origin"\)/);
  assert.match(machineRoute, /status: legacy\.status/);
});

test("private Presenter checklist has distinct owner+allowlist auth, not the machine token", () => {
  assert.match(techRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(techRoute, /\.from\("app_access_allowlist"\)/);
  assert.match(techRoute, /\.eq\("active", true\)/);
  assert.match(techRoute, /status: 401/);
  assert.match(techRoute, /status: 403/);
  assert.match(techRoute, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(techRoute, /LIVE_HYBRID_DOSSIER_READ_TOKEN/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /app_access_allowlist/);
  assert.match(callback, /supabase\.auth\.signOut\(\)/);
});

test("P−1d cannot claim complete public API containment from new machine route", () => {
  const dossierHistory = read("../app/api/dossier-v2/history/route.ts");
  const marketSnapshot = read("../app/api/market-intelligence-snapshot/route.ts");
  const mobileBrief = read("../app/mobile-brief/page.tsx");
  const intelligenceFeed = read("../app/api/intelligence-feed/route.ts");
  assert.match(dossierHistory, /getDossierV2HistoryIndex\(limit\)/);
  assert.match(marketSnapshot, /marketIntelligenceSuccessResponse\(snapshot\)/);
  assert.match(mobileBrief, /fetch\("\/api\/market-intelligence-snapshot"/);
  assert.match(intelligenceFeed, /recordPublicationCaller\(request, "\/api\/intelligence-feed"\)/);
  for (const key of ["diagnostics", "evidenceGovernance", "decisionPacket", "thesisChanges"]) {
    assert.equal(isPublicFieldApproved("dossier-presentation/1", key), false);
  }
  // An operational-host API can still bypass session auth until its consumers migrate.
  assert.match(middleware, /pathname\.startsWith\("\/api\/"\) && !dashboardAuthRequired\(\)/);
});
