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
