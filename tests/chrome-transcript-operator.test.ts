import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverYouTubeChannelWithChrome,
  isChromeTranscriptOperatorConfigured,
  retrieveChromeYouTubeToTranscript,
} from "../lib/chrome-transcript-operator.ts";
import { TranscriptApiError } from "../lib/transcriptapi.ts";

const videoId = "yNiWeHGBl98";

test("Chrome transcript operator accepts only an authenticated HTTPS or loopback endpoint", () => {
  assert.equal(isChromeTranscriptOperatorConfigured({
    endpoint: "https://operator.example.test/v1/transcript",
    token: "test-token",
  }), true);
  assert.equal(isChromeTranscriptOperatorConfigured({
    endpoint: "http://127.0.0.1:4317/v1/transcript",
    token: "test-token",
  }), true);
  assert.equal(isChromeTranscriptOperatorConfigured({
    endpoint: "http://operator.example.test/v1/transcript",
    token: "test-token",
  }), false);
  assert.equal(isChromeTranscriptOperatorConfigured({
    endpoint: "https://operator.example.test/v1/transcript",
    token: "",
  }), false);
});

test("Chrome transcript operator preserves timestamped YouTubeToTranscript provenance", async () => {
  let requestBody: Record<string, unknown> | null = null;
  let authorization = "";
  const retrieval = await retrieveChromeYouTubeToTranscript(videoId, {
    endpoint: "https://operator.example.test/v1/transcript",
    token: "operator-token",
    fetchImpl: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      authorization = new Headers(init?.headers).get("authorization") || "";
      return new Response(JSON.stringify({
        status: "ready",
        observedAt: "2026-09-07T00:00:00.000Z",
        video: { title: "Video title", channel: "Creator", channelUrl: "https://www.youtube.com/@creator" },
        transcript: {
          language: "en",
          sourceUrl: `https://youtubetotranscript.com/transcript?v=${videoId}&current_language_code=en`,
          text: "First caption Second caption",
          durationSeconds: 4,
          segments: [
            { startSeconds: 0, durationSeconds: 2, endSeconds: 2, text: "First caption" },
            { startSeconds: 2, durationSeconds: 2, endSeconds: 4, text: "Second caption" },
          ],
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  assert.deepEqual(requestBody, {
    operation: "transcript",
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  });
  assert.equal(authorization, "Bearer operator-token");
  assert.equal(retrieval.info.title, "Video title");
  assert.equal(retrieval.transcript.segments.length, 2);
  assert.equal(retrieval.transcript.metadata.retrievalProvider, "chrome_operator");
  assert.equal(retrieval.transcript.metadata.transcriptSource, "youtubetotranscript.com");
  assert.equal(retrieval.transcript.metadata.browserVerifiedYouTubePage, true);
});

test("a browser verification challenge remains an explicit retryable operator failure", async () => {
  await assert.rejects(
    retrieveChromeYouTubeToTranscript(videoId, {
      endpoint: "https://operator.example.test/v1/transcript",
      token: "operator-token",
      fetchImpl: async () => new Response(JSON.stringify({
        status: "unavailable",
        code: "browser_verification_required",
        message: "YouTubeToTranscript presented a browser verification challenge; no bypass was attempted.",
        retryable: true,
      }), { status: 200, headers: { "content-type": "application/json" } }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptApiError);
      assert.equal(error.code, "browser_verification_required");
      assert.equal(error.retryable, true);
      assert.match(error.message, /no bypass was attempted/i);
      return true;
    },
  );
});

test("Chrome discovery keeps only recent video cards and records browser-derived timing", async () => {
  const result = await discoverYouTubeChannelWithChrome({
    channelKey: "stockedup",
    channelName: "StockedUp",
    handle: "@StockedUp",
    now: new Date("2026-09-07T12:00:00.000Z"),
    cutoff: new Date("2026-09-04T12:00:00.000Z"),
  }, {
    endpoint: "https://operator.example.test/v1/transcript",
    token: "operator-token",
    fetchImpl: async () => new Response(JSON.stringify({
      status: "ready",
      channel: {
        channelId: "UC123",
        scannedCount: 2,
        videos: [
          {
            videoId,
            title: "A recent market update",
            url: `https://www.youtube.com/watch?v=${videoId}`,
            publishedLabel: "2 hours ago",
            isLive: false,
            isShort: false,
          },
          {
            videoId: "KHacM8aduWM",
            title: "An old market update",
            url: "https://www.youtube.com/watch?v=KHacM8aduWM",
            publishedLabel: "4 days ago",
            isLive: false,
            isShort: false,
          },
        ],
      },
    }), { status: 200, headers: { "content-type": "application/json" } }),
  });

  assert.equal(result.status, "ready");
  if (result.status !== "ready") assert.fail("Expected a recovered channel result");
  assert.equal(result.scannedCount, 2);
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0]?.videoId, videoId);
  assert.equal(result.videos[0]?.publishedAt, "2026-09-07T10:00:00.000Z");
  assert.match(result.detail, /browser-derived provenance/i);
});
