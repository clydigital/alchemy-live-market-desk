import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const brief = readFileSync(new URL("../lib/stockedup-evidence-brief.ts", import.meta.url), "utf8");
const overview = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const dossier = readFileSync(new URL("../app/dossier/page.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");

test("StockedUp brief admits only canonical verified-macro rows as verified evidence", () => {
  assert.match(brief, /\.like\("external_evidence_id", "verified-macro:stockedup-%"\)/);
  assert.match(brief, /status: "VERIFIED"/);
  assert.match(brief, /Only VERIFIED items may directly strengthen Live's canonical market interpretation/);
  assert.match(brief, /sourceUrl: row\.provenance_urls\?\.\[0\] \?\? source\?\.source_url/);
});

test("StockedUp creator claims that remain unverified stay outside canonical reasoning", () => {
  assert.match(brief, /Exact Hormuz-for-sanctions deal terms/);
  assert.match(brief, /Week 39 as the exact worst S&P week/);
  assert.match(brief, /SPY tactical map/);
  assert.match(brief, /Advance–decline line below 200DMA/);
  assert.match(brief, /30Y above 5% for 79 straight days/);
  assert.match(brief, /DELL downside setup/);
  assert.match(brief, /CCC unusual-options flow/);
  assert.match(brief, /status: "CREATOR_ONLY"/);
});

test("Live keeps the verification brief in the handoff without rendering the StockedUp module", () => {
  assert.doesNotMatch(overview, /StockedUpEvidenceBoard/);
  assert.doesNotMatch(dossier, /StockedUpEvidenceBoard/);
  assert.match(route, /stockedUpEvidenceBrief/);
  assert.match(route, /getStockedUpEvidenceBrief/);
});
