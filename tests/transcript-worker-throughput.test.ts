import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptResearchReview } from "../lib/transcript-research-review-contract.ts";
import {
  runTranscriptWorker,
  type ClaimedTranscriptJob,
  type TranscriptWorkerStore,
} from "../lib/transcript-worker.ts";
import type { TranscriptApiError, TranscriptApiRetrieval } from "../lib/transcriptapi.ts";

function job(index: number): ClaimedTranscriptJob {
  const suffix = String(index).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-0000000000${suffix}`,
    runId: "11111111-1111-4111-8111-111111111111",
    itemKey: `youtube:stockedup:video0000${suffix}`,
    videoId: `video0000${suffix}`,
    publisher: "StockedUp",
    title: `Video ${index}`,
    url: `https://www.youtube.com/watch?v=video0000${suffix}`,
    publishedAt: "2026-09-14T00:00:00.000Z",
    transcriptStatus: "ready",
    transcriptText: "Durable transcript checkpoint.",
    transcriptProvider: "supadata",
    transcriptAttemptCount: 1,
    videoReviewStatus: "reviewed",
    claimToken: `claim-${index}`,
    leaseExpiresAt: "2026-09-14T00:05:00.000Z",
    jobAttemptCount: 1,
    interpretedAt: "2026-09-14T00:00:00.000Z",
    evidenceId: null,
  };
}

class ThroughputStore implements TranscriptWorkerStore {
  readonly claimSizes: number[] = [];
  readonly queue: ClaimedTranscriptJob[];
  readonly onEvidence: (() => void) | undefined;
  readonly evidenceDelayMs: number;
  active = 0;
  maxActive = 0;
  completed = 0;

  constructor(queue: ClaimedTranscriptJob[], onEvidence?: () => void, evidenceDelayMs = 0) {
    this.queue = queue;
    this.onEvidence = onEvidence;
    this.evidenceDelayMs = evidenceDelayMs;
  }

  async claim(input: { workerId: string; batchSize: number; leaseSeconds: number }) {
    void input.workerId;
    void input.leaseSeconds;
    this.claimSizes.push(input.batchSize);
    return this.queue.splice(0, input.batchSize);
  }

  async renew() { return true; }
  async saveTranscript(_job: ClaimedTranscriptJob, _retrieval: TranscriptApiRetrieval, _attemptedAt: string) { throw new Error("unexpected extraction checkpoint"); }
  async saveExtractionFailure(_job: ClaimedTranscriptJob, _error: TranscriptApiError, _attemptedAt: string, _nextAttemptAt: string | null) { throw new Error("unexpected extraction failure"); }
  async saveInterpretation(_job: ClaimedTranscriptJob, _review: TranscriptResearchReview, _interpretedAt: string) { throw new Error("unexpected interpretation checkpoint"); }

  async findEvidence(candidate: ClaimedTranscriptJob) {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    this.onEvidence?.();
    if (this.evidenceDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.evidenceDelayMs));
    else await Promise.resolve();
    this.active -= 1;
    return `evidence-${candidate.id}`;
  }

  async persistEvidence() { throw new Error("unexpected evidence write"); }
  async complete() { this.completed += 1; }
  async retry() { throw new Error("unexpected retry"); }
  async fail() { throw new Error("unexpected terminal failure"); }
}

const forbiddenReview: TranscriptResearchReview = {
  summary: "unused",
  creatorLogic: "unused",
  recontextualizedSummary: "unused",
  termsDetected: [],
  claimChecks: [],
  expertNotes: [],
  affectedStorySlugs: [],
  researchLeadScore: 0,
};

function dependencies(store: ThroughputStore, extra: Record<string, unknown> = {}) {
  return {
    store,
    extract: async () => { throw new Error("extract should not run for checkpointed jobs"); },
    interpret: async () => forbiddenReview,
    leaseSeconds: 300,
    maxAttempts: 6,
    ...extra,
  };
}

test("claims incrementally and processes at most three jobs concurrently", async () => {
  const store = new ThroughputStore(Array.from({ length: 8 }, (_, index) => job(index + 1)), undefined, 10);
  const result = await runTranscriptWorker(dependencies(store, {
    batchSize: 8,
    maxConcurrency: 3,
    softDeadlineMs: 240_000,
    claimHeadroomMs: 45_000,
  }));

  assert.deepEqual(store.claimSizes, [3, 3, 2]);
  assert.equal(result.claimed, 8);
  assert.equal(result.metrics.processed, 8);
  assert.equal(result.stopReason, "batch_limit");
  assert.equal(store.maxActive, 3);
  assert.equal(store.completed, 8);
  assert.equal(result.capacity.maxClaimLimit, 25);
  assert.equal(result.capacity.requestedBatchSize, 8);
  assert.equal(result.capacity.maxConcurrency, 3);
});

test("stops claiming before the deadline instead of leasing the unused batch", async () => {
  let clockMs = 0;
  const store = new ThroughputStore(
    Array.from({ length: 15 }, (_, index) => job(index + 1)),
    () => { clockMs += 30_000; },
  );
  const result = await runTranscriptWorker(dependencies(store, {
    batchSize: 15,
    maxConcurrency: 3,
    softDeadlineMs: 120_000,
    claimHeadroomMs: 45_000,
    clock: () => clockMs,
  }));

  assert.deepEqual(store.claimSizes, [3]);
  assert.equal(result.claimed, 3);
  assert.equal(result.metrics.processed, 3);
  assert.equal(result.stopReason, "soft_deadline");
  assert.equal(store.completed, 3);
});
