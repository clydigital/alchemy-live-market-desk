import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("P1.6 historical Dossier loader uses only the publication-frozen UUID", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(
    path.join(root, "lib", "presenter-historical-dossier-replay.ts"),
    "utf8",
  );

  assert.match(source, /presenterDossierEditionContextFromPayload\(payload\)/);
  assert.match(source, /getDossierV2PresentationSelectionById\(context\.dossierId!\)/);
  assert.doesNotMatch(source, /getDossierV2PresentationSelection\(\)/);
  assert.doesNotMatch(source, /Date\.parse|nearest|closest/i);
  assert.doesNotMatch(source, /storyIds|thesisIds/);
});

test("P1.6 historical Dossier loader verifies exact ID and as-of identity", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(
    path.join(root, "lib", "presenter-historical-dossier-replay.ts"),
    "utf8",
  );

  assert.match(source, /selection\.status !== "historical_exact"/);
  assert.match(source, /selection\.selectedDossierId !== context\.dossierId/);
  assert.match(source, /selection\.selectedAsOf !== context\.dossierAsOf/);
  assert.match(source, /status: "IDENTITY_MISMATCH"/);
  assert.match(source, /status: "NO_FROZEN_CONTEXT"/);
});

test("P1.6 Hybrid uses exact historical Dossier only inside Presenter case inputs", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const page = fs.readFileSync(path.join(root, "app", "hybrid-output", "page.tsx"), "utf8");

  assert.match(
    page,
    /presenterEditionStatus === "historical"[\s\S]*loadPresenterHistoricalDossierReplay\(selectedPresenterEdition\?\.payload\)/,
  );
  assert.match(
    page,
    /presenterHistoricalDossierReplay\?\.status === "BOUND"[\s\S]*presenterHistoricalDossierReplay\.selection\?\.presentation[\s\S]*presenterHistoricalDossierReplay\.selection\.presentation[\s\S]*: dossier/,
  );
  assert.match(page, /investigations: presenterDossier\.watchNext/);
  assert.match(page, /investigations=\{presenterDossier\.watchNext\}/);
  assert.match(page, /calibration=\{presenterDossier\.reactionCalibration\}/);
  assert.match(page, /exactHistoricalDossier:/);
});

test("P1.6 legacy or malformed editions retain Story-reasoning-only fallback", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const boundary = fs.readFileSync(
    path.join(root, "lib", "presenter-historical-context-boundary.ts"),
    "utf8",
  );
  const component = fs.readFileSync(
    path.join(root, "components", "live-desk", "PresenterDivergenceJourney.tsx"),
    "utf8",
  );

  assert.match(boundary, /HISTORICAL_STORY_REASONING_ONLY/);
  assert.match(boundary, /no valid publication-frozen Dossier identity could be replayed/);
  assert.match(component, /STORY REASONING ONLY/);
});

test("P1.6 exact historical replay is labelled as a whole Presenter case", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const component = fs.readFileSync(
    path.join(root, "components", "live-desk", "PresenterDivergenceJourney.tsx"),
    "utf8",
  );

  assert.match(component, /HISTORICAL_FULL_CASE/);
  assert.match(component, /HISTORICAL CASE/);
  assert.match(component, /EXACT DOSSIER/);
  assert.match(component, /Historical Dossier:/);
});

test("P1.6 remains read-only and does not add a Dossier mutation path", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const files = [
    "lib/presenter-historical-dossier-replay.ts",
    "lib/presenter-historical-context-boundary.ts",
    "app/hybrid-output/page.tsx",
    "components/live-desk/PresenterDivergenceJourney.tsx",
  ].map((relative) => fs.readFileSync(path.join(root, relative), "utf8"));
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /persistMarketDossierV2/);
  assert.doesNotMatch(combined, /executeResearchBrain|runIntelligenceEngine/);
  assert.doesNotMatch(combined, /persistCanonicalStoryReasoning/);
  assert.doesNotMatch(combined, /executeDossierStoryCanonicalMutation/);
});
