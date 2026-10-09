import assert from "node:assert/strict";
import test from "node:test";

import {
  GEMINI_SUMMARY_ONLY_LABEL,
  GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION,
  validateGeminiVideoAnalysis,
} from "../lib/gemini-video-analysis-contract.ts";
import {
  analysePublicYouTubeVideo,
  GeminiVideoAnalysisError,
  isGeminiVideoAnalysisConfigured,
  type GeminiVideoInteractionInput,
} from "../lib/gemini-video-analysis.ts";

function validAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION,
    accessStatus: "full",
    mainThesis: "  Rates stay restrictive until inflation cools.  ",
    directionalBias: "bearish",
    conviction: "medium",
    claims: [{
      text: "The creator expects yields to remain elevated.",
      classification: "creator_claim",
      timestampSeconds: 62.5,
      figures: ["4.5%"],
      dates: ["2026-10-09"],
      requiresVerification: true,
      verificationTarget: "Official Treasury yield data",
    }],
    uncertainty: ["Timing remains unclear."],
    contradictions: [],
    summary: "  A cautious rates-led equity view.  ",
    ...overrides,
  };
}

test("validated Gemini analysis preserves supported labels and trims bounded text", () => {
  const result = validateGeminiVideoAnalysis(validAnalysis());
  assert.equal(result.schemaVersion, "gemini-video-analysis/1");
  assert.equal(result.mainThesis, "Rates stay restrictive until inflation cools.");
  assert.equal(result.summary, "A cautious rates-led equity view.");
  assert.deepEqual(result.claims[0], {
    text: "The creator expects yields to remain elevated.",
    classification: "creator_claim",
    timestampSeconds: 62.5,
    figures: ["4.5%"],
    dates: ["2026-10-09"],
    requiresVerification: true,
    verificationTarget: "Official Treasury yield data",
  });
});

test("Gemini analysis rejects missing fields and unsupported claim labels", () => {
  assert.throws(
    () => validateGeminiVideoAnalysis(validAnalysis({ mainThesis: undefined })),
    /mainThesis/i,
  );
  assert.throws(
    () => validateGeminiVideoAnalysis(validAnalysis({
      claims: [{
        ...validAnalysis().claims[0],
        classification: "verified_fact",
      }],
    })),
    /classification/i,
  );
});

test("Gemini analysis rejects invalid timestamps and non-array claims", () => {
  assert.throws(
    () => validateGeminiVideoAnalysis(validAnalysis({
      claims: [{ ...validAnalysis().claims[0], timestampSeconds: -1 }],
    })),
    /timestampSeconds/i,
  );
  assert.throws(
    () => validateGeminiVideoAnalysis(validAnalysis({
      claims: [{ ...validAnalysis().claims[0], timestampSeconds: Number.POSITIVE_INFINITY }],
    })),
    /timestampSeconds/i,
  );
  assert.throws(() => validateGeminiVideoAnalysis(validAnalysis({ claims: {} })), /claims/i);
});

test("public YouTube analysis builds one structured request and returns summary-only provenance", async () => {
  const captured: GeminiVideoInteractionInput[] = [];
  const result = await analysePublicYouTubeVideo({
    url: "https://www.youtube.com/watch?v=ycw-010tAPA",
    apiKey: "server-secret",
  }, {
    runInteraction: async (input) => {
      captured.push(input);
      return JSON.stringify(validAnalysis());
    },
  });

  assert.equal(result.provider, "gemini");
  assert.equal(result.evidenceLabel, GEMINI_SUMMARY_ONLY_LABEL);
  assert.equal(result.model, "gemini-3.8-flash");
  assert.equal(result.promptVersion, GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION);
  assert.equal(result.analysis.accessStatus, "full");
  assert.equal(captured[0]?.url, "https://www.youtube.com/watch?v=ycw-010tAPA");
  assert.equal(captured[0]?.model, "gemini-3.8-flash");
  assert.match(captured[0]?.prompt || "", /Do not invent facts, timestamps or quotations/i);
  assert.equal(captured[0]?.responseSchema.type, "object");
});

test("youtu.be URLs and explicit model overrides are accepted", async () => {
  const result = await analysePublicYouTubeVideo({
    url: "https://youtu.be/ycw-010tAPA",
    apiKey: "server-secret",
    model: "gemini-test-model",
  }, {
    runInteraction: async () => JSON.stringify(validAnalysis({ accessStatus: "partial" })),
  });
  assert.equal(result.model, "gemini-test-model");
  assert.equal(result.analysis.accessStatus, "partial");
});

test("invalid and non-YouTube URLs fail before an interaction can run", async () => {
  for (const url of [
    "http://www.youtube.com/watch?v=ycw-010tAPA",
    "https://example.com/watch?v=ycw-010tAPA",
    "not a URL",
  ]) {
    let calls = 0;
    await assert.rejects(
      analysePublicYouTubeVideo({ url, apiKey: "server-secret" }, {
        runInteraction: async () => {
          calls += 1;
          return JSON.stringify(validAnalysis());
        },
      }),
      (error: unknown) => error instanceof GeminiVideoAnalysisError
        && error.code === "invalid_video_url",
    );
    assert.equal(calls, 0, url);
  }
});

test("configuration requires a non-empty server-side Gemini key", () => {
  assert.equal(isGeminiVideoAnalysisConfigured({ GEMINI_API_KEY: " key " }), true);
  assert.equal(isGeminiVideoAnalysisConfigured({ GEMINI_API_KEY: "  " }), false);
  assert.equal(isGeminiVideoAnalysisConfigured({}), false);
});

test("unavailable, malformed and oversized responses are not successful summaries", async () => {
  for (const response of [
    JSON.stringify(validAnalysis({ accessStatus: "unavailable" })),
    "not-json",
    JSON.stringify({ summary: "missing contract" }),
    `"${"x".repeat(1_000_001)}"`,
  ]) {
    await assert.rejects(
      analysePublicYouTubeVideo({
        url: "https://www.youtube.com/watch?v=ycw-010tAPA",
        apiKey: "server-secret",
      }, { runInteraction: async () => response }),
      (error: unknown) => error instanceof GeminiVideoAnalysisError
        && ["video_unavailable", "malformed_response"].includes(error.code),
    );
  }
});

test("timeouts are bounded and never expose the Gemini key", async () => {
  const apiKey = "do-not-leak-this-key";
  await assert.rejects(
    analysePublicYouTubeVideo({
      url: "https://www.youtube.com/watch?v=ycw-010tAPA",
      apiKey,
    }, {
      timeoutMs: 5,
      runInteraction: (input) => new Promise((_resolve, reject) => {
        input.signal.addEventListener("abort", () => reject(new Error(`aborted ${apiKey}`)), { once: true });
      }),
    }),
    (error: unknown) => error instanceof GeminiVideoAnalysisError
      && error.code === "timeout"
      && !error.message.includes(apiKey),
  );
});
