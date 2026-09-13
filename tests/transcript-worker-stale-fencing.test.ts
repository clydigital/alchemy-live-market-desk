import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptResearchReview } from "../lib/transcript-research-review-contract.ts";
import {
  LostTranscriptLeaseError,
  processTranscriptJob,
  type ClaimedTranscriptJob,
  type TranscriptWorkerStore,
} from "../lib/transcript-worker.ts";
import type { TranscriptApiError, TranscriptApiRetrieval } from "../lib/transcriptapi.ts";

function createFixtureJob(overrides: Partial<ClaimedTranscriptJob> = {}): ClaimedTranscriptJob {
  return {
    id: "975ddfe0-5b7d-4d6c-b1e0-b3db23b7ed23",
    runId: "5dc5f543-12a3-4ded-a95c-25dfd2b50bd8",
    itemKey: "youtube:stockedup:GYne0nYFiqk",
    videoId: "GYne0nYFiqk",
    publisher: "StockedUp",
    title: "Tomorrow Will Be The Biggest Day Of The Week",
    url: "https://www.youtube.com/watch?v=GYne0nYFiqk",
    publishedAt: "2026-09-10T22:00:17.000Z",
    transcriptStatus: "ready",
    transcriptText: "Durable transcript text for testing.",
    transcriptProvider: "supadata",
    transcriptAttemptCount: 1,
    videoReviewStatus: "transcript_only",
    claimToken: "token-A",
    leaseExpiresAt: "2026-09-14T05:00:00.000Z",
    jobAttemptCount: 1,
    interpretedAt: null,
    evidenceId: null,
    ...overrides,
  };
}

const mockReview: TranscriptResearchReview = {
  summary: "Mock interpretation summary.",
  creatorLogic: "Logic details.",
  recontextualizedSummary: "Recontextualized summary.",
  termsDetected: ["yields"],
  claimChecks: [],
  expertNotes: [],
  affectedStorySlugs: [],
  researchLeadScore: 80,
};

class FencedMemoryStore implements TranscriptWorkerStore {
  readonly jobs = new Map<string, ClaimedTranscriptJob>();
  readonly evidenceByJobId = new Map<string, string>();
  persistedEvidenceCount = 0;

  constructor(initialJobs: ClaimedTranscriptJob[]) {
    for (const j of initialJobs) {
      this.jobs.set(j.id, { ...j });
    }
  }

  async claim(input: { workerId: string; batchSize: number; leaseSeconds: number }): Promise<ClaimedTranscriptJob[]> {
    const claimed: ClaimedTranscriptJob[] = [];
    const now = new Date();
    for (const job of this.jobs.values()) {
      if (claimed.length >= input.batchSize) break;
      const isExpired = new Date(job.leaseExpiresAt).getTime() <= now.getTime();
      if (job.claimToken === "" || isExpired) {
        const newToken = `token-${Math.random().toString(36).slice(2)}`;
        const updated = {
          ...job,
          claimToken: newToken,
          leaseExpiresAt: new Date(now.getTime() + input.leaseSeconds * 1000).toISOString(),
          jobAttemptCount: job.jobAttemptCount + 1,
        };
        this.jobs.set(job.id, updated);
        claimed.push(updated);
      }
    }
    return claimed;
  }

  reclaimJob(jobId: string, newToken = "token-B"): ClaimedTranscriptJob {
    const existing = this.jobs.get(jobId)!;
    const updated = {
      ...existing,
      claimToken: newToken,
      leaseExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      jobAttemptCount: existing.jobAttemptCount + 1,
    };
    this.jobs.set(jobId, updated);
    return updated;
  }

  private assertOwnership(job: ClaimedTranscriptJob) {
    const current = this.jobs.get(job.id);
    if (!current || current.claimToken !== job.claimToken) {
      throw new LostTranscriptLeaseError();
    }
  }

  async renew(job: ClaimedTranscriptJob, leaseSeconds: number): Promise<boolean> {
    const current = this.jobs.get(job.id);
    if (!current || current.claimToken !== job.claimToken) {
      return false;
    }
    current.leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();
    this.jobs.set(job.id, current);
    return true;
  }

  async saveTranscript(job: ClaimedTranscriptJob, retrieval: TranscriptApiRetrieval, _attemptedAt: string): Promise<void> {
    this.assertOwnership(job);
    const current = this.jobs.get(job.id)!;
    this.jobs.set(job.id, {
      ...current,
      transcriptStatus: "ready",
      transcriptText: retrieval.transcript.text,
      transcriptProvider: "supadata",
      videoReviewStatus: "transcript_only",
    });
  }

  async saveExtractionFailure(job: ClaimedTranscriptJob, error: TranscriptApiError, _attemptedAt: string, _nextAttemptAt: string | null): Promise<void> {
    this.assertOwnership(job);
    const current = this.jobs.get(job.id)!;
    this.jobs.set(job.id, {
      ...current,
      transcriptStatus: error.retryable ? "missing" : "unavailable",
      videoReviewStatus: error.retryable ? null : "unavailable",
    });
  }

  async saveInterpretation(job: ClaimedTranscriptJob, review: TranscriptResearchReview, interpretedAt: string): Promise<void> {
    this.assertOwnership(job);
    const current = this.jobs.get(job.id)!;
    this.jobs.set(job.id, {
      ...current,
      title: review.summary,
      videoReviewStatus: "reviewed",
      interpretedAt,
    });
  }

  async findEvidence(job: ClaimedTranscriptJob): Promise<string | null> {
    return this.evidenceByJobId.get(job.id) ?? null;
  }

