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
