import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Hybrid keeps Motion primary while showing exact Dossier regime contribution", () => {
  const page = readFileSync(
    new URL("../app/hybrid-output/page.tsx", import.meta.url),
    "utf8",
  );
  const motion = readFileSync(
    new URL("../components/live-desk/MarketMotionOverview.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /presenterDossier\.motionRegimeContext/);
  assert.match(page, /presenterDossier\.motionAdjudicationContext/);
  assert.match(page, /presenterHistoricalDossierReplay\?\.status !== "BOUND"/);
  assert.match(page, /motionRegimeContextById\.get\(item\.id\)/);
  assert.match(page, /motionAdjudicationContextById\.get\(item\.id\)/);
  assert.match(page, /directRegimeContribution \?\? dossierAdjudication/);
  assert.match(page, /regimeContributionMode: directRegimeContribution/);
  assert.match(page, /regimeContributionState: regimeContribution\?\.decision/);
  assert.match(page, /regimeContributionEvidenceCount: regimeContribution\?\.canonicalEvidenceRefs\.length/);

  assert.match(motion, /REGIME CONTRIBUTION/);
  assert.match(motion, /DOSSIER READ-THROUGH/);
  assert.match(motion, /Story-routed Dossier judgement · shown as non-state Regime read-through only/);
  assert.match(motion, /ACCEPTED BY DOSSIER/);
  assert.match(motion, /REFINED BY DOSSIER/);
  assert.match(motion, /MOTION ONLY/);
  assert.match(motion, /MOTION HYPOTHESIS/);
  assert.match(motion, /current canonical Dossier has not/);
  assert.match(motion, /buildMarketMotionRegimeRollup/);
  assert.match(motion, /DOSSIER → REGIME ROLL-UP/);
  assert.match(motion, /DIRECT REGIME ROUTE/);
  assert.match(motion, /STORY READ-THROUGH/);
  assert.match(motion, /does not authorise Regime mutation/);
  assert.match(motion, /item\.regimeContributionState !== "ACCEPT"/);
  assert.match(motion, /item\.regimeContributionMode !== "DIRECT"/);

  assert.doesNotMatch(
    [page, motion].join("\n"),
    /story_thesis_versions.*insert|market_dossiers.*insert|motion_acceptance.*insert/i,
  );
});
