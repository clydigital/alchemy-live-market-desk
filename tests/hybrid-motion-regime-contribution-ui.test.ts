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
  assert.match(page, /presenterEditionStatus === "current" && regimeContribution/);
  assert.match(page, /dossier-regime-context/);
  assert.match(page, /dossier-story-readthrough/);
  assert.match(page, /focusedDossierAdjudicationContext/);
  assert.match(page, /focusedStoryRoutedDossierContext/);
  assert.match(page, /Dossier System 2 Story read-through/);
  assert.match(page, /destination remains the Story/);
  assert.match(page, /Regime association is read-through context only/);
  assert.match(page, /view=live#dossier-story-readthrough/);
  assert.match(page, /dossier-regime-context-\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(page, /dossier-story-readthrough-\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(page, /dossier-story-readthrough-\$\{encodeURIComponent\(focusedStoryRoutedDossierContext\.motionId\)\}/);
  assert.match(page, /detail=\{focusedDossierAdjudicationContext/);

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
  assert.match(motion, /regimeSlug: string \| null/);
  assert.match(motion, /const key = item\.regimeSlug \|\| item\.regimeLabel/);
  assert.match(motion, /item\.regimeHref\?\.split\("#"\)\[0\]/);

  assert.doesNotMatch(
    [page, motion].join("\n"),
    /story_thesis_versions.*insert|market_dossiers.*insert|motion_acceptance.*insert/i,
  );
});
