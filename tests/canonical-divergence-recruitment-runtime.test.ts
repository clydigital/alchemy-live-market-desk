import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const worker = fs.readFileSync(path.join(root, "lib", "research-gap-worker.ts"), "utf8");

test("P2.2 decides unresolved recruitment only after persisted Hypothesis output exists", () => {
  const hypothesisPersist = runtime.indexOf("const hypotheses = await persistHypotheses(");
  const recruitmentPlan = runtime.indexOf("const divergenceRecruitment = planDivergenceEvidenceRecruitment", hypothesisPersist);
  const scenarioStage = runtime.indexOf('stageKey: "scenario"', recruitmentPlan);

  assert.notEqual(hypothesisPersist, -1);
  assert.ok(recruitmentPlan > hypothesisPersist);
  assert.ok(scenarioStage > recruitmentPlan);
});

test("P2.2 opens stable research debt instead of fetching evidence inside the intelligence invocation", () => {
  assert.match(runtime, /persistDivergenceEvidenceRecruitment/);
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
});

test("P2.2 dry runs report the plan but do not persist recruitment debt", () => {
  assert.match(
    runtime,
    /if \(divergenceRecruitment\.length\) \{[\s\S]*if \(!dryRun\) \{[\s\S]*persistDivergenceEvidenceRecruitment/,
  );
});

test("P2.2 existing Research Gap worker is the only acquisition handoff", () => {
  assert.match(worker, /\.from\("research_debt"\)/);
  assert.match(worker, /\.like\("debt_key", "divergence:%"\)/);
  assert.match(worker, /canonical_divergence_recruitment/);
  assert.match(worker, /sourceKind: "research_gap"/);
  assert.match(worker, /DIVERGENCE:/);
  assert.match(worker, /BELIEF:/);

  assert.doesNotMatch(runtime, /research-gap\/run-one/);
  assert.doesNotMatch(runtime, /research-gap\/handoff/);
  assert.doesNotMatch(runtime, /Brave|Tavily|Exa|Firecrawl/);
});

test("P2.2 adds no model stage, provider adapter, or schema migration", () => {
  assert.doesNotMatch(
    runtime,
    /stageKey:\s*"(?:divergence_research|divergence_recruitment|evidence_recruitment)"/,
  );

  const planner = fs.readFileSync(
    path.join(root, "lib", "intelligence", "divergence-evidence-recruitment.ts"),
    "utf8",
  );
  assert.doesNotMatch(planner, /fetch\(|supabase|intelligenceRest|runStructuredStage|modelStage/i);
});
