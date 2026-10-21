import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { decideEditorialStage } from "../lib/intelligence/editorial-stage-gate.ts";

test("a successful Dossier model stage cannot launch a second editorial model", () => {
  assert.deepEqual(decideEditorialStage({
    dossierModelWasUsed: true,
    oneModelStage: true,
    invokedModelStage: "dossier_storyline_composer",
  }), { permitted: false, reason: "DOSSIER_MODEL_ALREADY_USED" });
  assert.equal(decideEditorialStage({
    dossierModelWasUsed: true,
    oneModelStage: false,
    invokedModelStage: null,
  }).permitted, false);
});
test("a resumed invocation cannot spend the prior model slot twice", () => {
  assert.deepEqual(decideEditorialStage({
    dossierModelWasUsed: false,
    oneModelStage: true,
    invokedModelStage: "story_synthesis",
  }), { permitted: false, reason: "INVOCATION_MODEL_ALREADY_USED" });
  assert.deepEqual(decideEditorialStage({
    dossierModelWasUsed: false,
    oneModelStage: true,
    invokedModelStage: "dossier_storyline_composer",
  }), { permitted: false, reason: "INVOCATION_MODEL_ALREADY_USED" });
});
test("a quiet zero-manifest Dossier edition may use its one available model call", () => {
  assert.deepEqual(decideEditorialStage({
    dossierModelWasUsed: false,
    oneModelStage: true,
    invokedModelStage: null,
  }), { permitted: true, reason: "AVAILABLE" });
  assert.equal(decideEditorialStage({
    dossierModelWasUsed: false,
    oneModelStage: true,
    invokedModelStage: "market_editorial_composer",
  }).permitted, true);
});
test("canonical publication checks the gate before calling the frozen article composer", () => {
  const source=readFileSync(new URL("../lib/intelligence/canonical-journey-edition.ts",import.meta.url),"utf8");
  const gate=source.indexOf("const editorialStage = decideEditorialStage");
  const eligible=source.indexOf("if (!dossierHasModelCandidates && editorialStage.permitted)");
  const call=source.indexOf("marketEditorial = await composeFrozenMarketEditorial");
  assert.ok(gate > 0 && eligible > gate && call > eligible);
  assert.match(source,/const combinedRunner:/);
  assert.match(source,/const response = await runStructuredStage<T & ModelEditorialOutput>\(augmented\)/);
  assert.match(source,/!dossierHasModelCandidates && editorialStage\.permitted/);
  assert.match(source,/dossierModelWasUsed: Boolean\(composed\.model\)/);
  assert.match(source,/invokedModelStage: invocation\?\.invokedModelStage \?\? null/);
  assert.match(source,/Market editorial model omitted:/);
  assert.match(source,/edition_phase: "composed"/);
  assert.doesNotMatch(source,/update\s+public\.hybrid_publication_snapshots/i);
});
