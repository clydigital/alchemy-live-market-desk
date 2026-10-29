import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../components/blue-desk/DecisionBrief.tsx", import.meta.url), "utf8");
test("public home hero exposes recap, market interpretation and forward test", () => {
  assert.match(component, /data-featured-story-sequence="recap-effects-outlook"/);
  assert.match(component, /<h2>What happened<\/h2>/);
  assert.match(component, /<h2>What it means for markets<\/h2>/);
  assert.match(component, /<h2>What comes next<\/h2>/);
  assert.match(component, /lead\.mechanism/);
  assert.match(component, /lead\.test/);
});
test("market effect language does not invent an observed reaction", () => {
  assert.match(component, /not a verified price reaction/);
  assert.match(component, /lead\.status==='UPCOMING'/);
  assert.match(component, /<DualTimestamp value=\{lead\.at\.includes\('T'\)\?lead\.at:null\} sourceDate=\{lead\.at\}\/>/);
});
