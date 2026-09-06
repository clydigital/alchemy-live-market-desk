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

test("authenticated targeted video request returns manual-transcript guidance without calling a paid provider", async () => {
  const store = new TargetStore();
  const dependencies = {
    authenticate: () => true,
    createStore: () => store,
  };

  const response = await handleVideoIntakeRequest(targetRequest(), undefined, dependencies);
  const body = await response.json() as {
    engine: string;
    mode: string;
    videoId: string;
    transcriptStatus: string;
    detail: string;
  };

  assert.equal(response.status, 409);
  assert.equal(body.engine, "XWADA");
  assert.equal(body.mode, "manual_transcript_guidance");
  assert.equal(body.videoId, VIDEO_ID);
  assert.equal(body.transcriptStatus, "missing");
  assert.match(body.detail, /paid transcript retrieval is disabled/i);
  assert.equal(store.item?.attemptCount, 0);
});

test("targeted canary verifies canonical intake state before any provider request", async () => {
  const store = new TargetStore();
  store.item = null;
  const response = await handleVideoIntakeRequest(targetRequest(), undefined, {
    authenticate: () => true,
    createStore: () => store,
  });
  const body = await response.json() as { status: string; videoId: string; detail: string };

  assert.equal(response.status, 404);
  assert.equal(body.status, "not_found");
  assert.equal(body.videoId, VIDEO_ID);
  assert.match(body.detail, /already exist in research_intake_items/);
});
