import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

test("Hypothesis persistence enforces minimum reasoning integrity without score thresholds", () => {
  assert.match(runtime, /Minimum reasoning integrity\. This is deliberately binary rather than a/);
  assert.match(runtime, /evidenceFor\.length === 0/);
  assert.match(runtime, /causalChain\.length === 0/);
  assert.match(runtime, /confirmationCriteria\.length === 0/);
  assert.match(runtime, /invalidationCriteria\.length === 0/);
  assert.match(runtime, /!question/);
  assert.match(runtime, /!causalMechanism/);
  assert.match(runtime, /causalChain\.some\(\(edge\) => !edge\.from \|\| !edge\.relationship \|\| !edge\.to\)/);
  assert.match(runtime, /edge\.evidenceState === "observed" \|\| edge\.evidenceState === "strongly_supported"/);
  assert.doesNotMatch(runtime, /MIN_HYPOTHESIS_CONFIDENCE|MIN_HYPOTHESIS_SCORE|hypothesis\.confidence\s*[<>]=?/);
});

test("failed Hypothesis integrity is visible and does not poison valid siblings", () => {
  assert.match(runtime, /const specs = output\.hypotheses\.flatMap/);
  assert.match(runtime, /\) return \[\];/);
  assert.match(runtime, /rejectedHypothesisCount/);
  assert.match(runtime, /failed minimum reasoning integrity: supporting evidence, causal path, central question, confirmation and invalidation are required/);
});

test("persisted Hypothesis uses normalized causal and falsification fields", () => {
  assert.match(runtime, /const question = hypothesis\.question\.trim\(\)/);
  assert.match(runtime, /const causalMechanism = hypothesis\.causalMechanism\.trim\(\)/);
  assert.match(runtime, /confirmation_criteria: confirmationCriteria/);
  assert.match(runtime, /invalidation_criteria: invalidationCriteria/);
  assert.match(runtime, /causal_mechanism: causalMechanism/);
  assert.match(runtime, /causal_chain: causalChain/);
});
