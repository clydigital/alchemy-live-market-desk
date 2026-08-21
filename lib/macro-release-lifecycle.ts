export const MACRO_RELEASE_LIFECYCLE_STATUSES = [
  "scheduled",
  "pre_release",
  "released_pending_ingestion",
  "ingestion_pending",
  "completed",
  "revision_detected",
  "stale_error",
] as const;

export type MacroReleaseLifecycleStatus = (typeof MACRO_RELEASE_LIFECYCLE_STATUSES)[number];

type MacroReleaseLike = {
  release_date: string;
  status: string;
  actual: string | null;
  last_ingestion_attempt_at?: string | null;
  ingestion_gap_reason?: string | null;
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

function validTimestamp(value: string | null | undefined) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

export function deriveMacroReleaseLifecycle(
  release: MacroReleaseLike,
  now = new Date(),
  ingestionGraceMs = DEFAULT_MACRO_INGESTION_GRACE_MS,
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
  if (Math.abs(remaining) <= ingestionGraceMs) {
    return {
      status: "released_pending_ingestion",
      ingestionGap: true,
      ingestionGapReason: release.ingestion_gap_reason
        || "The release window has passed and the official Actual is still inside the normal ingestion grace period.",
    };
  }

  // Time passing is not an ingestion error. Only call a release stale/error when
  // an ingestion attempt actually ran and still failed to persist an Actual.
  if (!validTimestamp(release.last_ingestion_attempt_at)) {
    return {
      status: "ingestion_pending",
      ingestionGap: true,
      ingestionGapReason: "No official-Actual ingestion attempt is recorded for this past release. The value is pending collection, not a confirmed ingestion error.",
    };
  }

  return {
    status: "stale_error",
    ingestionGap: true,
    ingestionGapReason: release.ingestion_gap_reason
      || "An official-Actual ingestion attempt was recorded but no verified Actual is stored beyond the post-release grace window.",
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