  async persistEvidence(job: ClaimedTranscriptJob): Promise<string> {
    this.assertOwnership(job);
    let evidenceId = this.evidenceByJobId.get(job.id);
    if (!evidenceId) {
      evidenceId = `evidence-${job.id}`;
      this.evidenceByJobId.set(job.id, evidenceId);
      this.persistedEvidenceCount += 1;
    }
    return evidenceId;
  }

  async complete(job: ClaimedTranscriptJob, evidenceId: string, _completedAt: string): Promise<void> {
    this.assertOwnership(job);
    const current = this.jobs.get(job.id)!;
    this.jobs.set(job.id, {
      ...current,
      evidenceId,
      claimToken: "completed-token",
    });
  }

  async retry(job: ClaimedTranscriptJob, _error: Error, _nextAttemptAt: string): Promise<void> {
    this.assertOwnership(job);
    const current = this.jobs.get(job.id)!;
    this.jobs.set(job.id, {
      ...current,
      claimToken: "",
    });
  }

  async fail(job: ClaimedTranscriptJob, _error: Error, _completedAt: string): Promise<void> {
    this.assertOwnership(job);
    const current = this.jobs.get(job.id)!;
    this.jobs.set(job.id, {
      ...current,
      claimToken: "",
    });
  }
}

test("A. Stale interpretation writer: write rejected, token-B state untouched, ownership loss surfaced", async () => {
  const initialJob = createFixtureJob({ claimToken: "token-A" });
  const store = new FencedMemoryStore([initialJob]);

  const outcome = await processTranscriptJob(initialJob, {
    store,
    leaseSeconds: 300,
    maxAttempts: 6,
    extract: async () => { throw new Error("Extract not expected"); },
    interpret: async () => {
      // Simulate Worker B reclaiming the job while Worker A is performing async interpret work
      store.reclaimJob(initialJob.id, "token-B");
      return mockReview;
    },
  });

  assert.equal(outcome.status, "lease_lost");
  assert.equal(outcome.resumedFrom, "interpretation");

  // Token-B ownership state remains untouched
  const currentInStore = store.jobs.get(initialJob.id)!;
  assert.equal(currentInStore.claimToken, "token-B");
  assert.equal(currentInStore.videoReviewStatus, "transcript_only");
});

test("B. Stale completion writer: Worker A with token-A cannot mark job completed after token-B takes over", async () => {
  const initialJob = createFixtureJob({ claimToken: "token-A" });
  const store = new FencedMemoryStore([initialJob]);

  // Ownership changes to token-B
  store.reclaimJob(initialJob.id, "token-B");

  await assert.rejects(
    async () => {
      await store.complete(initialJob, "evidence-123", new Date().toISOString());
    },
    LostTranscriptLeaseError,
  );

  // DB/Store state still reflects token-B and not completed by token-A
  const currentInStore = store.jobs.get(initialJob.id)!;
  assert.equal(currentInStore.claimToken, "token-B");
  assert.notEqual(currentInStore.evidenceId, "evidence-123");
});

test("C. Stale retry/fail writer: error handling during loss of ownership surfaces lease_lost without changing job state", async () => {
  const initialJob = createFixtureJob({ claimToken: "token-A" });
  const store = new FencedMemoryStore([initialJob]);

  // Test retry path under lost ownership
  const outcomeRetry = await processTranscriptJob(initialJob, {
    store,
    leaseSeconds: 300,
    maxAttempts: 6,
    extract: async () => { throw new Error("Extract failed"); },
    interpret: async () => {
      store.reclaimJob(initialJob.id, "token-B");
      throw new Error("LLM provider transient timeout");
    },
  });

  assert.equal(outcomeRetry.status, "lease_lost");
  assert.equal(store.jobs.get(initialJob.id)!.claimToken, "token-B");

  // Test fail path under lost ownership
  const maxAttemptJob = createFixtureJob({ claimToken: "token-A", jobAttemptCount: 6 });
  const storeFail = new FencedMemoryStore([maxAttemptJob]);

  const outcomeFail = await processTranscriptJob(maxAttemptJob, {
    store: storeFail,
    leaseSeconds: 300,
    maxAttempts: 6,
    extract: async () => { throw new Error("Extract failed"); },
    interpret: async () => {
      storeFail.reclaimJob(maxAttemptJob.id, "token-B");
      throw new Error("Terminal interpretation failure");
    },
  });

  assert.equal(outcomeFail.status, "lease_lost");
  assert.equal(storeFail.jobs.get(maxAttemptJob.id)!.claimToken, "token-B");
});

test("D. Evidence idempotency: overlapping or sequential workers for same intake item yield single evidence identity", async () => {
  const initialJob = createFixtureJob({ claimToken: "token-1" });
  const store = new FencedMemoryStore([initialJob]);

  // Worker 1 processes job
  const result1 = await processTranscriptJob(initialJob, {
    store,
    leaseSeconds: 300,
    maxAttempts: 6,
    extract: async () => { throw new Error("Unused"); },
    interpret: async () => mockReview,
  });

  assert.equal(result1.status, "completed");
  const evidenceId1 = result1.evidenceId;
  assert.ok(evidenceId1);
  assert.equal(store.persistedEvidenceCount, 1);

  // Worker 2 processes same item (e.g., re-run or overlapping worker finding evidence)
  const worker2Job = createFixtureJob({ claimToken: "token-2" });
  store.jobs.set(worker2Job.id, worker2Job);

  const result2 = await processTranscriptJob(worker2Job, {
    store,
    leaseSeconds: 300,
    maxAttempts: 6,
    extract: async () => { throw new Error("Unused"); },
    interpret: async () => mockReview,
  });

  assert.equal(result2.status, "completed");
  assert.equal(result2.evidenceId, evidenceId1);
  // No duplicate evidence created
  assert.equal(store.persistedEvidenceCount, 1);
});
