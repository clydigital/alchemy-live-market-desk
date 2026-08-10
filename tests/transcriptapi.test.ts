import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchTranscriptApiInfo,
  fetchTranscriptApiTranscript,
  retrieveTranscriptApiVideo,
  TranscriptApiError,
} from "../lib/transcriptapi.ts";

const KEY = "test-provider-key";

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

test("retrieval calls free info before the paid transcript endpoint and preserves timestamps", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/youtube/info?")) {
      return json({
        video_id: "yNiWeHGBl98",
        metadata: { title: "Test video", author_name: "Kevin Gerrity" },
        available_languages: [{ code: "fr", name: "French" }, { code: "en", name: "English" }],
      });
    }
    return json({
      video_id: "yNiWeHGBl98",
      language: "en",
      length_seconds: 12,
      metadata: { title: "Test video" },
      transcript: [
        { start: 0, duration: 1.5, text: "First claim." },
        { start: 1.5, duration: 2, text: "Second claim." },
      ],
    }, 200, { "X-Cache-Status": "MISS" });
  }) as typeof fetch;

  const result = await retrieveTranscriptApiVideo("yNiWeHGBl98", KEY, { fetchImpl });

  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/youtube\/info\?/);
  assert.match(calls[1], /\/youtube\/transcript\?/);
  assert.match(calls[1], /language=en%2Cfr/);
  assert.match(calls[1], /include_timestamp=true/);
  assert.equal(result.transcript.text, "First claim. Second claim.");
  assert.deepEqual(result.transcript.segments[1], {
    startSeconds: 1.5,
    durationSeconds: 2,
    endSeconds: 3.5,
    text: "Second claim.",
  });
});

test("info validates the YouTube reference before spending a provider request", async () => {
  let calls = 0;
  await assert.rejects(
    fetchTranscriptApiInfo("not-a-valid-video", KEY, {
      fetchImpl: (async () => {
        calls += 1;
        return json({});
      }) as typeof fetch,
    }),
    (error: unknown) => error instanceof TranscriptApiError && error.code === "invalid_video_url",
  );
  assert.equal(calls, 0);
});

for (const scenario of [
  { name: "auth", status: 401, message: "invalid token", code: "provider_auth_error", retryable: false },
  { name: "payment", status: 402, message: "credits required", code: "provider_payment_required", retryable: false },
  { name: "missing video", status: 404, message: "Video not found", code: "video_not_found", retryable: false },
  { name: "private video", status: 404, message: "This video is private", code: "video_private", retryable: false },
  { name: "deleted video", status: 404, message: "Video was deleted", code: "video_deleted", retryable: false },
  { name: "missing transcript", status: 404, message: "No transcript exists", code: "transcript_missing", retryable: false },
] as const) {
  test(`classifies ${scenario.name} failures`, async () => {
    await assert.rejects(
      fetchTranscriptApiInfo("yNiWeHGBl98", KEY, {
        fetchImpl: (async () => json({ message: scenario.message }, scenario.status)) as typeof fetch,
        maxAttempts: 1,
      }),
      (error: unknown) => error instanceof TranscriptApiError
        && error.code === scenario.code
        && error.httpStatus === scenario.status
        && error.retryable === scenario.retryable,
    );
  });
}

test("preserves the nested provider message for payment failures", async () => {
  await assert.rejects(
    fetchTranscriptApiInfo("yNiWeHGBl98", KEY, {
      fetchImpl: (async () => json({
        detail: {
          message: "The account has no transcript credits.",
          reason: "insufficient_credits",
        },
      }, 402)) as typeof fetch,
      maxAttempts: 1,
    }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "provider_payment_required"
      && error.message === "The account has no transcript credits.",
  );
});

test("classifies a language-unavailable transcript failure", async () => {
  await assert.rejects(
    fetchTranscriptApiTranscript("yNiWeHGBl98", KEY, ["en"], {
      fetchImpl: (async () => json({ message: "Requested language is unavailable" }, 422)) as typeof fetch,
      maxAttempts: 1,
    }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "language_unavailable"
      && !error.retryable,
  );
});

for (const scenario of [
  { name: "rate limit", status: 429, code: "provider_rate_limit" },
  { name: "server error", status: 503, code: "provider_server_error" },
] as const) {
  test(`retries and preserves ${scenario.name} metadata`, async () => {
    let calls = 0;
    const sleeps: number[] = [];
    await assert.rejects(
      fetchTranscriptApiInfo("yNiWeHGBl98", KEY, {
        fetchImpl: (async () => {
          calls += 1;
          return json({ message: scenario.name }, scenario.status, { "Retry-After": "2" });
        }) as typeof fetch,
        sleep: async (milliseconds) => { sleeps.push(milliseconds); },
        maxAttempts: 3,
      }),
      (error: unknown) => error instanceof TranscriptApiError
        && error.code === scenario.code
        && error.httpStatus === scenario.status
        && error.retryable,
    );
    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [2_000, 2_000]);
  });
}

test("classifies network failures and uses bounded retries", async () => {
  let calls = 0;
  await assert.rejects(
    fetchTranscriptApiInfo("yNiWeHGBl98", KEY, {
      fetchImpl: (async () => {
        calls += 1;
        throw new TypeError("socket closed");
      }) as typeof fetch,
      sleep: async () => {},
      maxAttempts: 3,
    }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "network_error"
      && error.retryable,
  );
  assert.equal(calls, 3);
});

test("classifies provider timeouts", async () => {
  const fetchImpl = ((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })) as typeof fetch;
  await assert.rejects(
    fetchTranscriptApiInfo("yNiWeHGBl98", KEY, { fetchImpl, timeoutMs: 1, maxAttempts: 1 }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "timeout"
      && error.retryable,
  );
});

test("rejects malformed successful JSON", async () => {
  await assert.rejects(
    fetchTranscriptApiInfo("yNiWeHGBl98", KEY, {
      fetchImpl: (async () => new Response("<html>bad gateway</html>", { status: 200 })) as typeof fetch,
      maxAttempts: 1,
    }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "malformed_provider_response",
  );
});

test("rejects an empty transcript", async () => {
  await assert.rejects(
    fetchTranscriptApiTranscript("yNiWeHGBl98", KEY, ["en"], {
      fetchImpl: (async () => json({
        video_id: "yNiWeHGBl98",
        language: "en",
        transcript: [],
      })) as typeof fetch,
    }),
    (error: unknown) => error instanceof TranscriptApiError
      && error.code === "transcript_missing",
  );
});
