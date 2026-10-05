import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(
  path.join(root, "lib", "intelligence", "runtime.ts"),
  "utf8",
);

test("P2.2b persists divergence recruitment only after canonical Hypothesis output", () => {
  const hypothesisPersist = runtime.indexOf("const hypotheses = await persistHypotheses(");
  const recruitmentPlan = runtime.indexOf(
    "const divergenceRecruitment = planDivergenceEvidenceRecruitment",
    hypothesisPersist,
  );
  const scenarioStage = runtime.indexOf('stageKey: "scenario"', recruitmentPlan);

  assert.notEqual(hypothesisPersist, -1);
  assert.ok(recruitmentPlan > hypothesisPersist);
  assert.ok(scenarioStage > recruitmentPlan);
});

test("P2.2b uses stable research_debt persistence without provider or Research Gap execution", () => {
  assert.match(runtime, /async function persistDivergenceEvidenceRecruitment/);
  assert.match(runtime, /debt_key: plan\.debtKey/);
  assert.match(runtime, /kind: "canonical_divergence_recruitment"/);
  assert.match(runtime, /evidenceNeeded: plan\.evidenceNeeded/);
  assert.match(runtime, /status: "open"/);
  assert.match(runtime, /next_check_at: input\.analysisAsOf/);

  const start = runtime.indexOf("async function persistDivergenceEvidenceRecruitment");
  const end = runtime.indexOf("async function applyStoryReevaluationQueueHygiene", start);
  assert.ok(start >= 0 && end > start);

  const section = runtime.slice(start, end);
  assert.doesNotMatch(section, /fetch\(/);
  assert.doesNotMatch(section, /runStructuredStage|modelStage/);
  assert.doesNotMatch(section, /research-gap\/run-one|research-gap\/handoff/);
});

test("P2.2b dry runs plan and warn but cannot write research debt", () => {
  assert.match(
    runtime,
    /if \(divergenceRecruitment\.length\) \{[\s\S]*if \(!dryRun\) \{[\s\S]*persistDivergenceEvidenceRecruitment/,
  );
});

test("P2.2b adds no acquisition adapter or new model stage", () => {
  assert.doesNotMatch(
    runtime,
    /stageKey:\s*"(?:divergence_research|divergence_recruitment|evidence_recruitment)"/,
  );
  assert.doesNotMatch(runtime, /Brave|Tavily|Exa|Firecrawl/);
});
