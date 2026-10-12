import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const component=readFileSync(new URL("../components/live-desk/HybridStoryBriefReader.tsx",import.meta.url),"utf8");

test("the reader follows the headline's causal argument, not a generic metric wall", () => {
  const support=component.indexOf("What still supports the view");
  const contradict=component.indexOf("What challenges the view");
  const next=component.indexOf("What would change the view");
  assert.ok(support>0 && contradict>support && next>contradict);
  assert.match(component,/projection\.items\.filter\(item => item\.kind === "SUPPORT"\)/);
  assert.match(component,/projection\.items\.filter\(item => item\.kind === "CHALLENGE"\)/);
  assert.match(component,/projection\.items\.filter\(item => item\.kind === "NEXT_TEST"\)/);
});

test("evidence vintage and factual states cannot be mislabelled", () => {
  assert.match(component,/Existing Dossier evidence/);
  assert.match(component,/Newly cited in this Dossier · not necessarily new today/);
  assert.match(component,/No exact predecessor comparison/);
  assert.match(component,/Watch condition · not an observed market move/);
  assert.match(component,/This is not a fresh source report/);
  assert.match(component,/A Story link or creator lead alone cannot establish support/);
});

test("canonical audit is inspectable and the component does not fetch or create Motion", () => {
  assert.match(component,/Inspect exact Dossier evidence references/);
  assert.match(component,/item\.evidenceRefs\.map/);
  assert.match(component,/Dossier \{projection\.selectedDossierId\}/);
  assert.doesNotMatch(component,/getCurrentMarketMotion|persistMarketMotion|useEffect|runStructuredStage/);
});
