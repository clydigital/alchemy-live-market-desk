import assert from "node:assert/strict";
import test from "node:test";

import { retrieveSupadataVideo } from "../lib/supadata.ts";
import { TranscriptApiError } from "../lib/transcriptapi.ts";

const VIDEO_ID = "yNiWeHGBl98";

test("Supadata request is hard-locked to native timestamped captions", async () => {
  let requestedUrl = "";
  let requestedApiKey = "";
  const retrieval = await retrieveSupadataVideo(VIDEO_ID, "test-key", {
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedApiKey = new Headers(init?.headers).get("x-api-key") || "";
      return new Response(JSON.stringify({
        content: [
          { text: "First segment", offset: 8150, duration: 1200, lang: "en" },
          { text: "Second segment", offset: 9350, duration: 650, lang: "en" },
        ],
        lang: "en",
        availableLangs: ["en"],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-billable-requests": "1",
        },
      });
    },
  });

  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get("mode"), "native");
  assert.equal(url.searchParams.get("text"), "false");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.get("url"), `https://www.youtube.com/watch?v=${VIDEO_ID}`);
  assert.notEqual(url.searchParams.get("mode"), "auto");
  assert.notEqual(url.searchParams.get("mode"), "generate");
  assert.equal(requestedApiKey, "test-key");

  assert.equal(retrieval.transcript.text, "First segment Second segment");
  assert.equal(retrieval.transcript.language, "en");
  assert.equal(retrieval.transcript.segments[0].startSeconds, 8.15);
  assert.equal(retrieval.transcript.segments[0].durationSeconds, 1.2);
  assert.equal(retrieval.transcript.segments[0].endSeconds, 9.35);
  assert.equal(retrieval.transcript.durationSeconds, 10);
  assert.equal(retrieval.transcript.metadata.retrievalProvider, "supadata");
  assert.equal(retrieval.transcript.metadata.transcriptSource, "native_caption");
  assert.equal(retrieval.transcript.metadata.mode, "native");
  assert.equal(retrieval.transcript.metadata.billableRequests, 1);
});

test("Supadata 206 transcript unavailable remains blocked and never falls through to generation", async () => {
  let requestedUrl = "";
  await assert.rejects(
    retrieveSupadataVideo(VIDEO_ID, "test-key", {
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ message: "Transcript unavailable" }), {
          status: 206,
          headers: { "content-type": "application/json", "x-billable-requests": "1" },
        });
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptApiError);
      assert.equal(error.code, "transcript_missing");
      assert.equal(error.retryable, false);
      assert.equal(error.httpStatus, 206);
      return true;
    },
  );
  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get("mode"), "native");
});

test("Supadata empty native content never becomes a ready transcript", async () => {
  await assert.rejects(
    retrieveSupadataVideo(VIDEO_ID, "test-key", {
      fetchImpl: async () => new Response(JSON.stringify({
        content: [],
        lang: "en",
        availableLangs: ["en"],
      }), { status: 200, headers: { "content-type": "application/json" } }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptApiError);
      assert.equal(error.code, "transcript_missing");
      assert.equal(error.retryable, false);
      return true;
    },
  );
});

test("Supadata rate limits remain retryable", async () => {
  await assert.rejects(
    retrieveSupadataVideo(VIDEO_ID, "test-key", {
      fetchImpl: async () => new Response(JSON.stringify({ message: "Too many requests" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "120" },
      }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptApiError);
      assert.equal(error.code, "provider_rate_limit");
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfterSeconds, 120);
      return true;
    },
  );
});

test("Supadata missing credential fails closed before any request", async () => {
  let calls = 0;
  await assert.rejects(
    retrieveSupadataVideo(VIDEO_ID, "", {
      fetchImpl: async () => {
        calls += 1;
        return new Response("{}", { status: 200 });
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptApiError);
      assert.equal(error.code, "provider_auth_error");
      return true;
    },
  );
  assert.equal(calls, 0);
});
