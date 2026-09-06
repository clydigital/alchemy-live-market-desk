import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { RATES_RESEARCH_LENS, withRatesResearchLens } from "../lib/intelligence/rates-research-lens.ts";

test("disabled lens preserves every existing stage prompt byte for byte", () => {
  for (const stage of ["market_belief", "divergence", "hypothesis", "challenger", "scenario", "story_synthesis", "deduplication", "lifecycle"]) {
    const original = `Existing ${stage} mandate\nwith schema and evidence constraints.`;
    assert.equal(withRatesResearchLens(original, stage, false), original);
  }
});

test("enabled lens leaves discovery, compatibility and presentation stages untouched", () => {
  for (const stage of ["market_belief", "divergence", "challenger", "deduplication", "lifecycle", "dossier_storyline_composition", "unknown"]) {
    assert.equal(withRatesResearchLens("Original", stage, true), "Original");
  }
  assert.match(withRatesResearchLens("Original", "hypothesis", true), /leave alternative rate scenarios to Scenario/);
  assert.match(withRatesResearchLens("Original", "scenario", true), /distinguish disinflationary easing from recession cuts/);
  const synthesis = withRatesResearchLens("Original", "story_synthesis", true);
  assert.ok(synthesis.startsWith("Original\n\n"));
  assert.ok(!synthesis.includes(RATES_RESEARCH_LENS));
  assert.match(synthesis, /Do not add fresh rates research/);
});

test("runtime compact method stays identical to the reviewed Markdown", () => {
  const doc = readFileSync(new URL("../docs/rates-and-capital-sensitivity.md", import.meta.url), "utf8");
  const block = doc.match(/```text\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(block);
  assert.equal(block[1].replace(/\r\n/g, "\n"), RATES_RESEARCH_LENS);
});
