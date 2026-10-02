import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dossierRoute = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");
const historyRoute = readFileSync(new URL("../app/api/dossier-v2/history/route.ts", import.meta.url), "utf8");
const dossierPage = readFileSync(new URL("../app/dossier/page.tsx", import.meta.url), "utf8");
const reader = readFileSync(new URL("../lib/dossier-v2/presentation-reader.ts", import.meta.url), "utf8");

test("Dossier V2 endpoint supports exact immutable replay by UUID", () => {
  assert.match(dossierRoute, /searchParams\.get\("id"\)/);
  assert.match(dossierRoute, /isValidUuid\(requestedId\)/);
  assert.match(dossierRoute, /getDossierV2PresentationSelectionById\(requestedId\)/);
  assert.match(dossierRoute, /historical = selection\.status === "historical_exact"/);
  assert.match(dossierRoute, /historical\s*\? \[null, null\]/);
  assert.match(dossierRoute, /s-maxage=3600/);
});

test("exact replay reader never invokes the current healthy selector", () => {
  const exactStart = reader.indexOf("export function selectExactDossierV2Presentation");
  const exactEnd = reader.indexOf("export function selectDossierV2Presentation", exactStart);
  const exactBody = reader.slice(exactStart, exactEnd);
  assert.ok(exactStart >= 0);
  assert.doesNotMatch(exactBody, /selectDossierV2Presentation\(/);
  assert.doesNotMatch(exactBody, /fallback_previous_healthy/);
});

test("history index is bounded and read-only", () => {
  assert.match(historyRoute, /getDossierV2HistoryIndex\(limit\)/);
  assert.match(reader, /Math\.max\(1, Math\.min\(50/);
  assert.match(reader, /\.limit\(boundedLimit\)/);
  assert.doesNotMatch(historyRoute, /executeResearchBrain|runIntelligenceEngine|persistMarketDossierV2/);
  assert.doesNotMatch(reader, /executeResearchBrain|runIntelligenceEngine/);
});

test("Dossier page makes historical replay explicit and provides return-to-current navigation", () => {
  assert.match(dossierPage, /historicalMode = selection\.status === "historical_exact"/);
  assert.match(dossierPage, /HISTORICAL MARKET DOSSIER/);
  assert.match(dossierPage, /Return to current/);
  assert.match(dossierPage, /\/dossier\?id=\$\{item\.id\}/);
});
