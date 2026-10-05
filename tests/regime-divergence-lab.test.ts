import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Regime LIVE uses the shared Divergence Lab presentation classifier", () => {
  const workspace = source("../components/live-desk/RegimeDetailWorkspace.tsx");
  const projection = source("../lib/regime-divergence-lab.ts");

  assert.match(workspace, /buildRegimeDivergenceLabCases/);
  assert.match(projection, /buildDivergenceLabPresentation/);
  assert.match(workspace, /Divergence Lab — candidate mechanisms/);
  assert.match(workspace, /lab\.mode === "full"/);
  assert.match(workspace, /lab\.candidates\.map/);
  assert.match(workspace, /candidate\.confidence/);
  assert.match(workspace, /candidate\.evidenceForRefs\.length/);
  assert.match(workspace, /candidate\.evidenceAgainstRefs\.length/);
  assert.match(workspace, /candidate\.displayDiscriminator/);
  assert.match(workspace, /lab\.mode === "compact_unresolved"/);
  assert.match(workspace, /Mechanism unresolved/);
  assert.doesNotMatch(workspace, /item\.candidateExplanations\.map/);
});
