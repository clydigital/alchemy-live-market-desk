export const LEGACY_TRANSCRIPT_PLACEHOLDER = "New monitored creator video discovered; transcript collection and claim verification are pending.";

export const TRANSCRIPT_WORKER_CREATORS = new Set([
  "StockedUp",
  "Wall Street Truthbombs",
  "Traders Reality",
  "Kevin Gerrity",
  "ClearValue Tax",
  "FX Evolution",
]);

export type TranscriptJobStatus = "pending" | "running" | "retryable" | "blocked" | "completed" | "failed";

export type TranscriptJobStateRow = {
  status: string;
  publisher: string;
  url: string;
  external_id?: string | null;
  summary: string;
  transcript_status: "ready" | "missing" | "unavailable" | "not_applicable";
  transcript_error_code?: string | null;
  transcript_attempt_count?: number | null;
  video_review_status?: string | null;
  transcript_job_status?: TranscriptJobStatus | null;
  transcript_lease_expires_at?: string | null;
  transcript_next_attempt_at?: string | null;
};

export function isLegacyClaimableTranscriptPlaceholder(row: TranscriptJobStateRow) {
  return row.status === "blocked"
    && row.transcript_status === "missing"
    && !row.transcript_error_code
    && (row.transcript_attempt_count ?? 0) === 0
    && !row.video_review_status
    && row.summary === LEGACY_TRANSCRIPT_PLACEHOLDER
    && TRANSCRIPT_WORKER_CREATORS.has(row.publisher)
    && /^[A-Za-z0-9_-]{11}$/.test(row.external_id ?? "")
    && /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:[&#].*)?$/.test(row.url);
}

export function effectiveTranscriptJobStatus(row: TranscriptJobStateRow, now = new Date()): TranscriptJobStatus {
  if (row.transcript_job_status === "running") {
    const expiresAt = Date.parse(row.transcript_lease_expires_at ?? "");
    return Number.isFinite(expiresAt) && expiresAt <= now.getTime() ? "retryable" : "running";
  }
  if (row.transcript_job_status === "pending") {
    const availableAt = Date.parse(row.transcript_next_attempt_at ?? "");
    return !Number.isFinite(availableAt) || availableAt <= now.getTime() ? "pending" : "retryable";
  }
  if (row.transcript_job_status) {
    if (row.transcript_job_status === "blocked" && isLegacyClaimableTranscriptPlaceholder(row)) return "pending";
    return row.transcript_job_status;
  }
  return isLegacyClaimableTranscriptPlaceholder(row) ? "pending" : "blocked";
}
