import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Hybrid renders D7 cross-layer checks from the read-only comparator", () => {
  const page = readFileSync(
    new URL("../app/hybrid-output/page.tsx", import.meta.url),
    "utf8",
  );
  const d7 = readFileSync(
    new URL("../lib/dossier-v2/cross-layer-divergence.ts", import.meta.url),
    "utf8",
  );

  assert.match(page, /buildD7CrossLayerDivergence/);
  assert.match(page, /title="Cross-layer checks"/);
  assert.match(page, /crossLayerDivergence\.summary\.CONTRADICTION/);
  assert.match(page, /crossLayerDivergence\.summary\.LAG/);
  assert.match(page, /Research eligible/);
  assert.match(page, /read-only/);

  assert.doesNotMatch(
    [page, d7].join("\n"),
    /intelligence_reevaluation_queue.*insert|story_thesis_versions.*insert/i,
  );
  assert.doesNotMatch(
    page,
    /syncLatestPrioritisedResearchGapCases|syncResearchGapPriorityQueue/,
  );
});
