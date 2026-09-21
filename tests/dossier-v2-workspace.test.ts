import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Dossier workspace consumes the shared Dossier V2 presentation reader only", () => {
  const page = source("../app/dossier/page.tsx");

  assert.match(page, /getDossierV2PresentationSelection/);
  assert.match(page, /CURRENT MARKET DOSSIER/);
  assert.match(page, /WHAT MATTERS NOW/);
  assert.match(page, /WATCH NEXT/);
  assert.match(page, /RESEARCH NOW/);
  assert.match(page, /TRADINGVIEW INVESTIGATIONS/);

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

test("Dossier workspace retains healthy/fallback state and lower-priority audit surfaces", () => {
  const page = source("../app/dossier/page.tsx");

  assert.match(page, /selection\.usingFallback/);
  assert.match(page, /selection\.notice\.detail/);
  assert.match(page, /RESEARCH HEALTH & GAPS/);
  assert.match(page, /THESIS CHANGES/);
  assert.match(page, /DEVELOPING THEMES/);
  assert.match(page, /STOCK RADAR/);
});
