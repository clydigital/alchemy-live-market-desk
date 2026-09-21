import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dossierRoute = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");
const historyRoute = readFileSync(new URL("../app/api/dossier-v2/history/route.ts", import.meta.url), "utf8");
const reader = readFileSync(new URL("../lib/dossier-v2/presentation-reader.ts", import.meta.url), "utf8");

test("Dossier V2 endpoint supports exact immutable replay by UUID", () => {
  assert.match(dossierRoute, /searchParams\.get\("id"\)/);
  assert.match(dossierRoute, /isValidUuid\(requestedId\)/);
  assert.match(dossierRoute, /getDossierV2PresentationSelectionById\(requestedId\)/);
  assert.match(dossierRoute, /status: requestedId && !selection\.presentation \? 404 : 200/);
  assert.match(dossierRoute, /s-maxage=3600/);
});

test("exact replay reader never calls the current healthy fallback selector", () => {
  assert.match(reader, /getMarketDossierV2ById\(id, dbClient\)/);
  assert.match(reader, /selectExactDossierV2Presentation\(dossier, previous, id\)/);
  const exactStart = reader.indexOf("export function selectExactDossierV2Presentation");
  const exactEnd = reader.indexOf("export function selectDossierV2Presentation", exactStart);
  const exactBody = reader.slice(exactStart, exactEnd);
  assert.doesNotMatch(exactBody, /selectDossierV2Presentation\(/);
  assert.doesNotMatch(exactBody, /fallback_previous_healthy/);
});

test("history index is bounded and does not run research or model work", () => {
  assert.match(historyRoute, /getDossierV2HistoryIndex\(limit\)/);
  assert.match(historyRoute, /s-maxage=60/);
  assert.match(reader, /Math\.max\(1, Math\.min\(50/);
  assert.match(reader, /\.limit\(boundedLimit\)/);
  assert.doesNotMatch(historyRoute, /executeResearchBrain|runIntelligenceEngine|getHybridFeedData/);
  assert.doesNotMatch(reader, /executeResearchBrain|runIntelligenceEngine/);
});
