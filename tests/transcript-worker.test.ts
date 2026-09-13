import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptResearchReview } from "../lib/transcript-research-review-contract.ts";
import {
  processTranscriptJob,
  runTranscriptWorker,
  type ClaimedTranscriptJob,
  type TranscriptWorkerStore,
} from "../lib/transcript-worker.ts";
import { TranscriptApiError, type TranscriptApiRetrieval } from "../lib/transcriptapi.ts";

const start = new Date("2026-09-14T00:00:00.000Z");

function retrieval(videoId = "GYne0nYFiqk"): TranscriptApiRetrieval {
  return {
    info: { videoId, title: null, channel: null, authorUrl: null, thumbnailUrl: null, availableLanguages: [{ code: "en", name: "en" }], httpStatus: 200 },
    transcript: {
      videoId,
      language: "en",
      segments: [{ startSeconds: 0, durationSeconds: 2, endSeconds: 2, text: "Rates affect equities." }],
      text: "Rates affect equities.",
      durationSeconds: 2,
      metadata: { retrievalProvider: "supadata", mode: "native" },
      httpStatus: 200,
      cacheStatus: null,
    },
  };
}

const review: TranscriptResearchReview = {
  summary: "The creator links higher yields to equity pressure.",
  creatorLogic: "Yields rise -> discount rates rise -> equity multiples compress.",
  recontextualizedSummary: "Verify the yield move before treating this as evidence.",
  termsDetected: ["discount rate"],
  claimChecks: [{ claim: "Yields rose.", kind: "cited_fact", verificationNeeded: true, verificationTarget: "Treasury market data" }],
  expertNotes: [{ kind: "causal_link", note: "Higher discount rates can pressure long-duration assets." }],
  affectedStorySlugs: [],
  researchLeadScore: 72,
};

function job(overrides: Partial<ClaimedTranscriptJob> = {}): ClaimedTranscriptJob {
  return {
    id: "975ddfe0-5b7d-4d6c-b1e0-b3db23b7ed23",
    runId: "5dc5f543-12a3-4ded-a95c-25dfd2b50bd8",
    itemKey: "youtube:stockedup:GYne0nYFiqk",
    videoId: "GYne0nYFiqk",
    publisher: "StockedUp",
    title: "Tomorrow Will Be The Biggest Day Of The Week",
    url: "https://www.youtube.com/watch?v=GYne0nYFiqk",
    publishedAt: "2026-09-10T22:00:17.000Z",
    transcriptStatus: "missing",
    transcriptText: null,
    transcriptProvider: null,
    transcriptAttemptCount: 0,
    videoReviewStatus: null,
    claimToken: "claim-1",
    leaseExpiresAt: "2026-09-14T00:05:00.000Z",
    jobAttemptCount: 1,
    interpretedAt: null,
    evidenceId: null,
    ...overrides,
  };
}

class MemoryStore implements TranscriptWorkerStore {
  state: "pending" | "running" | "retryable" | "blocked" | "completed" | "failed" = "pending";
  current = job({ claimToken: "" });
  now = start.getTime();
  evidence = new Set<string>();
  extractionSaves = 0;
  interpretationSaves = 0;
  evidenceWrites = 0;
  extractionFailures = 0;
  retryWrites = 0;
  claimSequence = 0;
  failEvidenceOnce = false;

  async claim(input: { workerId: string; batchSize: number; leaseSeconds: number }) {
    const leaseExpired = this.state === "running" && Date.parse(this.current.leaseExpiresAt) <= this.now;
    const due = this.state === "pending" || this.state === "retryable" || leaseExpired;
    if (!due || input.batchSize < 1) return [];
    this.state = "running";
    this.claimSequence += 1;
    this.current = {
      ...this.current,
      claimToken: `claim-${this.claimSequence}`,
      leaseExpiresAt: new Date(this.now + input.leaseSeconds * 1_000).toISOString(),
      jobAttemptCount: this.current.jobAttemptCount + 1,
    };
    return [{ ...this.current }];
  }

  owns(candidate: ClaimedTranscriptJob) {
    return this.state === "running" && candidate.claimToken === this.current.claimToken && Date.parse(this.current.leaseExpiresAt) > this.now;
  }

  async renew(candidate: ClaimedTranscriptJob, leaseSeconds: number) {
    if (!this.owns(candidate)) return false;
    this.current.leaseExpiresAt = new Date(this.now + leaseSeconds * 1_000).toISOString();
    return true;
  }

  async saveTranscript(candidate: ClaimedTranscriptJob, value: TranscriptApiRetrieval) {
    assert.equal(this.owns(candidate), true);
    this.extractionSaves += 1;
    this.current = { ...this.current, transcriptStatus: "ready", transcriptText: value.transcript.text, transcriptProvider: "supadata", videoReviewStatus: "transcript_only" };
  }

  async saveExtractionFailure(candidate: ClaimedTranscriptJob, error: TranscriptApiError, _at: string, next: string | null) {
    assert.equal(this.owns(candidate), true);
    this.extractionFailures += 1;
    this.state = error.retryable ? "retryable" : "blocked";
    this.current = { ...this.current, transcriptStatus: error.retryable ? "missing" : "unavailable", leaseExpiresAt: next ?? this.current.leaseExpiresAt };
  }

  async saveInterpretation(candidate: ClaimedTranscriptJob, _review: TranscriptResearchReview, at: string) {
    assert.equal(this.owns(candidate), true);
    this.interpretationSaves += 1;
    this.current = { ...this.current, videoReviewStatus: "reviewed", interpretedAt: at };
  }

  async findEvidence(candidate: ClaimedTranscriptJob) {
    return this.evidence.has(candidate.id) ? `evidence-${candidate.id}` : null;
  }

