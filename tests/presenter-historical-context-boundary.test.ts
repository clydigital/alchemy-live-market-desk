import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildPresenterHistoricalContextBoundary,
  PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION,
} from "../lib/presenter-historical-context-boundary.ts";

test("P1.4 historical Presenter mode is explicitly Story-reasoning-only", () => {
  const boundary = buildPresenterHistoricalContextBoundary({
    editionSelectionStatus: "historical",
    selectedEditionId: "edition-old",
    currentEditionId: "edition-current",
    dossierId: "11111111-1111-4111-8111-111111111111",
    dossierAsOf: "2026-10-05T02:00:00.000Z",
  });

  assert.equal(boundary.contractVersion, PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION);
  assert.equal(boundary.scope, "HISTORICAL_STORY_REASONING_ONLY");
  assert.equal(boundary.historicalStoryReasoning, true);
  assert.equal(boundary.historicalDossierReplayAvailable, false);
  assert.equal(boundary.dossierSource, "CURRENT_DOSSIER");
  assert.equal(boundary.dossierId, "11111111-1111-4111-8111-111111111111");
  assert.equal(boundary.dossierAsOf, "2026-10-05T02:00:00.000Z");
  assert.match(boundary.reason, /does not freeze the exact Market Dossier V2 ID/);
});

test("P1.4 current Presenter mode stays a current case", () => {
  const boundary = buildPresenterHistoricalContextBoundary({
    editionSelectionStatus: "current",
    selectedEditionId: "edition-current",
    currentEditionId: "edition-current",
    dossierId: "11111111-1111-4111-8111-111111111111",
    dossierAsOf: "2026-10-05T02:00:00.000Z",
  });

  assert.equal(boundary.scope, "CURRENT_CASE");
  assert.equal(boundary.historicalStoryReasoning, false);
  assert.equal(boundary.historicalDossierReplayAvailable, false);
  assert.equal(boundary.dossierSource, "CURRENT_DOSSIER");
});

test("P1.4 invalid historical request falls back to current case, never pseudo-historical Dossier context", () => {
  const boundary = buildPresenterHistoricalContextBoundary({
    editionSelectionStatus: "invalid_fallback_current",
    selectedEditionId: "edition-current",
    currentEditionId: "edition-current",
    dossierId: null,
    dossierAsOf: null,
  });

  assert.equal(boundary.scope, "CURRENT_CASE");
  assert.equal(boundary.historicalStoryReasoning, false);
  assert.equal(boundary.historicalDossierReplayAvailable, false);
  assert.match(boundary.reason, /requested Journey edition was unavailable/i);
});

test("P1.4 boundary contains no fuzzy edition-to-Dossier resolver", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(
    path.join(root, "lib", "presenter-historical-context-boundary.ts"),
    "utf8",
  );
  const start = source.indexOf("export function buildPresenterHistoricalContextBoundary");
  assert.notEqual(start, -1);
  const executable = source.slice(start);

  assert.doesNotMatch(executable, /Date\.parse/);
  assert.doesNotMatch(executable, /nearest|closest|as_of.*sort|sort.*as_of/i);
  assert.doesNotMatch(executable, /market_dossiers_v2/);
  assert.doesNotMatch(executable, /getDossierV2PresentationSelectionById/);
  assert.doesNotMatch(executable, /storyIds|thesisIds/);
});

test("P1.5 canonical Journey editions now freeze exact Dossier identity without changing Dossier schema", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const writer = fs.readFileSync(
    path.join(root, "lib", "intelligence", "canonical-journey-edition.ts"),
    "utf8",
  );
  const schema = fs.readFileSync(
    path.join(root, "supabase", "migrations", "20260915000000_market_dossiers_v2.sql"),
    "utf8",
  );

  const start = writer.indexOf("export async function persistCanonicalJourneyEditionForResearchRun");
  const end = writer.indexOf("/**\n * Final Live-owned edition-composition phase", start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const baseEditionWriter = writer.slice(start, end);

  assert.match(baseEditionWriter, /canonicalStoryManifest/);
  assert.match(baseEditionWriter, /capturePresenterDossierEditionContext\(generatedAt\)/);
  assert.match(baseEditionWriter, /presenterDossierContext/);
  assert.match(baseEditionWriter, /presenterDossierSourceRef/);
  assert.doesNotMatch(baseEditionWriter, /market_dossiers_v2/);
  assert.doesNotMatch(schema, /research_run_id/);
});

test("P1.4 Hybrid page keeps Dossier selection independent from historical edition selection", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const page = fs.readFileSync(path.join(root, "app", "hybrid-output", "page.tsx"), "utf8");

  assert.match(page, /getDossierV2PresentationSelection\(\)/);
  assert.match(page, /selectCanonicalEdition\(\s*presenterEditionIndex,\s*requestedEditionId/);
  assert.match(page, /buildPresenterHistoricalContextBoundary\(\{/);
  assert.match(page, /dossierId: selection\.selectedDossierId/);
  assert.match(page, /dossierAsOf: selection\.selectedAsOf/);
  assert.doesNotMatch(page, /getDossierV2PresentationSelectionById/);
});

test("P1.4 UI labels the historical boundary without claiming full case replay", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const component = fs.readFileSync(
    path.join(root, "components", "live-desk", "PresenterDivergenceJourney.tsx"),
    "utf8",
  );

  assert.match(component, /HISTORICAL_STORY_REASONING_ONLY/);
  assert.match(component, /STORY REASONING ONLY/);
  assert.match(component, /historicalContextBoundary\.reason/);
  assert.match(component, /HISTORICAL DOSSIER/);
  assert.match(component, /HISTORICAL CASE/);
  assert.match(component, /EXACT DOSSIER/);
});

test("P1.4 remains read-only and adds no persistence or reasoning path", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const files = [
    path.join(root, "lib", "presenter-historical-context-boundary.ts"),
    path.join(root, "app", "hybrid-output", "page.tsx"),
    path.join(root, "components", "live-desk", "PresenterDivergenceJourney.tsx"),
  ].map((file) => fs.readFileSync(file, "utf8"));
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /executeDossierStoryCanonicalMutation/);
  assert.doesNotMatch(combined, /persistMarketDossierV2/);
  assert.doesNotMatch(combined, /persistCanonicalStoryReasoning/);
  assert.doesNotMatch(combined, /runIntelligenceEngine|executeResearchBrain/);
});


test("P1.6 exact frozen Dossier identity upgrades Presenter to full historical case replay", () => {
  const boundary = buildPresenterHistoricalContextBoundary({
    editionSelectionStatus: "historical",
    selectedEditionId: "edition-old",
    currentEditionId: "edition-current",
    dossierId: "99999999-9999-4999-8999-999999999999",
    dossierAsOf: "2026-10-05T04:00:00.000Z",
    exactHistoricalDossier: {
      dossierId: "11111111-1111-4111-8111-111111111111",
      dossierAsOf: "2026-10-05T02:00:00.000Z",
    },
  });
  assert.equal(boundary.scope, "HISTORICAL_FULL_CASE");
  assert.equal(boundary.historicalStoryReasoning, true);
  assert.equal(boundary.historicalDossierReplayAvailable, true);
  assert.equal(boundary.dossierSource, "FROZEN_EDITION_DOSSIER");
  assert.equal(boundary.dossierId, "11111111-1111-4111-8111-111111111111");
  assert.equal(boundary.dossierAsOf, "2026-10-05T02:00:00.000Z");
});
