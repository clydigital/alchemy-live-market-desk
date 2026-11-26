import assert from "node:assert/strict";
import test from "node:test";

import {
  retrieveTranscriptForWorker,
  transcriptWorkerShouldUseBrowserFallback,
} from "../lib/transcript-worker-retrieval.ts";
import {
  transcriptProviderFromRetrieval,
  TranscriptApiError,
  type TranscriptApiRetrieval,
} from "../lib/transcriptapi.ts";

const VIDEO_ID = "ycw-010tAPA";

function retrieval(provider: "supadata" | "chrome" | "transcriptapi"): TranscriptApiRetrieval {
  const browser = provider === "chrome";
  const transcriptApi = provider === "transcriptapi";
  return {
    info: {
      videoId: VIDEO_ID,
      title: null,
      channel: null,
      authorUrl: null,
      thumbnailUrl: null,
      availableLanguages: [{ code: "en", name: "en" }],
      httpStatus: 200,
    },
    transcript: {
      videoId: VIDEO_ID,
      language: "en",
      segments: [{ startSeconds: 0, durationSeconds: 2, endSeconds: 2, text: "Caption text." }],
      text: "Caption text.",
      durationSeconds: 2,
      metadata: browser
        ? {
          retrievalProvider: "chrome_operator",
          transcriptSource: "youtubetotranscript.com",
          browserVerifiedYouTubePage: true,
        }
        : transcriptApi
          ? {
            retrievalProvider: "transcriptapi",
          }
          : {
            retrievalProvider: "supadata",
            transcriptSource: "native_caption",
            mode: "native",
          },
      httpStatus: 200,
      cacheStatus: null,
    },
  };
}

function providerError(
  code: "provider_rate_limit" | "provider_payment_required" | "transcript_missing",
  retryable: boolean,
) {
  return new TranscriptApiError(code, {
    code,
    httpStatus: code === "provider_payment_required" ? 402 : code === "provider_rate_limit" ? 429 : 206,
    retryable,
  });
}

test("Supadata success stays on the primary provider and does not touch the browser", async () => {
  let browserCalls = 0;
  const result = await retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
    retrieveSupadata: async () => retrieval("supadata"),
    browserConfigured: () => true,
    retrieveBrowser: async () => {
      browserCalls += 1;
      return retrieval("chrome");
    },
  });

  assert.equal(transcriptProviderFromRetrieval(result), "supadata");
  assert.equal(browserCalls, 0);
});

test("Supadata rate limit falls back to the timestamped browser transcript when configured", async () => {
  let browserCalls = 0;
  const result = await retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
    retrieveSupadata: async () => {
      throw providerError("provider_rate_limit", true);
    },
    browserConfigured: () => true,
    retrieveBrowser: async () => {
      browserCalls += 1;
      return retrieval("chrome");
    },
  });

  assert.equal(browserCalls, 1);
  assert.equal(transcriptProviderFromRetrieval(result), "youtubetotranscript.com");
  assert.equal(result.transcript.segments.length, 1);
});

test("Supadata plan exhaustion can use the same browser fallback", async () => {
  const result = await retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
    retrieveSupadata: async () => {
      throw providerError("provider_payment_required", false);
    },
    browserConfigured: () => true,
    retrieveBrowser: async () => retrieval("chrome"),
  });

  assert.equal(transcriptProviderFromRetrieval(result), "youtubetotranscript.com");
});

test("Supadata rate limit falls back to TranscriptAPI when the browser operator is absent", async () => {
  let transcriptApiCalls = 0;
  const result = await retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
    retrieveSupadata: async () => {
      throw providerError("provider_rate_limit", true);
    },
    browserConfigured: () => false,
    retrieveBrowser: async () => retrieval("chrome"),
    transcriptApiConfigured: () => true,
    retrieveTranscriptApi: async () => {
      transcriptApiCalls += 1;
      return retrieval("transcriptapi");
    },
  });

  assert.equal(transcriptApiCalls, 1);
  assert.equal(transcriptProviderFromRetrieval(result), "transcriptapi");
  assert.equal(result.transcript.segments.length, 1);
});

