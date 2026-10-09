import { normalizeTranscriptApiError } from "./transcriptapi.ts";

export type VideoRetrievalFailureKind =
  | "VIDEO_UNAVAILABLE"
  | "TRANSCRIPT_PROVIDER_FAILED";

const STRUCTURAL_VIDEO_FAILURE_CODES = new Set([
  "video_private",
  "video_deleted",
  "video_not_found",
  "invalid_video_url",
]);

export function classifyVideoRetrievalFailure(error: unknown): VideoRetrievalFailureKind {
  const failure = normalizeTranscriptApiError(error);
  return STRUCTURAL_VIDEO_FAILURE_CODES.has(failure.code)
    ? "VIDEO_UNAVAILABLE"
    : "TRANSCRIPT_PROVIDER_FAILED";
}

export function geminiRescueEligible(error: unknown) {
  return classifyVideoRetrievalFailure(error) === "TRANSCRIPT_PROVIDER_FAILED";
}
