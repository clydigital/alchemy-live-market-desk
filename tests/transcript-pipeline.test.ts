import assert from "node:assert/strict";
import test from "node:test";

import {
  retrieveAndPersistTranscript,
  type ReadyTranscriptCache,
  type TranscriptDebtInput,
  type TranscriptIntakeItem,
  type TranscriptPipelineStore,
} from "../lib/transcript-pipeline.ts";
import {
  TranscriptApiError,
  type TranscriptApiRetrieval,
} from "../lib/transcriptapi.ts";

const retrieval: TranscriptApiRetrieval = {
  info: {
    videoId: "yNiWeHGBl98",
    title: "Test video",
    channel: "Kevin Gerrity",
    authorUrl: null,
    thumbnailUrl: null,
    availableLanguages: [{ code: "en", name: "English" }],
    httpStatus: 200,
  },
  transcript: {
    videoId: "yNiWeHGBl98",
    language: "en",
    segments: [{ startSeconds: 0, durationSeconds: 2, endSeconds: 2, text: "A verified segment." }],
    text: "A verified segment.",
    durationSeconds: 2,
    metadata: {},
    httpStatus: 200,
    cacheStatus: "MISS",
  },
};

class MemoryStore implements TranscriptPipelineStore {
  item: TranscriptIntakeItem | null = {
    id: "item-1",
    runId: "run-1",
    videoId: "yNiWeHGBl98",
    publisher: "Kevin Gerrity",
    title: "Test video",
    url: "https://www.youtube.com/watch?v=yNiWeHGBl98",
    transcriptStatus: "missing",
    required: true,
    attemptCount: 0,
  };
  cache: ReadyTranscriptCache | null = null;
  successWrites = 0;
  failureWrites = 0;
  recalculations = 0;
  resolved = 0;
  debts = new Map<string, TranscriptDebtInput>();

  async findReadyTranscript(videoId: string) {
    return this.cache?.transcript.videoId === videoId ? this.cache : null;
  }

  async findVideoItem(videoId: string) {
    return this.item?.videoId === videoId ? this.item : null;
  }

  async saveSuccess(item: TranscriptIntakeItem, value: TranscriptApiRetrieval, attemptedAt: string) {
    this.successWrites += 1;
    item.transcriptStatus = "ready";
    item.attemptCount += 1;
    this.cache = {
      itemId: item.id,
      runId: item.runId,
      retrievedAt: attemptedAt,
      transcript: value.transcript,
    };
  }

  async saveFailure(item: TranscriptIntakeItem) {
    this.failureWrites += 1;
    item.transcriptStatus = "missing";
    item.attemptCount += 1;
  }

  async upsertDebt(_item: TranscriptIntakeItem, debt: TranscriptDebtInput) {
    this.debts.set(debt.debtKey, debt);
  }

  async resolveDebt(videoId: string) {
    this.resolved += 1;
    this.debts.delete(`transcript:youtube:${videoId}`);
  }

  async recalculateRunState() {
    this.recalculations += 1;
  }
}

test("persists a successful transcript once, then serves the database cache without provider spend", async () => {
  const store = new MemoryStore();
  let providerCalls = 0;
  const now = () => new Date("2026-08-10T08:00:00.000Z");

  const first = await retrieveAndPersistTranscript({
    videoId: "yNiWeHGBl98",
    store,
    now,
    retrieve: async () => {
      providerCalls += 1;
      return retrieval;
    },
  });
  const second = await retrieveAndPersistTranscript({
    videoId: "yNiWeHGBl98",
    store,
    now: () => new Date("2026-08-10T09:00:00.000Z"),
    retrieve: async () => {
      providerCalls += 1;
      return retrieval;
    },
  });

  assert.equal(first.status, "ready");
  assert.equal(first.cacheHit, false);
  assert.equal(second.status, "ready");
  assert.equal(second.cacheHit, true);
  assert.equal(second.retrievedAt, "2026-08-10T08:00:00.000Z");
  assert.equal(providerCalls, 1);
  assert.equal(store.successWrites, 1);
  assert.equal(store.resolved, 1);
  assert.equal(store.recalculations, 2);
});

test("a retryable failure records stable metadata and idempotent research debt", async () => {
  const store = new MemoryStore();
  let providerCalls = 0;
  const retrieve = async () => {
    providerCalls += 1;
    throw new TranscriptApiError("Provider cooldown", {
      code: "provider_rate_limit",
      httpStatus: 429,
      retryable: true,
      retryAfterSeconds: 120,
    });
  };

  const first = await retrieveAndPersistTranscript({
    videoId: "yNiWeHGBl98",
    store,
    retrieve,
    now: () => new Date("2026-08-10T08:00:00.000Z"),
  });
  const second = await retrieveAndPersistTranscript({
    videoId: "yNiWeHGBl98",
    store,
    retrieve,
    now: () => new Date("2026-08-10T08:05:00.000Z"),
  });

  assert.equal(first.status, "failed");
  assert.equal(first.errorCode, "provider_rate_limit");
  assert.equal(first.httpStatus, 429);
  assert.equal(first.retryable, true);
  assert.equal(first.nextCheckAt, "2026-08-10T08:02:00.000Z");
  assert.equal(second.status, "failed");
  assert.equal(providerCalls, 2);
  assert.equal(store.failureWrites, 2);
  assert.equal(store.debts.size, 1);
  assert.equal(store.debts.get("transcript:youtube:yNiWeHGBl98")?.attemptedAt, "2026-08-10T08:05:00.000Z");
  assert.equal(store.recalculations, 2);
});

test("a ready database row cannot be overwritten by a later provider failure", async () => {
  const store = new MemoryStore();
  store.item!.transcriptStatus = "ready";
  store.cache = {
    itemId: "item-1",
    runId: "run-1",
    retrievedAt: "2026-08-10T08:00:00.000Z",
    transcript: retrieval.transcript,
  };
  let providerCalls = 0;

  const result = await retrieveAndPersistTranscript({
    videoId: "yNiWeHGBl98",
    store,
    retrieve: async () => {
      providerCalls += 1;
      throw new Error("must not run");
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.cacheHit, true);
  assert.equal(providerCalls, 0);
  assert.equal(store.failureWrites, 0);
});

test("does not call the provider when the video has no canonical intake row", async () => {
  const store = new MemoryStore();
  store.item = null;
  let providerCalls = 0;
  const result = await retrieveAndPersistTranscript({
    videoId: "yNiWeHGBl98",
    store,
    retrieve: async () => {
      providerCalls += 1;
      return retrieval;
    },
  });

  assert.equal(result.status, "not_found");
  assert.equal(providerCalls, 0);
});
