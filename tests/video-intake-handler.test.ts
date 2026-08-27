import assert from "node:assert/strict";
import test from "node:test";

import { handleVideoIntakeRequest } from "../lib/video-intake-handler.ts";
import type {
  ReadyTranscriptCache,
  TranscriptDebtInput,
  TranscriptIntakeItem,
  TranscriptPipelineStore,
  TranscriptProvider,
} from "../lib/transcript-pipeline.ts";
import type { TranscriptApiError, TranscriptApiRetrieval } from "../lib/transcriptapi.ts";

const VIDEO_ID = "KHacM8aduWM";

const retrieval: TranscriptApiRetrieval = {
  info: {
    videoId: VIDEO_ID,
    title: "Nvidia CRUSHED Earnings — Get Ready For Tomorrow",
    channel: "StockedUp",
    authorUrl: null,
    thumbnailUrl: null,
    availableLanguages: [{ code: "en", name: "English" }],
    httpStatus: 200,
  },
  transcript: {
    videoId: VIDEO_ID,
    language: "en",
    segments: [{ startSeconds: 0, durationSeconds: 2, endSeconds: 2, text: "Native caption." }],
    text: "Native caption.",
    durationSeconds: 2,
    metadata: { retrievalProvider: "supadata", transcriptSource: "native_caption", mode: "native" },
    httpStatus: 200,
    cacheStatus: null,
  },
};

class TargetStore implements TranscriptPipelineStore {
  item: TranscriptIntakeItem | null = {
    id: "canonical-video-item",
    runId: "video-run",
    videoId: VIDEO_ID,
    publisher: "StockedUp",
    title: retrieval.info.title || "StockedUp video",
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    transcriptStatus: "missing",
    transcriptProvider: null,
    required: true,
    attemptCount: 0,
  };
  cache: ReadyTranscriptCache | null = null;
  provider: TranscriptProvider | null = null;
  recalculatedRunIds: string[] = [];

  async findReadyTranscript(videoId: string) {
    return this.cache?.transcript.videoId === videoId ? this.cache : null;
  }

  async findVideoItem(videoId: string) {
    return this.item?.videoId === videoId ? this.item : null;
  }

  async saveSuccess(
    item: TranscriptIntakeItem,
    value: TranscriptApiRetrieval,
    attemptedAt: string,
    provider: TranscriptProvider,
  ) {
    this.provider = provider;
    this.item = {
      ...item,
      transcriptStatus: "ready",
      transcriptProvider: provider,
      attemptCount: item.attemptCount + 1,
    };
    this.cache = {
      itemId: item.id,
      runId: item.runId,
      retrievedAt: attemptedAt,
      provider,
      transcript: value.transcript,
    };
  }

  async saveFailure(
    item: TranscriptIntakeItem,
    error: TranscriptApiError,
    _attemptedAt: string,
    provider: TranscriptProvider,
  ) {
    this.provider = provider;
    this.item = {
      ...item,
      transcriptStatus: error.retryable ? "missing" : "unavailable",
      transcriptProvider: provider,
      transcriptErrorCode: error.code,
      transcriptHttpStatus: error.httpStatus,
      transcriptRetryable: error.retryable,
      attemptCount: item.attemptCount + 1,
    };
  }

  async upsertDebt(_item: TranscriptIntakeItem, _debt: TranscriptDebtInput) {}
  async resolveDebt() {}

  async recalculateRunState(runId: string) {
    this.recalculatedRunIds.push(runId);
  }
}

function targetRequest(videoId = VIDEO_ID) {
  return new Request("https://example.com/api/video-intake", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-token" },
    body: JSON.stringify({ videoId }),
  });
}

test("authenticated targeted canary reaches Supadata once, persists provenance, and replays from cache", async () => {
  const store = new TargetStore();
  let providerCalls = 0;
  const dependencies = {
    authenticate: () => true,
    createStore: () => store,
    retrieveTranscript: async (videoId: string, _apiKey: string, options?: { timeoutMs?: number }) => {
      providerCalls += 1;
      assert.equal(videoId, VIDEO_ID);
      assert.equal(options?.timeoutMs, 8_000);
      return retrieval;
    },
  };

  const firstResponse = await handleVideoIntakeRequest(targetRequest(), undefined, dependencies);
  const first = await firstResponse.json() as {
    engine: string;
    mode: string;
    result: {
      status: string;
      videoId: string;
      provider: string;
      cacheHit: boolean;
      segmentCount: number;
      retrievedAt: string;
    };
  };
  const replayResponse = await handleVideoIntakeRequest(targetRequest(), undefined, dependencies);
  const replay = await replayResponse.json() as {
    result: { status: string; videoId: string; provider: string; cacheHit: boolean; retrievedAt: string };
  };

  assert.equal(firstResponse.status, 200);
  assert.equal(first.engine, "XWADA");
  assert.equal(first.mode, "targeted_transcript_retry");
  assert.equal(first.result.status, "ready");
  assert.equal(first.result.videoId, VIDEO_ID);
  assert.equal(first.result.provider, "supadata");
  assert.equal(first.result.cacheHit, false);
  assert.equal(first.result.segmentCount, 1);
  assert.equal(store.item?.transcriptStatus, "ready");
  assert.equal(store.item?.transcriptProvider, "supadata");
  assert.equal(store.item?.attemptCount, 1);
  assert.deepEqual(store.cache?.transcript.segments, retrieval.transcript.segments);
  assert.deepEqual(store.recalculatedRunIds, ["video-run", "video-run"]);
  assert.equal(providerCalls, 1);
  assert.equal(replay.result.status, "ready");
  assert.equal(replay.result.videoId, VIDEO_ID);
  assert.equal(replay.result.provider, "supadata");
  assert.equal(replay.result.cacheHit, true);
  assert.equal(replay.result.retrievedAt, first.result.retrievedAt);
});

test("targeted canary verifies canonical intake state before any provider request", async () => {
  const store = new TargetStore();
  store.item = null;
  let providerCalls = 0;

  const response = await handleVideoIntakeRequest(targetRequest(), undefined, {
    authenticate: () => true,
    createStore: () => store,
    retrieveTranscript: async () => {
      providerCalls += 1;
      return retrieval;
    },
  });
  const body = await response.json() as { status: string; videoId: string; detail: string };

  assert.equal(response.status, 404);
  assert.equal(body.status, "not_found");
  assert.equal(body.videoId, VIDEO_ID);
  assert.match(body.detail, /already exist in research_intake_items/);
  assert.equal(providerCalls, 0);
});