test("a failed browser capacity fallback can still use TranscriptAPI on the same leased job", async () => {
  let transcriptApiCalls = 0;
  const result = await retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
    retrieveSupadata: async () => {
      throw providerError("provider_rate_limit", true);
    },
    browserConfigured: () => true,
    retrieveBrowser: async () => {
      throw new TranscriptApiError("Browser verification required.", {
        code: "browser_verification_required",
        httpStatus: null,
        retryable: true,
      });
    },
    transcriptApiConfigured: () => true,
    retrieveTranscriptApi: async () => {
      transcriptApiCalls += 1;
      return retrieval("transcriptapi");
    },
  });

  assert.equal(transcriptApiCalls, 1);
  assert.equal(transcriptProviderFromRetrieval(result), "transcriptapi");
});

test("unconfigured browser and TranscriptAPI preserve the original Supadata capacity failure", async () => {
  let browserCalls = 0;
  let transcriptApiCalls = 0;
  await assert.rejects(
    retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
      retrieveSupadata: async () => {
        throw providerError("provider_rate_limit", true);
      },
      browserConfigured: () => false,
      retrieveBrowser: async () => {
        browserCalls += 1;
        return retrieval("chrome");
      },
      transcriptApiConfigured: () => false,
      retrieveTranscriptApi: async () => {
        transcriptApiCalls += 1;
        return retrieval("transcriptapi");
      },
    }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "provider_rate_limit"
      && error.httpStatus === 429,
  );
  assert.equal(browserCalls, 0);
  assert.equal(transcriptApiCalls, 0);
});

test("content-level transcript absence does not switch providers", async () => {
  let browserCalls = 0;
  await assert.rejects(
    retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
      retrieveSupadata: async () => {
        throw providerError("transcript_missing", false);
      },
      browserConfigured: () => true,
      retrieveBrowser: async () => {
        browserCalls += 1;
        return retrieval("chrome");
      },
    }),
    (error: unknown) => error instanceof TranscriptApiError && error.code === "transcript_missing",
  );
  assert.equal(browserCalls, 0);
});

test("all capacity fallbacks remain auditable while preserving the primary retry semantics", async () => {
  await assert.rejects(
    retrieveTranscriptForWorker(VIDEO_ID, "supadata-key", {
      retrieveSupadata: async () => {
        throw providerError("provider_rate_limit", true);
      },
      browserConfigured: () => true,
      retrieveBrowser: async () => {
        throw new TranscriptApiError("Browser verification required.", {
          code: "browser_verification_required",
          httpStatus: null,
          retryable: true,
        });
      },
      transcriptApiConfigured: () => true,
      retrieveTranscriptApi: async () => {
        throw new TranscriptApiError("TranscriptAPI credits unavailable.", {
          code: "provider_payment_required",
          httpStatus: 402,
          retryable: false,
        });
      },
    }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "provider_rate_limit"
      && error.retryable
      && /Browser fallback: browser_verification_required/.test(error.message)
      && /TranscriptAPI fallback: provider_payment_required/.test(error.message),
  );
});

test("fallback eligibility is limited to provider-capacity failures", () => {
  assert.equal(transcriptWorkerShouldUseBrowserFallback(providerError("provider_rate_limit", true)), true);
  assert.equal(transcriptWorkerShouldUseBrowserFallback(providerError("provider_payment_required", false)), true);
  assert.equal(transcriptWorkerShouldUseBrowserFallback(providerError("transcript_missing", false)), false);
});

test("MD1: timeout uses existing configured fallback; missing credential skips primary transport and recovers", async () => {
  for (const code of ["timeout", "provider_auth_error"] as const) {
    let calls = 0;
    const result = await retrieveTranscriptForWorker(VIDEO_ID, code === "timeout" ? "mock" : "", {
      retrieveSupadata: async () => { throw new TranscriptApiError("mock", { code, httpStatus: null, retryable: code === "timeout" }); },
      browserConfigured: () => false,
      transcriptApiConfigured: () => true,
      retrieveTranscriptApi: async () => { calls++; return retrieval("transcriptapi"); },
    });
    assert.equal(calls, 1);
    assert.equal(transcriptProviderFromRetrieval(result), "transcriptapi");
  }
});
test("MD1: HTTP 402 Supadata response enters configured fallback", async () => {
  const { retrieveSupadataVideo } = await import("../lib/supadata.ts");
  const result = await retrieveTranscriptForWorker(VIDEO_ID, "mock", {
    retrieveSupadata: (id, key) => retrieveSupadataVideo(id, key, {fetchImpl: async () => new Response("{}", {status: 402})}),
    browserConfigured: () => false,
    transcriptApiConfigured: () => true,
    retrieveTranscriptApi: async () => retrieval("transcriptapi"),
  });
  assert.equal(transcriptProviderFromRetrieval(result), "transcriptapi");
});
