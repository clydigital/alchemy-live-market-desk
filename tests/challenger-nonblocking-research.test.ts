import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

test("Challenger is outside the active Research Brain path", () => {
  assert.match(runtime, /Challenger is intentionally outside the active Research Brain path/);
  assert.match(runtime, /const challengerByHypothesis = new Map<string, ChallengerRow>\(\)/);
  assert.doesNotMatch(runtime, /const challengerStage = await modelStage<ChallengerOutput>/);
  assert.doesNotMatch(runtime, /stageKey: "challenger",\s*modelKind:/);
  assert.doesNotMatch(runtime, /const researchRequirements = await loadStoryRequirements/);
});

test("Scenario and Story Synthesis receive hypotheses directly", () => {
  assert.match(runtime, /stageKey: "scenario"[\s\S]*input: \{ hypotheses: reviewed, evidence: reasoningEvidence \}/);
  assert.match(runtime, /stageKey: "story_synthesis"[\s\S]*hypotheses: reviewed,[\s\S]*scenarios: scenarioRows/);

  const scenarioStart = runtime.indexOf('stageKey: "scenario"');
  const scenarioEnd = runtime.indexOf("const scenarioRows", scenarioStart);
  assert.ok(scenarioStart >= 0 && scenarioEnd > scenarioStart);
  assert.doesNotMatch(runtime.slice(scenarioStart, scenarioEnd), /challenger:/);

  const synthesisStart = runtime.indexOf('stageKey: "story_synthesis"');
  const synthesisEnd = runtime.indexOf("const reviewedById", synthesisStart);
  assert.ok(synthesisStart >= 0 && synthesisEnd > synthesisStart);
  assert.doesNotMatch(runtime.slice(synthesisStart, synthesisEnd), /challenger:/);
});

test("legacy canonical Story reasoning still accepts nullable Challenger metadata", () => {
  assert.match(runtime, /challenger: ChallengerRow \| null/);
  assert.match(runtime, /challenger: context\.challenger \? \{/);
  assert.match(runtime, /\} : null,/);
  assert.match(runtime, /if \(context\.challenger && context\.challenger\.hypothesisId !== context\.hypothesis\.id\)/);
});

test("canonical evidence metadata does not imply mandatory Challenger review", () => {
  assert.match(runtime, /Decisive evidence selected by the Alchemy intelligence runtime for the canonical Story/);
  assert.doesNotMatch(runtime, /after Challenger review/);
});
