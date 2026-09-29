import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Regime LIVE preserves structured Divergence Lab candidate mechanisms", () => {
  const workspace = source("../components/live-desk/RegimeDetailWorkspace.tsx");

  assert.match(workspace, /Divergence Lab — candidate mechanisms/);
  assert.match(workspace, /item\.candidateExplanations\.map/);
  assert.match(workspace, /candidate\.confidence/);
  assert.match(workspace, /candidate\.evidenceForRefs\.length/);
  assert.match(workspace, /candidate\.evidenceAgainstRefs\.length/);
  assert.match(workspace, /candidate\.discriminatingTest/);
  assert.match(workspace, /item\.competingExplanations\.length/);
});
