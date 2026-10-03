import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const page = source("../app/dossier/page.tsx");
const assetBoard = source("../components/live-desk/DailyAssetStateBoard.tsx");
const overview = source("../app/page.tsx");

function position(label: string) {
  const index = page.indexOf(label);
  assert.ok(index >= 0, `Missing Dossier hierarchy marker: ${label}`);
  return index;
}

test("Dossier presenter path is evidence-first before narrative explanation", () => {
  const state = position("DESK STATE");
  const hero = position("CURRENT MARKET DOSSIER");
  const expectedVsHappened = position("EXPECTED VS HAPPENED");
  const reactionMap = position("REACTION MAP");
  const whatMatters = position("WHAT MATTERS NOW");
  const divergenceLab = position("DIVERGENCE LAB");
  const whatChangesView = position("WHAT CHANGES THE VIEW");
  const currentTape = position("CURRENT TAPE");

  assert.ok(state < hero);
  assert.ok(hero < expectedVsHappened);
  assert.ok(expectedVsHappened < reactionMap);
  assert.ok(reactionMap < whatMatters);
  assert.ok(whatMatters < divergenceLab);
  assert.ok(divergenceLab < whatChangesView);
  assert.ok(whatChangesView < currentTape);
});

test("live tape is secondary, current-only context and cannot lead the Dossier", () => {
  const hero = position("CURRENT MARKET DOSSIER");
  const assetBoard = position("<DailyAssetStateBoard");
  const currentTape = position("CURRENT TAPE");

  assert.ok(hero < currentTape);
  assert.ok(currentTape < assetBoard);
  assert.match(page, /!historicalMode \? \(\s*<section className=\{styles\.currentTape\}>/);
  assert.match(page, /Live-owned observations may be newer than the frozen Dossier/);
  assert.match(page, /do not rewrite the persisted interpretation/);
});

test("Dossier suppresses duplicate Daily Asset State stock radar while Overview keeps the default", () => {
  assert.match(page, /showStockRadar=\{false\}/);
  assert.match(page, /heading="Current market tape"/);
  assert.match(assetBoard, /showStockRadar = true/);
  assert.match(assetBoard, /showStockRadar && state\.stockRadar\.length/);
  assert.doesNotMatch(overview, /showStockRadar=\{false\}/);
});

test("supporting workbench and Dossier Memory are progressive disclosure below the briefing", () => {
  const currentTape = position("CURRENT TAPE");
  const workbench = position("MORE / CHARTS, RADAR & THEMES");
  const memory = position("DOSSIER MEMORY");
  const reasoningHistory = position("AUDIT / REASONING HISTORY");
  const researchHealth = position("RESEARCH HEALTH & GAPS");

  assert.ok(currentTape < workbench);
  assert.ok(workbench < memory);
  assert.ok(memory < reasoningHistory);
  assert.ok(reasoningHistory < researchHealth);
  assert.match(page, /<details className=\{styles\.more\}>/);
  assert.doesNotMatch(page, /<details className=\{styles\.more\} open>/);
  assert.match(page, /<details className=\{styles\.historyNav\}>/);
  assert.match(page, /View \{Math\.min\(historyIndex\.items\.length, 10\)\} vintage/);
});

test("historical replay remains exact and excludes current live enrichment", () => {
  assert.match(page, /historicalMode = selection\.status === "historical_exact"/);
  assert.match(page, /requestedId\s*\? \[null, \[\]\]/);
  assert.match(page, /HISTORICAL MARKET DOSSIER/);
  assert.match(page, /Return to current Dossier/);
  assert.match(page, /!historicalMode \? \(/);
  assert.match(page, /getDossierV2PresentationSelectionById\(requestedId\)/);
});

test("hierarchy refactor does not introduce new reasoning or persistence paths", () => {
  assert.doesNotMatch(page, /executeResearchBrain/);
  assert.doesNotMatch(page, /runIntelligenceEngine/);
  assert.doesNotMatch(page, /persistMarketDossierV2/);
  assert.doesNotMatch(page, /dossier-storyline-composer/);
  assert.doesNotMatch(page, /research-gap-worker/);
});
