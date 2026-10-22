import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MARKET_INTELLIGENCE_FIELD_REVIEW,
  DOSSIER_SELECTION_FIELD_REVIEW,
  DOSSIER_PRESENTATION_FIELD_REVIEW,
  isPublicFieldApproved,
} from "../lib/blue-desk-public-api-field-review.ts";

const critical = [
  MARKET_INTELLIGENCE_FIELD_REVIEW.creatorVerification,
  MARKET_INTELLIGENCE_FIELD_REVIEW.researchGaps,
  MARKET_INTELLIGENCE_FIELD_REVIEW.guardrails,
  MARKET_INTELLIGENCE_FIELD_REVIEW.sourceHealth,
  DOSSIER_SELECTION_FIELD_REVIEW.calibrationLineages,
  DOSSIER_PRESENTATION_FIELD_REVIEW.diagnostics,
  DOSSIER_PRESENTATION_FIELD_REVIEW.memory,
  DOSSIER_PRESENTATION_FIELD_REVIEW.evidenceGovernance,
];

test("no field is declared approved by P−1's review-only catalogue", () => {
  for (const record of [
    MARKET_INTELLIGENCE_FIELD_REVIEW,
    DOSSIER_SELECTION_FIELD_REVIEW,
    DOSSIER_PRESENTATION_FIELD_REVIEW,
  ]) {
    assert.ok(Object.keys(record).length > 10);
    assert.ok(Object.values(record).every(x =>
      ["PUBLIC_CANDIDATE", "REVIEW_REQUIRED", "OWNER_ONLY_TARGET"].includes(x)));
  }
  assert.ok(critical.every(x => x === "OWNER_ONLY_TARGET"));
  assert.equal(isPublicFieldApproved("market-intelligence-snapshot/v1", "contractVersion"), false);
  assert.equal(isPublicFieldApproved("dossier-presentation/1", "header"), false);
});

test("legacy Hybrid Dossier reader remains unchanged until consumer-safe DTO migration", () => {
  const route = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");
  const snapshotRoute = readFileSync(new URL("../app/api/market-intelligence-snapshot/route.ts", import.meta.url), "utf8");
  const header = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(route, /getDossierV2PresentationSelection/);
  assert.match(snapshotRoute, /marketIntelligenceSuccessResponse/);
  assert.match(header, /Preserve existing API consumers until every contract is scoped and audited/);
});


test("P−1a keeps Hybrid's legacy Dossier selection shape while disabling public caches", () => {
  const route = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");
  const history = readFileSync(new URL("../app/api/dossier-v2/history/route.ts", import.meta.url), "utf8");
  assert.match(route, /getDossierV2PresentationSelectionById\(requestedId\)/);
  assert.match(route, /selectExactDossierV2Presentation\(null, null, requestedId\)/);
  assert.match(route, /NextResponse\.json\(\{ \.\.\.selection, dailyAssetState, stockedUpEvidenceBrief \}/);
  assert.match(route, /"X-Alchemy-Dossier-Selection": selection\.status/);
  assert.match(history, /getDossierV2HistoryIndex\(limit\)/);
  assert.equal(isPublicFieldApproved("dossier-presentation/1", "diagnostics"), false);
  assert.equal(isPublicFieldApproved("dossier-presentation/1", "evidenceGovernance"), false);
  assert.doesNotMatch(route, /"Cache-Control":\s*"public/);
  assert.doesNotMatch(history, /"Cache-Control":\s*"public/);
});
