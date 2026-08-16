export type ScheduledContinuationRun = {
  id: string;
  status: string;
  accuracy_gate: string | null;
  source_checks: unknown;
  warnings: string[] | null;
  summary: string | null;
  updates_published: number | null;
  updated_at: string;
};

export type ScheduledContinuationState =
  | "missing"
  | "acquisition_pending"
  | "ready"
  | "intelligence_running"
  | "completed"
  | "terminal";

export type ScheduledContinuationDecision = {
  state: ScheduledContinuationState;
  reason: string;
};

export const INTELLIGENCE_CONTINUATION_CLAIM_PREFIX =
  "[orchestration] intelligence continuation claimed at ";

export const INTELLIGENCE_CONTINUATION_CLAIM_STALE_MS = 6 * 60 * 1_000;

function nonEmptySourceChecks(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export function latestIntelligenceContinuationClaimAt(warnings: string[] | null | undefined) {
  const claims = (warnings ?? [])
    .filter((warning) => warning.startsWith(INTELLIGENCE_CONTINUATION_CLAIM_PREFIX))
    .map((warning) => Date.parse(warning.slice(INTELLIGENCE_CONTINUATION_CLAIM_PREFIX.length)))
    .filter(Number.isFinite);
  return claims.length ? Math.max(...claims) : null;
}

export function intelligenceContinuationClaimWarning(now = new Date()) {
  return `${INTELLIGENCE_CONTINUATION_CLAIM_PREFIX}${now.toISOString()}`;
}

export function evaluateScheduledIntelligenceContinuation(
  run: ScheduledContinuationRun | null,
  now = new Date(),
): ScheduledContinuationDecision {
  if (!run) {
    return { state: "missing", reason: "The canonical research run has not been claimed yet." };
  }
  if (run.status === "completed") {
    return { state: "completed", reason: "The canonical research run is already completed." };
  }
  if (run.status === "blocked" || run.status === "failed") {
    return { state: "terminal", reason: `The canonical research run is already ${run.status}.` };
  }
  if (run.status !== "running") {
    return { state: "terminal", reason: `The canonical research run has unsupported status ${run.status}.` };
  }
  if (!nonEmptySourceChecks(run.source_checks)) {
    return {
      state: "acquisition_pending",
      reason: "The scheduled acquisition hand-off has not persisted source checks yet.",
    };
  }

  const claimedAt = latestIntelligenceContinuationClaimAt(run.warnings);
  if (claimedAt !== null && now.getTime() - claimedAt < INTELLIGENCE_CONTINUATION_CLAIM_STALE_MS) {
    return {
      state: "intelligence_running",
      reason: "A recent intelligence continuation claim is already active.",
    };
  }
  return { state: "ready", reason: "Persisted acquisition is ready for canonical intelligence." };
}

export function mergeScheduledWarnings(...groups: Array<string[] | null | undefined>) {
  return [...new Set(groups.flatMap((group) => group ?? []).filter(Boolean))];
}

export function finalScheduledResearchStatus(
  accuracyGate: string | null,
  intelligenceStatus: string | null | undefined,
): "completed" | "blocked" | "failed" {
  if (intelligenceStatus === "failed") return "failed";
  if (intelligenceStatus !== "completed") return "blocked";
  return accuracyGate === "blocked" ? "blocked" : "completed";
}
