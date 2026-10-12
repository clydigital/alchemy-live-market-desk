import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");

test("headline Story drivers and verified Motion come before unrelated numerical audits", () => {
  const now = page.indexOf('title="Now — canonical market view"');
  const story = page.indexOf('<HybridStoryBriefReader projection={storyBriefDelta}', now);
  const verified = page.indexOf('title="What materially changed?"', story);
  const leads = page.indexOf('title="What still needs checking?"', verified);
  const catalysts = page.indexOf('title="Upcoming news & catalysts"', leads);
  const audit = page.indexOf('title="Live–Hybrid Dossier edition parity"', catalysts);
  assert.ok(now > 0 && story > now && verified > story && leads > verified && catalysts > leads && audit > catalysts);
  assert.match(page.slice(now, story), /presenterDossier\.header\.headline/);
  assert.match(page.slice(now, story), /presenterDossier\.header\.answer/);
  assert.match(page.slice(now, story), /presenterDossier\.header\.regimeImplication/);
  assert.match(page.slice(now, story), /presenterDossier\.header\.whatWouldChangeMind/);
  assert.match(page.slice(catalysts, audit), /<details className=\{styles\.record\}>/);
});

test("exact archived edition retains all historical Dossier and invalid-edition gates", () => {
  assert.match(page, /selectHybridEditionForRequest\(/);
  assert.match(page, /editionRequestState === "INVALID_REQUEST"/);
  assert.match(page, /editionRequestState === "HISTORICAL_DOSSIER_UNAVAILABLE"/);
  assert.match(page, /const selection = editionRequestState === "HISTORICAL_READY"/);
  assert.match(page, /\? presenterHistoricalDossierReplay!\.selection!/);
  assert.match(page, /const presentedEdition = editionRequestState === "HISTORICAL_READY"/);
  assert.match(page, /edition: presentedEdition/);
  assert.match(page, /No current analysis has been substituted/);
  assert.match(page, /presenterDossier\.dossierId/);
});

test("exact prior Dossier is bounded and optional, never substituted from current history", () => {
  assert.match(page, /getDossierV2PresentationSelectionById\(presenterDossier\.previousDossierId!\)/);
  assert.match(page, /previousBriefSelection\?\.status === "historical_exact"/);
  assert.match(page, /previousBriefSelection\.selectedDossierId === presenterDossier\.previousDossierId/);
  assert.match(page, /previous: exactPreviousPresentation\s*\? buildHybridStoryEvidenceBrief\(exactPreviousPresentation\)\s*: null/);
  assert.match(page, /expectedPreviousDossierId: presenterDossier\.previousDossierId/);
  assert.match(page, /projection=\{storyBriefDelta\} asOf=\{presenterDossier\.asOf\}/);
});

test("global creator leads cannot become canonical support merely by page order", () => {
  const story = page.indexOf('<HybridStoryBriefReader');
  const leads = page.indexOf('title="What still needs checking?"', story);
  assert.ok(leads > story);
  assert.match(page, /liveMotionSelection = splitCurrentHybridMarketMotion/);
  assert.match(page, /researchLeadJourney/);
  assert.match(page, /No new verified market development/);
  assert.doesNotMatch(page.slice(0, story), /promoteMarketMotion\(/);
});
