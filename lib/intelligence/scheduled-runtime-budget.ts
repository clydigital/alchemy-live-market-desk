/**
 * Vercel gives the cron route 300 seconds. Keep the scheduled intelligence
 * path inside 270 seconds and retain 20 seconds for its final persistence and
 * response, leaving a further 30-second platform reserve.
 */
export const SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS = 270_000;
export const SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS = 20_000;

const SCHEDULED_STAGE_TIMEOUT_MS = {
  market_belief: 14_000,
  divergence: 14_000,
  hypothesis: 34_000,
  challenger: 30_000,
  scenario: 30_000,
  story_synthesis: 34_000,
  semantic_deduplication: 12_000,
  lifecycle: 12_000,
} as const;

export type ScheduledIntelligenceStage =
  keyof typeof SCHEDULED_STAGE_TIMEOUT_MS;

export const SCHEDULED_INTELLIGENCE_STAGE_BUDGET_MS = Object.values(
  SCHEDULED_STAGE_TIMEOUT_MS,
).reduce((total, timeoutMs) => total + timeoutMs, 0);

function isScheduledIntelligenceStage(
  stageKey: string,
): stageKey is ScheduledIntelligenceStage {
  return stageKey in SCHEDULED_STAGE_TIMEOUT_MS;
}

export function scheduledStageTimeoutFailure(
  stageKey: string,
  allottedMs: number,
) {
  return `Intelligence stage "${stageKey}" timed out after its ${allottedMs}ms allotted budget.`;
}

/**
 * Selects a per-stage request budget that cannot overrun the scheduled route's
 * execution deadline. Call this immediately before each model request so time
 * already spent on acquisition, persistence, or earlier stages is accounted for.
 */
export function scheduledStageRequestTimeoutMs(
  stageKey: string,
  input: { executionStartedAtMs: number; nowMs?: number },
) {
  if (!isScheduledIntelligenceStage(stageKey)) {
    throw new Error(
      `No scheduled intelligence budget is configured for stage "${stageKey}".`,
    );
  }
  const nowMs = input.nowMs ?? Date.now();
  const elapsedMs = Math.max(0, nowMs - input.executionStartedAtMs);
  const remainingMs =
    SCHEDULED_RESEARCH_EXECUTION_DEADLINE_MS -
    SCHEDULED_RESEARCH_FINALISATION_RESERVE_MS -
    elapsedMs;
  if (remainingMs < 1_000) {
    throw new Error(
      `Scheduled intelligence deadline exhausted before stage "${stageKey}"; ${Math.max(0, remainingMs)}ms remained after finalisation reserve.`,
    );
  }
  return Math.min(SCHEDULED_STAGE_TIMEOUT_MS[stageKey], remainingMs);
}
