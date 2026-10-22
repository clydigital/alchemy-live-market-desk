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
  // Any explicit exact ID must suppress mutable optional monitor/StockedUp reads.
  assert.match(dossierRoute, /const optionalReads = requestedId\s*\? Promise\.resolve\(\[null, null\] as const\)/);
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


test("all Dossier V2 selection outcomes have private no-store responses", () => {
  assert.match(dossierRoute, /export const dynamic = "force-dynamic";/);
  assert.match(dossierRoute, /export const revalidate = 0;/);
  assert.deepEqual(
    [...dossierRoute.matchAll(/"Cache-Control":\s*"([^"]+)"/g)].map((match) => match[1]),
    ["private, no-store", "private, no-store", "private, no-store"],
    "malformed 400, current/historical/missing 200/404, and failure 503 must not be cacheable",
  );
  assert.match(dossierRoute, /status: 400/);
  assert.match(dossierRoute, /status: requestedId && !selection\.presentation \? 404 : 200/);
  assert.match(dossierRoute, /status: 503/);
  assert.equal((dossierRoute.match(/"Access-Control-Allow-Origin": "\\*"/g) || []).length, 3);
  assert.doesNotMatch(dossierRoute, /s-maxage|stale-while-revalidate/);
});

test("Dossier V2 history index returns private no-store for success and errors", () => {
  assert.match(historyRoute, /export const dynamic = "force-dynamic";/);
  assert.match(historyRoute, /export const revalidate = 0;/);
  assert.deepEqual(
    [...historyRoute.matchAll(/"Cache-Control":\s*"([^"]+)"/g)].map((match) => match[1]),
    ["private, no-store", "private, no-store"],
  );
  assert.match(historyRoute, /status: 200/);
  assert.match(historyRoute, /status: 503/);
  assert.equal((historyRoute.match(/"Access-Control-Allow-Origin": "\\*"/g) || []).length, 2);
  assert.doesNotMatch(historyRoute, /s-maxage|stale-while-revalidate/);
});
