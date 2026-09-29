import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

test("Challenger context is optional and cannot stop evidence-valid hypotheses", () => {
  assert.match(runtime, /const reviewed = hypotheses;/);
  assert.match(runtime, /continued without Challenger context/);
  assert.doesNotMatch(runtime, /Challenger returned no valid hypothesis assessments; no Story was synthesized/);
  assert.match(runtime, /const primaryChallenger = challengerByHypothesis\.get\(candidate\.primaryHypothesisId\) \?\? null/);
  assert.match(runtime, /if \(!primaryHypothesis\) \{/);
  assert.doesNotMatch(runtime, /if \(!primaryHypothesis \|\| !primaryChallenger\)/);
});

test("canonical Story reasoning accepts a missing Challenger without inventing a countercase", () => {
  assert.match(runtime, /challenger: ChallengerRow \| null/);
  assert.match(runtime, /challenger: context\.challenger \? \{/);
  assert.match(runtime, /\} : null,/);
  assert.match(runtime, /if \(context\.challenger && context\.challenger\.hypothesisId !== context\.hypothesis\.id\)/);
});
