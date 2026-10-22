import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { legacyReadCallerTelemetry } from "../lib/intelligence/publication-caller-telemetry.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const dossier = read("../app/api/dossier-v2/route.ts");
const history = read("../app/api/dossier-v2/history/route.ts");
const snapshot = read("../app/api/market-intelligence-snapshot/route.ts");
const snapshotBuilder = read("../lib/market-intelligence-snapshot.ts");

test("caller telemetry records presence, not values, and no secret-bearing headers", () => {
  const input = new Request(
    "https://desk.example/api/dossier-v2?id=supersecret-id&limit=private&token=not-to-log",
    {
      headers: {
        authorization: "Bearer this-is-a-secret",
        cookie: "session=private",
        referer: "https://reader.example/private/secure?token=secret",
        "user-agent": "curl/8.9.0 TokenSecret",
        "sec-fetch-site": "cross-site",
        "x-forwarded-for": "192.0.2.100",
      },
    },
  );
  const result = legacyReadCallerTelemetry(input, "/api/dossier-v2");
  assert.deepEqual(result, {
    event: "legacy_api_read_caller",
    version: "publication-caller-v1",
    route: "/api/dossier-v2",
    method: "GET",
    callerClass: "script",
    fetchSite: "cross-site",
    referrerHost: "reader.example",
    hasIdParameter: true,
    hasLimitParameter: true,
  });
  const text = JSON.stringify(result);
  for (const secret of ["supersecret-id", "private", "Bearer", "192.0.2.100", "8.9.0", "TokenSecret", "not-to-log"]) {
    assert.ok(!text.includes(secret), secret);
  }
});

test("all three legacy routes emit coarse telemetry without changing success bodies", () => {
  for (const [source, path] of [
    [dossier, "/api/dossier-v2"],
    [history, "/api/dossier-v2/history"],
    [snapshot, "/api/market-intelligence-snapshot"],
  ] as const) {
    assert.ok(source.includes('recordLegacyReadCaller(request, "' + path + '")'));
    assert.ok(source.indexOf("recordLegacyReadCaller(request,") < source.indexOf("  try {") || source.includes('recordLegacyReadCaller(request, "/api/dossier-v2");'));
  }
  assert.match(dossier, /getDossierV2PresentationSelectionById\(requestedId\)/);
  assert.match(dossier, /return NextResponse\.json\(\{ \.\.\.selection, dailyAssetState, stockedUpEvidenceBrief \}/);
  assert.match(history, /getDossierV2HistoryIndex\(limit\)/);
  assert.match(snapshot, /return marketIntelligenceSuccessResponse\(snapshot\)/);
  assert.match(snapshot, /export async function GET\(request: Request\)/);
});

test("success snapshots keep exact v1 contract but not shared cache", () => {
  assert.match(snapshot, /export const revalidate = 0/);
  assert.match(snapshotBuilder, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(snapshotBuilder, /s-maxage=30|stale-while-revalidate=120/);
  const mobile = read("../app/mobile-brief/page.tsx");
  assert.match(mobile, /fetch\("\/api\/market-intelligence-snapshot"/);
});

test("legacy Dossier errors use fixed safe text while preserving expected status and fields", () => {
  assert.match(dossier, /status: 503/);
  assert.match(dossier, /detail: "Dossier V2 presentation is temporarily unavailable\."/);
  assert.doesNotMatch(dossier, /Dossier V2 presentation read failed: \$\{detail\}/);
  assert.doesNotMatch(dossier, /const detail = error instanceof Error \? error\.message/);
  assert.match(dossier, /"Cache-Control": "private, no-store"/);
  assert.match(history, /status: 503/);
  assert.match(history, /error: "Dossier history temporarily unavailable\."/);
  assert.doesNotMatch(history, /error: detail/);
  assert.doesNotMatch(history, /error\.message/);
  assert.match(history, /"Cache-Control": "private, no-store"/);
  assert.match(history, /getDossierV2HistoryIndex\(limit\)/);
});

test("containment does not claim route authorization or public projection", () => {
  const middleware = read("../middleware.ts");
  const privateRoute = read("../app/api/internal/dossier-v2/route.ts");
  assert.match(middleware, /pathname\.startsWith\("\/api\/"\) && !dashboardAuthRequired\(\)/);
  assert.match(privateRoute, /acceptsHybridDossierRead/);
  for (const file of [dossier, history, snapshot]) {
    assert.doesNotMatch(file, /PUBLIC_DOSSIER_ROUTE_ENABLED|buildPublicDossierReviewCandidate/);
  }
});
