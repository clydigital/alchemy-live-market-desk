import type { OilSourceAccessResult, OilSourceAccessStatus } from "./research-gap-oil-source-access.ts";

/**
 * Scheduling advice only. No case transitions, Evidence writes or Story changes.
 * Persisted in the EXISTING Research Gap verdict for later guarded requeue.
 */
export type OilSourceRecovery = {
  contractVersion: "research-gap-oil-source-recovery/1";
  decision: "RETRY_ON_NEW_DOSSIER" | "HOLD_FOR_OPERATOR" | "NO_RETRY";
  reason: "TRANSIENT_ACCESS" | "MISSING_DATED_ORIGINAL" | "RIGHTS_REVIEW"
    | "SOURCE_NOT_ARCHIVABLE" | "ARCHIVED_AWAITING_PARSER"
    | "ATTEMPT_CAP" | "DIRECTION_RESOLVED" | "INVALID_DIAGNOSTICS";
  attemptCount: number;
  nextEligibleAt: string | null;
  /** Bounded operational source states, never evidence or original bytes. */
  statuses: Array<{ benchmark: OilSourceAccessResult["benchmark"]; status: OilSourceAccessStatus }>;
};

const transient = new Set<OilSourceAccessStatus>([
  "RATE_LIMITED", "FETCH_FAILED", "ARCHIVE_FAILED", "NOT_FOUND", "NO_DATED_ORIGINAL_URL",
]);
const rights = new Set<OilSourceAccessStatus>(["AUTH_REQUIRED", "ACCESS_DENIED"]);
const awaitingParser = new Set<OilSourceAccessStatus>(["ARCHIVED_UNVERIFIED"]);
const unarchived = new Set<OilSourceAccessStatus>(["RETRIEVED_UNARCHIVED"]);
const MAX_ATTEMPTS = 3;

export function assessOilSourceRecovery(input: {
  outcome: "CONFIRMING" | "CONTRADICTING" | "UNRESOLVED" | "NO_CHANGE";
  sourceAccess: readonly OilSourceAccessResult[];
  attemptCount: number;
  completedAt: string;
}): OilSourceRecovery {
  const statuses = input.sourceAccess.slice(0, 8).map(({ benchmark, status }) => ({ benchmark, status }));
  const attemptCount = Math.max(0, Math.floor(input.attemptCount));
  const result = (decision: OilSourceRecovery["decision"], reason: OilSourceRecovery["reason"],
    nextEligibleAt: string | null = null): OilSourceRecovery => ({
    contractVersion: "research-gap-oil-source-recovery/1",
    decision, reason, attemptCount, nextEligibleAt, statuses,
  });
  if (input.outcome !== "UNRESOLVED") return result("NO_RETRY", "DIRECTION_RESOLVED");
  if (!statuses.length || !Number.isFinite(Date.parse(input.completedAt)))
    return result("HOLD_FOR_OPERATOR", "INVALID_DIAGNOSTICS");
  if (statuses.some(item => rights.has(item.status))) return result("HOLD_FOR_OPERATOR", "RIGHTS_REVIEW");
  if (statuses.some(item => awaitingParser.has(item.status)))
    return result("HOLD_FOR_OPERATOR", "ARCHIVED_AWAITING_PARSER");
  if (statuses.some(item => unarchived.has(item.status)))
    return result("HOLD_FOR_OPERATOR", "RIGHTS_REVIEW");
  if (statuses.some(item => !transient.has(item.status)))
    return result("HOLD_FOR_OPERATOR", "SOURCE_NOT_ARCHIVABLE");
  if (attemptCount >= MAX_ATTEMPTS) return result("HOLD_FOR_OPERATOR", "ATTEMPT_CAP");

  const missing = statuses.some(item => item.status === "NO_DATED_ORIGINAL_URL" || item.status === "NOT_FOUND");
  // Existing Research Gap runs roughly twice daily; avoid rapid fetch storms.
  // Subsequent retry gaps extend by bounded 12-hour increments.
  const hours = (missing ? 24 : 12) * Math.max(1, attemptCount);
  return result(
    "RETRY_ON_NEW_DOSSIER",
    missing ? "MISSING_DATED_ORIGINAL" : "TRANSIENT_ACCESS",
    new Date(Date.parse(input.completedAt) + hours * 3_600_000).toISOString(),
  );
}
