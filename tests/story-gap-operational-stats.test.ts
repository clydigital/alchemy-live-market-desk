import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/stories/page.tsx", import.meta.url), "utf8");
const registry = readFileSync(new URL("../components/live-desk/StoriesRegistry.tsx", import.meta.url), "utf8");

test("Stories exposes actionable reasoning, evidence and catalyst gap counts", () => {
  assert.match(page, /label: "Reasoning gaps"/);
  assert.match(page, /label: "Thin evidence rooms"/);
  assert.match(page, /label: "Catalysts needing review"/);
  assert.match(page, /evidenceCoverage\?\.source_count/);
  assert.match(page, /evidenceCoverage\?\.tier1_source_count/);
  assert.match(page, /evidenceCoverage\?\.unresolved_count/);
  assert.match(page, /evidenceCoverage\?\.gate_score/);
});

test("Story gap filters remain read-only operational views", () => {
  assert.match(registry, /"Reasoning gaps"/);
  assert.match(registry, /"Evidence thin"/);
  assert.match(registry, /"Catalyst review"/);
  assert.match(registry, /story\.maturity !== "reasoning_gap"/);
  assert.match(registry, /story\.evidenceRoom !== "thin"/);
  assert.match(registry, /!story\.catalystRecalibrationRequired/);
  assert.match(registry, /Reasoning gap:/);
  assert.match(registry, /Evidence thin:/);
  assert.doesNotMatch(registry, /fetch\(|recalibrate_story|story_maintenance|research_gap_cycle/);
});
