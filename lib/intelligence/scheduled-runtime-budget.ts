/** Vercel's configured ceiling for the scheduled Node.js route. */
export const VERCEL_FUNCTION_CEILING_MS = 300_000;

/**
 * Stop intelligence work 15 seconds before the platform limit. The remaining
 * interval is deliberately not a model budget.
 */
export const SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS = 285_000;
export const SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS = 20_000;
export const SCHEDULED_RESEARCH_STAGE_PERSISTENCE_RESERVE_MS = 20_000;
export const SCHEDULED_RESEARCH_PER_STAGE_PERSISTENCE_OVERHEAD_MS = 2_500;

/**
 * These are standalone-intelligence ceilings. Scheduled acquisition now hands
 * off durably before this budget begins, so the complex reasoning stages can
 * use materially longer requests without sharing the provider-acquisition time.
 * The complete nominal model chain remains inside the 285-second route deadline
 * together with persistence and finalisation reserves.
 */
const SCHEDULED_STAGE_TIMEOUT_MS = {
  market_belief: 14_000,
  divergence: 14_000,
  hypothesis: 60_000,
  challenger: 30_000,
  scenario: 30_000,
  story_synthesis: 55_000,
  semantic_deduplication: 12_000,
  lifecycle: 12_000,
} as const;

const MINIMUM_SCHEDULED_STAGE_TIMEOUT_MS = {
  market_belief: 6_000,
  divergence: 6_000,
  hypothesis: 18_000,
  challenger: 15_000,
  scenario: 15_000,
  story_synthesis: 18_000,
  semantic_deduplication: 5_000,
  lifecycle: 5_000,
} as const;

export type ScheduledIntelligenceStage = keyof typeof SCHEDULED_STAGE_TIMEOUT_MS;
export type ScheduledStageBudgetPlan = Record<ScheduledIntelligenceStage, number>;

export type ScheduledStageBudgetController = {
  timeoutFor: (stageKey: string) => number;
  plan: () => ScheduledStageBudgetPlan | null;
};

export const SCHEDULED_INTELLIGENCE_STAGES = Object.keys(
  SCHEDULED_STAGE_TIMEOUT_MS,
) as ScheduledIntelligenceStage[];

export const SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS = Object.values(
  SCHEDULED_STAGE_TIMEOUT_MS,
).reduce((total, timeoutMs) => total + timeoutMs, 0);

export const SCHEDULED_MINIMUM_STAGE_BUDGET_MS = Object.values(
  MINIMUM_SCHEDULED_STAGE_TIMEOUT_MS,
).reduce((total, timeoutMs) => total + timeoutMs, 0);

export class ScheduledIntelligenceDeadlineError extends Error {
  readonly code = "scheduled_deadline_exhausted";
  readonly stageKey: string;
  readonly availableModelMs: number;

  constructor(stageKey: string, availableModelMs: number) {
    super(
      `Scheduled intelligence deadline exhausted before stage "${stageKey}"; ${Math.max(0, availableModelMs)}ms remained after persistence and finalisation reserves.`,
    );
    this.name = "ScheduledIntelligenceDeadlineError";
    this.stageKey = stageKey;
    this.availableModelMs = availableModelMs;
  }
}

function isScheduledIntelligenceStage(stageKey: string): stageKey is ScheduledIntelligenceStage {
  return stageKey in SCHEDULED_STAGE_TIMEOUT_MS;
}

function sum(values: ScheduledStageBudgetPlan) {
  return SCHEDULED_INTELLIGENCE_STAGES.reduce((total, stage) => total + values[stage], 0);
}

function distributeBudget(availableModelMs: number): ScheduledStageBudgetPlan {
  if (availableModelMs >= SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS) {
    return { ...SCHEDULED_STAGE_TIMEOUT_MS };
  }

  const budget: ScheduledStageBudgetPlan = { ...MINIMUM_SCHEDULED_STAGE_TIMEOUT_MS };
  let undistributedMs = availableModelMs - SCHEDULED_MINIMUM_STAGE_BUDGET_MS;
  const expandable = SCHEDULED_INTELLIGENCE_STAGES.map((stage) => ({
    stage,
    capacity: SCHEDULED_STAGE_TIMEOUT_MS[stage] - MINIMUM_SCHEDULED_STAGE_TIMEOUT_MS[stage],
  }));
  const capacityTotal = expandable.reduce((total, item) => total + item.capacity, 0);
  const remainders = expandable.map(({ stage, capacity }) => {
    const proportional = capacity * undistributedMs / capacityTotal;
    const allocation = Math.floor(proportional);
    budget[stage] += allocation;
    return { stage, remainder: proportional - allocation };
  });
  undistributedMs -= sum(budget) - SCHEDULED_MINIMUM_STAGE_BUDGET_MS;
  for (const { stage } of remainders.sort((left, right) => right.remainder - left.remainder)) {
    if (undistributedMs <= 0) break;
    budget[stage] += 1;
    undistributedMs -= 1;
  }
  return budget;
}

export function scheduledStageTimeoutFailure(stageKey: string, allottedMs: number) {
  return `Intelligence stage "${stageKey}" timed out after its ${allottedMs}ms allotted budget.`;
}

/**
 * Builds one bounded allocation for the entire required stage chain. A late
 * handoff shrinks every stage proportionally down to an explicit safe floor,
 * instead of allowing early stages to consume the last request time.
 */
export function scheduledStageBudgetPlan(input: {
  executionStartedAtMs: number;
  nowMs?: number;
  firstStageKey?: string;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const elapsedMs = Math.max(0, nowMs - input.executionStartedAtMs);
  const availableModelMs = SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS
    - SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS
    - SCHEDULED_RESEARCH_STAGE_PERSISTENCE_RESERVE_MS
    - elapsedMs;
  if (availableModelMs < SCHEDULED_MINIMUM_STAGE_BUDGET_MS) {
    throw new ScheduledIntelligenceDeadlineError(input.firstStageKey || "market_belief", availableModelMs);
  }
  return distributeBudget(availableModelMs);
}

/**
 * Retrieves a timeout from an allocation that was already calculated for this
 * engine run. It never recomputes a plan after a completed stage.
 */
export function scheduledStageRequestTimeoutMs(
  stageKey: string,
  plan: ScheduledStageBudgetPlan,
) {
  if (!isScheduledIntelligenceStage(stageKey)) {
    throw new Error(`No scheduled intelligence budget is configured for stage "${stageKey}".`);
  }
  return plan[stageKey];
}

/**
 * Defers the one immutable calculation until the first model stage begins, so
 * any pre-stage loading time is included while the resulting allocation is
 * shared by every later stage in this engine run.
 */
export function createScheduledStageBudgetController(input: {
  executionStartedAtMs: number;
  nowMs?: () => number;
}): ScheduledStageBudgetController {
  let plan: ScheduledStageBudgetPlan | null = null;
  return {
    timeoutFor(stageKey) {
      if (!plan) {
        plan = scheduledStageBudgetPlan({
          executionStartedAtMs: input.executionStartedAtMs,
          nowMs: input.nowMs?.() ?? Date.now(),
          firstStageKey: stageKey,
        });
      }
      return scheduledStageRequestTimeoutMs(stageKey, plan);
    },
    plan: () => plan,
  };
}