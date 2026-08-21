export const MACRO_RELEASE_LIFECYCLE_STATUSES = [
  "scheduled",
  "pre_release",
  "ingestion_pending",
  "released_pending_ingestion",
  "completed",
  "revision_detected",
  "stale_error",
] as const;

export type MacroReleaseLifecycleStatus = (typeof MACRO_RELEASE_LIFECYCLE_STATUSES)[number];

type MacroReleaseLike = {
  release_date: string;
  status: string;
  actual: string | null;
  ingestion_gap_reason?: string | null;
  ingestion_last_attempt_at?: string | null;
  ingestion_attempt_status?: string | null;
  ingestion_retry_exhausted?: boolean | null;
};

export type MacroReleaseLifecycle = {
  status: MacroReleaseLifecycleStatus;
  ingestionGap: boolean;
  ingestionGapReason: string | null;
};

export const DEFAULT_MACRO_INGESTION_GRACE_MS = 4 * 60 * 60 * 1000;

function hasActual(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function deriveMacroReleaseLifecycle(
  release: MacroReleaseLike,
  now = new Date(),
  _ingestionGraceMs = DEFAULT_MACRO_INGESTION_GRACE_MS,
): MacroReleaseLifecycle {
  if (hasActual(release.actual)) {
    return {
      status: release.status === "revision_detected" ? "revision_detected" : "completed",
      ingestionGap: false,
      ingestionGapReason: null,
    };
  }

  const scheduledAt = Date.parse(release.release_date);
  if (!Number.isFinite(scheduledAt)) {
    return {
      status: "stale_error",
      ingestionGap: true,
      ingestionGapReason: "The scheduled release timestamp is invalid; official Actual ingestion cannot be evaluated.",
    };
  }

  const remaining = scheduledAt - now.getTime();
  if (remaining > 24 * 60 * 60 * 1000) {
    return { status: "scheduled", ingestionGap: false, ingestionGapReason: null };
  }
  if (remaining > 0) {
    return { status: "pre_release", ingestionGap: false, ingestionGapReason: null };
  }
  if (!release.ingestion_last_attempt_at) {
    return {
      status: "ingestion_pending",
      ingestionGap: true,
      ingestionGapReason: "The release time passed and no official Actual ingestion attempt is recorded yet.",
    };
  }
  if (release.ingestion_retry_exhausted) {
    return {
      status: "stale_error",
      ingestionGap: true,
      ingestionGapReason: release.ingestion_gap_reason
        || "Verified official Actual ingestion attempts failed and the retry policy is exhausted.",
    };
  }
  return {
    status: "released_pending_ingestion",
    ingestionGap: true,
    ingestionGapReason: release.ingestion_gap_reason
      || "Official Actual ingestion was attempted and remains inside its grace or retry state.",
  };
}

export function withMacroReleaseLifecycle<T extends MacroReleaseLike>(release: T, now = new Date()) {
  const lifecycle = deriveMacroReleaseLifecycle(release, now);
  return {
    ...release,
    status: lifecycle.status,
    ingestion_gap_reason: lifecycle.ingestionGapReason,
  };
}
