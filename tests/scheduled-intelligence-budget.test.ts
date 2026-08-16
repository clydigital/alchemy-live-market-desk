import assert from "node:assert/strict";
import test from "node:test";

import {
  SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS,
  SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS,
  SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS,
  scheduledStageRequestTimeoutMs,
  scheduledStageTimeoutFailure,
} from "../lib/intelligence/scheduled-runtime-budget.ts";

test("scheduled intelligence assigns complex stages materially larger request budgets", () => {
  const executionStartedAtMs = 1_000_000;
  const marketBeliefBudget = scheduledStageRequestTimeoutMs("market_belief", {
    executionStartedAtMs,
    nowMs: executionStartedAtMs,
  });
  const hypothesisBudget = scheduledStageRequestTimeoutMs("hypothesis", {
    executionStartedAtMs,
    nowMs: executionStartedAtMs,
  });
  const challengerBudget = scheduledStageRequestTimeoutMs("challenger", {
    executionStartedAtMs,
    nowMs: executionStartedAtMs,
  });
  const scenarioBudget = scheduledStageRequestTimeoutMs("scenario", {
    executionStartedAtMs,
    nowMs: executionStartedAtMs,
  });

  assert.equal(marketBeliefBudget, 14_000);
  assert.equal(hypothesisBudget, 34_000);
  assert.ok(hypothesisBudget > marketBeliefBudget * 2);
  assert.ok(challengerBudget > marketBeliefBudget * 2);
  assert.ok(scenarioBudget > marketBeliefBudget * 2);
});

test("scheduled intelligence stage budgets stay inside the global route deadline", () => {
  assert.equal(SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS, 180_000);
  assert.ok(
    SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS +
      SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS <=
      SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS,
  );
  assert.ok(SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS < 300_000);

  const executionStartedAtMs = 1_000_000;
  assert.equal(
    scheduledStageRequestTimeoutMs("hypothesis", {
      executionStartedAtMs,
      nowMs: executionStartedAtMs + 249_000,
    }),
    1_000,
  );
  assert.throws(
    () =>
      scheduledStageRequestTimeoutMs("hypothesis", {
        executionStartedAtMs,
        nowMs: executionStartedAtMs + 250_000,
      }),
    /deadline exhausted before stage "hypothesis"; 0ms remained after finalisation reserve/,
  );
});

test("scheduled timeout reporting identifies the failed stage and its allotted budget", () => {
  assert.equal(
    scheduledStageTimeoutFailure("hypothesis", 34_000),
    'Intelligence stage "hypothesis" timed out after its 34000ms allotted budget.',
  );
});
