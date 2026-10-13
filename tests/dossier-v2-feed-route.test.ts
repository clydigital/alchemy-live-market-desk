import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");

test("lightweight Dossier V2 endpoint uses only the shared presentation selector", () => {
  assert.match(source, /getDossierV2PresentationSelection/);
  assert.doesNotMatch(source, /getCanonicalPublicationPayload|getHybridFeedData|getDeskData|runIntelligenceEngine|executeResearchBrain/);
});

test("lightweight Dossier V2 endpoint is cacheable, CORS-readable and fails closed", () => {
  assert.match(source, /Access-Control-Allow-Origin/);
  assert.match(source, /s-maxage=30/);
  assert.match(source, /stale-while-revalidate=120/);
  assert.match(source, /status:\s*"unavailable"/);
  assert.match(source, /presentation:\s*null/);
  assert.match(source, /status:\s*503/);
});


test("lightweight Dossier V2 endpoint terminates stalled core and optional reads", () => {
  assert.match(source, /withinTimeout/);
  assert.match(source, /DOSSIER_CORE_READ_TIMEOUT_MS = 5_000/);
  assert.match(source, /DOSSIER_OPTIONAL_READ_TIMEOUT_MS = 1_800/);
  assert.match(source, /"Dossier presentation"[\s\S]*getDossierV2PresentationSelection[\s\S]*DOSSIER_CORE_READ_TIMEOUT_MS/);
  assert.match(source, /"Dossier market monitor"[\s\S]*getMarketMonitor[\s\S]*DOSSIER_OPTIONAL_READ_TIMEOUT_MS/);
  assert.match(source, /"Dossier StockedUp evidence"[\s\S]*getStockedUpEvidenceBrief[\s\S]*DOSSIER_OPTIONAL_READ_TIMEOUT_MS/);
});

test("current core and optional reads overlap without changing selection authority", () => {
  // Regression: previously the route awaited the entire 5-second core read
  // before starting the 1.8-second optional reads, compounding Hybrid latency.
  assert.match(source, /const selectionRead = withinTimeout\(/);
  assert.match(source, /const optionalReads = requestedId\s*\? Promise\.resolve\(\[null, null\] as const\)/);
  assert.match(source, /const \[selection, \[monitor, stockedUpEvidenceBrief\]\] = await Promise\.all\(\[\s*selectionRead,\s*optionalReads,\s*\]\)/);
  assert.match(source, /const historical = selection\.status === "historical_exact"/);
  assert.match(source, /buildDailyAssetState\(\{ monitor, presentation: selection\.presentation \}\)/);
  assert.doesNotMatch(source, /getLiveDeskFeed|getHybridFeedData|fallback_previous_healthy\s*\?/);
});

test("reader exposes bounded server timing and classifies 503 errors without logging sensitive payloads", () => {
  assert.match(source, /const startedAt = Date\.now\(\)/);
  assert.match(source, /"X-Alchemy-Dossier-Read": "success"/);
  assert.match(source, /"X-Alchemy-Dossier-Read": reason/);
  assert.match(source, /"Server-Timing": `dossier;dur=\$\{Date\.now\(\) - startedAt\}`/);
  assert.match(source, /error instanceof OperationTimeoutError \? "core_timeout" : "read_error"/);
  assert.match(source, /console\.error\("\[dossier-v2\] presentation unavailable"/);
  assert.match(source, /errorType: error instanceof Error \? error\.name : typeof error/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.match(source, /status: 503/);
});

test("optional read exceptions remain noncanonical and cannot affect the selected Dossier", () => {
  assert.match(source, /"Dossier market monitor"[\s\S]*\.catch\(\(error: unknown\) => \{[\s\S]*return null;/);
  assert.match(source, /"Dossier StockedUp evidence"[\s\S]*\.catch\(\(error: unknown\) => \{[\s\S]*return null;/);
  assert.match(source, /const optionalReads = requestedId/);
  assert.match(source, /getDossierV2PresentationSelectionById\(requestedId\)/);
});