  async persistEvidence(candidate: ClaimedTranscriptJob) {
    assert.equal(this.owns(candidate), true);
    this.evidenceWrites += 1;
    if (this.failEvidenceOnce) {
      this.failEvidenceOnce = false;
      throw new Error("evidence write unavailable");
    }
    this.evidence.add(candidate.id);
    return `evidence-${candidate.id}`;
  }

  async complete(candidate: ClaimedTranscriptJob, evidenceId: string) {
    assert.equal(this.owns(candidate), true);
    assert.equal(this.evidence.has(candidate.id), true);
    this.state = "completed";
    this.current = { ...this.current, evidenceId, claimToken: "" };
  }

  async retry(candidate: ClaimedTranscriptJob) {
    assert.equal(this.owns(candidate), true);
    this.retryWrites += 1;
    this.state = "retryable";
    this.current = { ...this.current, claimToken: "" };
  }

  async fail(candidate: ClaimedTranscriptJob) {
    assert.equal(this.owns(candidate), true);
    this.state = "failed";
    this.current = { ...this.current, claimToken: "" };
  }
}

function workerDependencies(store: MemoryStore, calls: { extract: number; interpret: number }) {
  return {
    store,
    now: () => new Date(store.now),
    batchSize: 1,
    leaseSeconds: 300,
    maxAttempts: 6,
    extract: async (videoId: string) => { calls.extract += 1; return retrieval(videoId); },
    interpret: async () => { calls.interpret += 1; return review; },
  };
}

test("atomic claim lets two workers target one job but runs one extraction", async () => {
  const store = new MemoryStore();
  const calls = { extract: 0, interpret: 0 };
  const [left, right] = await Promise.all([
    runTranscriptWorker(workerDependencies(store, calls)),
    runTranscriptWorker(workerDependencies(store, calls)),
  ]);
  assert.equal(left.claimed + right.claimed, 1);
  assert.equal(calls.extract, 1);
  assert.equal(store.state, "completed");
});

test("an active lease is not reclaimed, but an expired lease is", async () => {
  const store = new MemoryStore();
  const first = await store.claim({ workerId: "dead-worker", batchSize: 1, leaseSeconds: 300 });
  assert.equal(first.length, 1);
  assert.equal((await store.claim({ workerId: "early-worker", batchSize: 1, leaseSeconds: 300 })).length, 0);
  store.now += 301_000;
  const calls = { extract: 0, interpret: 0 };
  const recovered = await runTranscriptWorker(workerDependencies(store, calls));
  assert.equal(recovered.claimed, 1);
  assert.equal(calls.extract, 1);
  assert.equal(store.state, "completed");
});

test("a persisted transcript checkpoint skips retranscription after lease recovery", async () => {
  const store = new MemoryStore();
  store.state = "running";
  store.current = job({ transcriptStatus: "ready", transcriptText: "Durable transcript", videoReviewStatus: "transcript_only", claimToken: "dead", leaseExpiresAt: "2026-09-13T23:59:00.000Z" });
  const calls = { extract: 0, interpret: 0 };
  await runTranscriptWorker(workerDependencies(store, calls));
  assert.equal(calls.extract, 0);
  assert.equal(calls.interpret, 1);
  assert.equal(store.state, "completed");
});

test("an interpretation checkpoint resumes evidence only after an evidence failure", async () => {
  const store = new MemoryStore();
  store.state = "running";
  store.current = job({ transcriptStatus: "ready", transcriptText: "Durable transcript", videoReviewStatus: "reviewed", interpretedAt: start.toISOString(), claimToken: "claim-1" });
  store.failEvidenceOnce = true;
  const calls = { extract: 0, interpret: 0 };
  const first = await processTranscriptJob({ ...store.current }, { ...workerDependencies(store, calls), maxAttempts: 6 });
  assert.equal(first.status, "retryable");
  assert.equal(store.retryWrites, 1);
  const second = await runTranscriptWorker(workerDependencies(store, calls));
  assert.equal(second.outcomes[0]?.resumedFrom, "evidence");
  assert.equal(calls.extract, 0);
  assert.equal(calls.interpret, 0);
  assert.equal(store.evidenceWrites, 2);
  assert.equal(store.state, "completed");
});

test("permanent transcript unavailability becomes explicitly blocked without retry", async () => {
  const store = new MemoryStore();
  store.state = "running";
  store.current = job();
  const outcome = await processTranscriptJob({ ...store.current }, {
    store,
    now: () => start,
    leaseSeconds: 300,
    maxAttempts: 6,
    extract: async () => { throw new TranscriptApiError("No native captions", { code: "transcript_missing", httpStatus: 206, retryable: false }); },
    interpret: async () => review,
  });
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.errorCode, "transcript_missing");
  assert.equal(store.extractionFailures, 1);
  assert.equal(store.retryWrites, 0);
  assert.equal(store.state, "blocked");
});

test("completed transcript evidence is visible through the normal evidence set and idempotent", async () => {
  const store = new MemoryStore();
  store.state = "running";
  store.current = job();
  const calls = { extract: 0, interpret: 0 };
  const first = await processTranscriptJob({ ...store.current }, { ...workerDependencies(store, calls), maxAttempts: 6 });
  assert.equal(first.status, "completed");
  assert.equal(await store.findEvidence(store.current), first.evidenceId);
  const writes = store.evidenceWrites;
  store.state = "running";
  store.current = { ...store.current, claimToken: "replay", leaseExpiresAt: "2026-09-14T00:05:00.000Z" };
  const replay = await processTranscriptJob({ ...store.current }, { ...workerDependencies(store, calls), maxAttempts: 6 });
  assert.equal(replay.status, "completed");
  assert.equal(store.evidenceWrites, writes);
});
