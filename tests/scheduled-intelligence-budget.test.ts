import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS,
  SCHEDULED_INTELLIGENCE_STAGES,
  SCHEDULED_MINIMUM_STAGE_BUDGET_MS,
  SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS,
  SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS,
  SCHEDULED_RESEARCH_PER_STAGE_PERSISTENCE_OVERHEAD_MS,
  SCHEDULED_RESEARCH_STAGE_PERSISTENCE_RESERVE_MS,
  ScheduledIntelligenceDeadlineError,
  VERCEL_FUNCTION_CEILING_MS,
  createScheduledStageBudgetController,
  scheduledStageBudgetPlan,
  scheduledStageRequestTimeoutMs,
  scheduledStageTimeoutFailure,
} from "../lib/intelligence/scheduled-runtime-budget.ts";

test("production-informed standalone intelligence protects fast stages while keeping hypothesis dominant", () => {
  const executionStartedAtMs = 1_000_000;
  const plan = scheduledStageBudgetPlan({ executionStartedAtMs, nowMs: executionStartedAtMs });
  const marketBeliefBudget = scheduledStageRequestTimeoutMs("market_belief", plan);
  const divergenceBudget = scheduledStageRequestTimeoutMs("divergence", plan);
  const hypothesisBudget = scheduledStageRequestTimeoutMs("hypothesis", plan);
  const challengerBudget = scheduledStageRequestTimeoutMs("challenger", plan);
  const scenarioBudget = scheduledStageRequestTimeoutMs("scenario", plan);
  const synthesisBudget = scheduledStageRequestTimeoutMs("story_synthesis", plan);

  assert.equal(marketBeliefBudget, 20_000);
  assert.equal(divergenceBudget, 15_000);
  assert.equal(hypothesisBudget, 105_000);
  assert.equal(challengerBudget, 20_000);
  assert.equal(scenarioBudget, 20_000);
  assert.equal(synthesisBudget, 40_000);
  assert.ok(hypothesisBudget > marketBeliefBudget * 5);
  assert.ok(synthesisBudget >= marketBeliefBudget * 2);
});

test("standalone scheduled intelligence stage budgets stay inside the global route deadline", () => {
  assert.equal(SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS, 240_000);
  assert.equal(
    SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS +
      SCHEDULED_RESEARCH_STAGE_PERSISTENCE_RESERVE_MS +
      SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS,
    280_000,
  );
  assert.ok(
    SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS +
      SCHEDULED_RESEARCH_STAGE_PERSISTENCE_RESERVE_MS +
      SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS <
      SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS,
  );
  assert.ok(SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS < VERCEL_FUNCTION_CEILING_MS);

  const executionStartedAtMs = 1_000_000;
  const plan = scheduledStageBudgetPlan({ executionStartedAtMs, nowMs: executionStartedAtMs });
  const modelBudget = Object.values(plan).reduce((total, budget) => total + budget, 0);
  assert.equal(modelBudget, SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS);
});

test("provider layer no longer silently clamps a scheduled stage back to 60 seconds", () => {
  const openai = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");
  assert.match(openai, /MAX_STAGE_REQUEST_TIMEOUT_MS = 240_000/);
  assert.match(openai, /boundedInteger\(requestTimeoutMs, 60_000, 1_000, MAX_STAGE_REQUEST_TIMEOUT_MS\)/);
});

test("a legacy 125-second handoff preserves observed fast-stage latency floors", () => {
  const executionStartedAtMs = 1_000_000;
  const controller = createScheduledStageBudgetController({
    executionStartedAtMs,
    nowMs: () => executionStartedAtMs + 125_000,
  });
  let elapsedMs = 125_000;
  let initialPlan: ReturnType<typeof controller.plan> = null;

  for (const stage of SCHEDULED_INTELLIGENCE_STAGES) {
    const budget = controller.timeoutFor(stage);
    if (!initialPlan) initialPlan = controller.plan();
    assert.equal(controller.plan(), initialPlan, "completed stages must not trigger a new all-stage allocation");
    assert.equal(budget, initialPlan?.[stage]);
    elapsedMs += budget + SCHEDULED_RESEARCH_PER_STAGE_PERSISTENCE_OVERHEAD_MS;
  }

  const plan = controller.plan();
  assert.ok(plan);
  assert.ok(plan.market_belief >= 14_000);
  assert.ok(plan.divergence >= 11_000);
  assert.ok(plan.hypothesis >= 36_000);
  assert.ok(plan.story_synthesis >= 21_000);
  for (const stage of SCHEDULED_INTELLIGENCE_STAGES) {
    assert.ok(plan[stage] >= 5_000, `${stage} lost its meaningful model budget`);
  }
  assert.equal(Object.values(plan).reduce((total, budget) => total + budget, 0), 120_000);
  assert.equal(
    SCHEDULED_RESEARCH_PER_STAGE_PERSISTENCE_OVERHEAD_MS * SCHEDULED_INTELLIGENCE_STAGES.length,
    SCHEDULED_RESEARCH_STAGE_PERSISTENCE_RESERVE_MS,
  );
  assert.equal(
    elapsedMs + SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS,
    SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS,
  );
  assert.ok(elapsedMs + SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS < VERCEL_FUNCTION_CEILING_MS);
});

test("a global deadline exhaustion is deterministic and identifies the stage", () => {
  const executionStartedAtMs = 1_000_000;
  const controller = createScheduledStageBudgetController({
    executionStartedAtMs,
    nowMs: () => executionStartedAtMs + 178_000,
  });
  assert.throws(
    () => controller.timeoutFor("hypothesis"),
    (error: unknown) => error instanceof ScheduledIntelligenceDeadlineError
      && error.code === "scheduled_deadline_exhausted"
      && error.stageKey === "hypothesis"
      && /deadline exhausted before stage "hypothesis"/.test(error.message),
  );
  assert.equal(SCHEDULED_MINIMUM_STAGE_BUDGET_MS, 109_000);
});

test("runtime persists an exhausted scheduled deadline with its deterministic code", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.match(runtime, /error instanceof ScheduledIntelligenceDeadlineError\s*\? error\.code/);
  assert.match(runtime, /failureCode: code/);
});

test("scheduled timeout reporting identifies the failed stage and its allotted budget", () => {
  assert.equal(
    scheduledStageTimeoutFailure("hypothesis", 105_000),
    'Intelligence stage "hypothesis" timed out after its 105000ms allotted budget.',
  );
});
