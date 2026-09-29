import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("Overview exposes the canonical Dossier expected-vs-actual investigation", () => {
  assert.match(
    overview,
    /const reasoningInvestigation = dossierSelection\.presentation\?\.watchNext\[0\] \|\| null;/,
  );
  assert.match(overview, /title="Expected vs actual"/);
  assert.match(overview, />What changed</);
  assert.match(overview, />Expected</);
  assert.match(overview, />Actual</);
  assert.match(overview, />Biggest contradiction</);
  assert.match(overview, />Current explanation</);
  assert.match(overview, />Candidate mechanisms</);
  assert.match(overview, /candidateExplanations\.slice\(0, 3\)/);
  assert.match(overview, />Investigate next</);
});

test("Overview reasoning remains a read-only projection of Dossier V2", () => {
  assert.match(overview, /getDossierV2PresentationSelection\(\)/);
  assert.doesNotMatch(overview, /executeResearchBrain|runIntelligenceEngine|buildSystem1DivergenceCandidates/);
});
