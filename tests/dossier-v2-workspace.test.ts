import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Dossier workspace keeps Dossier V2 authoritative while admitting only promoted Market Motion context", () => {
  const page = source("../app/dossier/page.tsx");

  assert.match(page, /getDossierV2PresentationSelection/);
  assert.match(page, /CURRENT MARKET DOSSIER/);
  assert.match(page, /EXPECTED VS HAPPENED/);
  assert.match(page, /REACTION MAP/);
  assert.match(page, /WHAT MATTERS NOW/);
  assert.match(page, /05 \/ DIVERGENCE LAB/);
  assert.match(page, /buildDivergenceLabPresentation/);
  assert.match(page, /DIVERGENCE LAB — CANDIDATE MECHANISMS/);
  assert.match(page, /MECHANISM UNRESOLVED/);
  assert.match(page, /Structured mechanism evidence was not preserved/);
  assert.match(page, /candidate\.evidenceForRefs\.length/);
  assert.match(page, /candidate\.displayDiscriminator/);
  assert.doesNotMatch(page, /item\.candidateExplanations\.map/);
  assert.match(page, /WHAT CHANGES THE VIEW/);
  assert.match(page, /TRADINGVIEW INVESTIGATIONS/);
  assert.match(page, /getCurrentMarketMotion/);
  assert.match(page, /selectPromotedMarketMotionForDossier/);
  assert.match(page, /PROMOTED MARKET MOTION/);
  assert.match(page, /full Primary\/Secondary Motion tape stays in Journey/);
  assert.match(page, /does not become a second Motion feed/);
  assert.match(page, /does not guess a fuzzy Story mapping/);
  assert.doesNotMatch(page, /journeyMode/);

  assert.doesNotMatch(page, /openai/i);
  assert.doesNotMatch(page, /runIntelligenceEngine/);
  assert.doesNotMatch(page, /executeResearchBrain/);
  assert.doesNotMatch(page, /getDeskData/);
  assert.doesNotMatch(page, /journey-briefing/);
  assert.doesNotMatch(page, /dossier-storyline-composer/);
});

test("Dossier is a primary Live Desk navigation destination", () => {
  const routes = source("../lib/live-desk/routes.ts");
  const overview = routes.indexOf('label: "Overview"');
  const dossier = routes.indexOf('label: "Dossier"');
  const whatsNew = routes.indexOf('label: "What’s New"');

  assert.ok(overview >= 0);
  assert.ok(dossier > overview);
  assert.ok(whatsNew > dossier);
  assert.match(routes, /href: "\/dossier"/);
});

test("Dossier workspace exposes degraded/current state without silently substituting prior reasoning", () => {
  const page = source("../app/dossier/page.tsx");

  assert.doesNotMatch(page, /selection\.usingFallback/);
  assert.match(page, /selection\.notice\.detail/);
  assert.match(page, /selection\.lastValidDossierId/);
  assert.match(page, /View last valid Dossier/);
  assert.match(page, /RESEARCH HEALTH & GAPS/);
  assert.match(page, /THESIS CHANGES/);
  assert.match(page, /DEVELOPING THEMES/);
  assert.match(page, /STOCK RADAR/);
});


test("Dossier workspace gives every external read a terminal runtime budget", () => {
  const page = source("../app/dossier/page.tsx");

  assert.match(page, /withinTimeout/);
  assert.match(page, /DOSSIER_CORE_READ_TIMEOUT_MS = 5_000/);
  assert.match(page, /DOSSIER_OPTIONAL_READ_TIMEOUT_MS = 1_800/);
  assert.match(page, /"Dossier presentation"[\s\S]*selectionWork[\s\S]*DOSSIER_CORE_READ_TIMEOUT_MS/);
  assert.match(page, /"Dossier history"[\s\S]*getDossierV2HistoryIndex\(18\)[\s\S]*DOSSIER_OPTIONAL_READ_TIMEOUT_MS/);
  assert.match(page, /"Dossier market monitor"[\s\S]*getMarketMonitor[\s\S]*DOSSIER_OPTIONAL_READ_TIMEOUT_MS/);
  assert.match(page, /"Dossier Market Motion"[\s\S]*getCurrentMarketMotion[\s\S]*DOSSIER_OPTIONAL_READ_TIMEOUT_MS/);
  assert.match(page, /selectDossierV2Presentation\(\[\]\)/);
});
