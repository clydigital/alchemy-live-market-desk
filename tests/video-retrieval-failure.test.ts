import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyVideoRetrievalFailure,
  geminiRescueEligible,
} from "../lib/video-retrieval-failure.ts";
import {
  TranscriptApiError,
  type TranscriptErrorCode,
} from "../lib/transcriptapi.ts";

function failure(code: TranscriptErrorCode) {
  return new TranscriptApiError(`failure:${code}`, {
    code,
    httpStatus: null,
    retryable: false,
  });
}

test("structural video failures are unavailable and never enter Gemini rescue", () => {
  const codes: TranscriptErrorCode[] = [
    "video_private",
    "video_deleted",
    "video_not_found",
    "invalid_video_url",
  ];

  for (const code of codes) {
    assert.equal(classifyVideoRetrievalFailure(failure(code)), "VIDEO_UNAVAILABLE", code);
    assert.equal(geminiRescueEligible(failure(code)), false, code);
  }
});

test("caption and provider failures remain eligible transcript-provider failures", () => {
  const codes: TranscriptErrorCode[] = [
    "transcript_missing",
    "language_unavailable",
    "provider_auth_error",
    "provider_payment_required",
    "provider_rate_limit",
    "provider_server_error",
    "browser_operator_unavailable",
    "browser_verification_required",
    "network_error",
    "timeout",
    "malformed_provider_response",
    "unknown",
  ];

  for (const code of codes) {
    assert.equal(classifyVideoRetrievalFailure(failure(code)), "TRANSCRIPT_PROVIDER_FAILED", code);
    assert.equal(geminiRescueEligible(failure(code)), true, code);
  }
});

test("free-form error wording cannot promote an unknown failure to video unavailable", () => {
  const error = new Error("This might be private, deleted, or members only.");
  assert.equal(classifyVideoRetrievalFailure(error), "TRANSCRIPT_PROVIDER_FAILED");
  assert.equal(geminiRescueEligible(error), true);
});
