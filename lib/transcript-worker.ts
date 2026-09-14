import { randomUUID } from "node:crypto";

import type { TranscriptResearchReview } from "./transcript-research-review-contract.ts";
import {
  normalizeTranscriptApiError,
  TranscriptApiError,
  type TranscriptApiRetrieval,
} from "./transcriptapi.ts";

export const MAX_CLAIM_LIMIT = 25;
export const DEFAULT_BATCH_SIZE = 15;
export const MAX_CONCURRENCY = 3;
export const DEFAULT_SOFT_DEADLINE_MS = 240_000;
export const DEFAULT_CLAIM_HEADROOM_MS = 45_000;

export type ClaimedTranscriptJob = {
  id: string;
  runId: string;
  itemKey: string;
  videoId: string;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
  transcriptStatus: "ready" | "missing" | "unavailable" | "not_applicable";
  transcriptText: string | null;
  transcriptProvider: string | null;
  transcriptAttemptCount: number;
  videoReviewStatus: string | null;
  claimToken: string;
  leaseExpiresAt: string;
  jobAttemptCount: number;
  interpretedAt: string | null;
  evidenceId: string | null;
};

export type TranscriptWorkerStore = {
  claim(input: { workerId: string; batchSize: number; leaseSeconds: number }): Promise<ClaimedTranscriptJob[]>;
  renew(job: ClaimedTranscriptJob, leaseSeconds: number): Promise<boolean>;
  saveTranscript(job: ClaimedTranscriptJob, retrieval: TranscriptApiRetrieval, attemptedAt: string): Promise<void>;
  saveExtractionFailure(job: ClaimedTranscriptJob, error: TranscriptApiError, attemptedAt: string, nextAttemptAt: string | null): Promise<void>;
  saveInterpretation(job: ClaimedTranscriptJob, review: TranscriptResearchReview, interpretedAt: string): Promise<void>;
  findEvidence(job: ClaimedTranscriptJob): Promise<string | null>;
  persistEvidence(job: ClaimedTranscriptJob): Promise<string>;
  complete(job: ClaimedTranscriptJob, evidenceId: string, completedAt: string): Promise<void>;
  retry(job: ClaimedTranscriptJob, error: Error, nextAttemptAt: string): Promise<void>;
  fail(job: ClaimedTranscriptJob, error: Error, completedAt: string): Promise<void>;
};

export type TranscriptWorkerDependencies = {
  store: TranscriptWorkerStore;
  extract: (videoId: string) => Promise<TranscriptApiRetrieval>;
  interpret: (job: ClaimedTranscriptJob) => Promise<TranscriptResearchReview>;
  now?: () => Date;
  clock?: () => number;
  batchSize?: number;
  maxConcurrency?: number;
  softDeadlineMs?: number;
  claimHeadroomMs?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
};

export class LostTranscriptLeaseError extends Error {
  constructor() {
    super("Transcript job lease is no longer owned by this worker.");
    this.name = "LostTranscriptLeaseError";
  }
}

export type TranscriptWorkerStageTimings = {
  extraction: number;
  interpretation: number;
  evidence: number;
  completion: number;
  total: number;
};

export type TranscriptWorkerOutcome = {
  itemId: string;
  videoId: string;
  status: "completed" | "retryable" | "blocked" | "failed" | "lease_lost";
  resumedFrom: "extraction" | "interpretation" | "evidence" | "completion";
  evidenceId?: string;
  errorCode?: string;
  error?: string;
  timingsMs: TranscriptWorkerStageTimings;
};

function retryAt(now: Date, seconds: number) {
  return new Date(now.getTime() + Math.max(60, seconds) * 1_000).toISOString();
}

function elapsed(clock: () => number, startedAt: number) {
  return Math.max(0, Math.round(clock() - startedAt));
}

async function assertLease(store: TranscriptWorkerStore, job: ClaimedTranscriptJob, leaseSeconds: number) {
  if (!await store.renew(job, leaseSeconds)) throw new LostTranscriptLeaseError();
}

export async function processTranscriptJob(
  job: ClaimedTranscriptJob,
  dependencies: Omit<TranscriptWorkerDependencies, "batchSize" | "maxConcurrency" | "softDeadlineMs" | "claimHeadroomMs" | "maxAttempts"> & { maxAttempts: number },
): Promise<TranscriptWorkerOutcome> {
  const now = dependencies.now ?? (() => new Date());
  const clock = dependencies.clock ?? (() => Date.now());
  const jobStartedAt = clock();
  const timings = { extraction: 0, interpretation: 0, evidence: 0, completion: 0 };
  const leaseSeconds = Math.max(60, Math.min(dependencies.leaseSeconds ?? 300, 900));
  let stage: TranscriptWorkerOutcome["resumedFrom"] = job.evidenceId ? "completion"
    : job.videoReviewStatus === "reviewed" && job.interpretedAt ? "evidence"
      : job.transcriptStatus === "ready" && Boolean(job.transcriptText?.trim()) ? "interpretation"
        : "extraction";

  const outcome = (value: Omit<TranscriptWorkerOutcome, "timingsMs">): TranscriptWorkerOutcome => ({
    ...value,
    timingsMs: {
      ...timings,
      total: elapsed(clock, jobStartedAt),
    },
  });

  try {
    const completionStartedAt = clock();
    const existingEvidenceId = job.evidenceId ?? await dependencies.store.findEvidence(job);
    if (existingEvidenceId) {
      await dependencies.store.complete(job, existingEvidenceId, now().toISOString());
      timings.completion += elapsed(clock, completionStartedAt);
      return outcome({ itemId: job.id, videoId: job.videoId, status: "completed", resumedFrom: "completion", evidenceId: existingEvidenceId });
    }
    timings.completion += elapsed(clock, completionStartedAt);

    if (job.transcriptStatus !== "ready" || !job.transcriptText?.trim()) {
      stage = "extraction";
      const stageStartedAt = clock();
      await assertLease(dependencies.store, job, leaseSeconds);
      const attemptedAt = now().toISOString();
      let retrieval: TranscriptApiRetrieval;
      try {
        retrieval = await dependencies.extract(job.videoId);
        if (!retrieval.transcript.text.trim()) {
          throw new TranscriptApiError("The transcript provider returned no transcript text.", {
            code: "transcript_missing",
            httpStatus: retrieval.transcript.httpStatus,
            retryable: false,
          });
        }
      } catch (error) {
        const failure = normalizeTranscriptApiError(error);
        const nextAttemptAt = failure.retryable
          ? retryAt(now(), failure.retryAfterSeconds ?? 30 * 60)
          : null;
        await dependencies.store.saveExtractionFailure(job, failure, attemptedAt, nextAttemptAt);
        timings.extraction += elapsed(clock, stageStartedAt);
        return outcome({
          itemId: job.id,
          videoId: job.videoId,
          status: failure.retryable ? "retryable" : "blocked",
          resumedFrom: stage,
          errorCode: failure.code,
          error: failure.message,
        });
      }
      await dependencies.store.saveTranscript(job, retrieval, attemptedAt);
      timings.extraction += elapsed(clock, stageStartedAt);
      job = {
        ...job,
        transcriptStatus: "ready",
        transcriptText: retrieval.transcript.text,
        transcriptProvider: "supadata",
        transcriptAttemptCount: job.transcriptAttemptCount + 1,
        videoReviewStatus: "transcript_only",
      };
    }

    if (job.videoReviewStatus !== "reviewed" || !job.interpretedAt) {
      stage = "interpretation";
      const stageStartedAt = clock();
      try {
        await assertLease(dependencies.store, job, leaseSeconds);
        const interpretedAt = now().toISOString();
        const review = await dependencies.interpret(job);
        await dependencies.store.saveInterpretation(job, review, interpretedAt);
        job = { ...job, videoReviewStatus: "reviewed", interpretedAt };
      } finally {
        timings.interpretation += elapsed(clock, stageStartedAt);
      }
    }

    stage = "evidence";
    const evidenceStartedAt = clock();
    let evidenceId: string;
    try {
      await assertLease(dependencies.store, job, leaseSeconds);
      evidenceId = await dependencies.store.findEvidence(job) ?? await dependencies.store.persistEvidence(job);
      await dependencies.store.complete(job, evidenceId, now().toISOString());
    } finally {
      timings.evidence += elapsed(clock, evidenceStartedAt);
    }
    return outcome({ itemId: job.id, videoId: job.videoId, status: "completed", resumedFrom: stage, evidenceId });
  } catch (error) {
    if (error instanceof LostTranscriptLeaseError) {
      return outcome({ itemId: job.id, videoId: job.videoId, status: "lease_lost", resumedFrom: stage, error: error.message });
    }
    const failure = error instanceof Error ? error : new Error("Unknown transcript worker failure.");
    try {
      if (job.jobAttemptCount >= dependencies.maxAttempts) {
        await dependencies.store.fail(job, failure, now().toISOString());
        return outcome({ itemId: job.id, videoId: job.videoId, status: "failed", resumedFrom: stage, error: failure.message });
      }
      await dependencies.store.retry(job, failure, retryAt(now(), 30 * 60));
      return outcome({ itemId: job.id, videoId: job.videoId, status: "retryable", resumedFrom: stage, error: failure.message });
    } catch (stateError) {
      if (stateError instanceof LostTranscriptLeaseError) {
        return outcome({ itemId: job.id, videoId: job.videoId, status: "lease_lost", resumedFrom: stage, error: stateError.message });
      }
      throw stateError;
    }
  }
}

function averageNonZero(values: number[]) {
  const observed = values.filter((value) => value > 0);
  if (!observed.length) return null;
  return Math.round(observed.reduce((sum, value) => sum + value, 0) / observed.length);
}

function workerMetrics(outcomes: TranscriptWorkerOutcome[], durationMs: number) {
  const statusCounts: Record<TranscriptWorkerOutcome["status"], number> = {
    completed: 0,
    retryable: 0,
    blocked: 0,
    failed: 0,
    lease_lost: 0,
  };
  for (const result of outcomes) statusCounts[result.status] += 1;
  return {
    durationMs,
    processed: outcomes.length,
    statusCounts,
    averageStageMs: {
      extraction: averageNonZero(outcomes.map((result) => result.timingsMs.extraction)),
      interpretation: averageNonZero(outcomes.map((result) => result.timingsMs.interpretation)),
      evidence: averageNonZero(outcomes.map((result) => result.timingsMs.evidence)),
      total: averageNonZero(outcomes.map((result) => result.timingsMs.total)),
    },
  };
}

export async function runTranscriptWorker(dependencies: TranscriptWorkerDependencies) {
  const clock = dependencies.clock ?? (() => Date.now());
  const runStartedAt = clock();
  const batchSize = Math.max(1, Math.min(dependencies.batchSize ?? DEFAULT_BATCH_SIZE, MAX_CLAIM_LIMIT));
  const maxConcurrency = Math.max(1, Math.min(dependencies.maxConcurrency ?? MAX_CONCURRENCY, MAX_CONCURRENCY));
  const softDeadlineMs = Math.max(30_000, Math.min(dependencies.softDeadlineMs ?? DEFAULT_SOFT_DEADLINE_MS, 290_000));
  const claimHeadroomMs = Math.max(5_000, Math.min(dependencies.claimHeadroomMs ?? DEFAULT_CLAIM_HEADROOM_MS, softDeadlineMs - 1_000));
  const leaseSeconds = Math.max(60, Math.min(dependencies.leaseSeconds ?? 300, 900));
  const maxAttempts = Math.max(1, dependencies.maxAttempts ?? 6);
  const workerId = `transcript-worker:${randomUUID()}`;
  const outcomes: TranscriptWorkerOutcome[] = [];
  let claimed = 0;
  let claimCalls = 0;
  let stopReason: "batch_limit" | "queue_empty" | "soft_deadline" = "batch_limit";

  while (claimed < batchSize) {
    const elapsedMs = elapsed(clock, runStartedAt);
    if (elapsedMs >= softDeadlineMs - claimHeadroomMs) {
      stopReason = "soft_deadline";
      break;
    }

    const trancheSize = Math.min(maxConcurrency, batchSize - claimed);
    const jobs = await dependencies.store.claim({ workerId, batchSize: trancheSize, leaseSeconds });
    claimCalls += 1;
    if (!jobs.length) {
      stopReason = "queue_empty";
      break;
    }

    claimed += jobs.length;
    outcomes.push(...await Promise.all(
      jobs.map((job) => processTranscriptJob(job, {
        ...dependencies,
        leaseSeconds,
        maxAttempts,
      })),
    ));
  }

  const durationMs = elapsed(clock, runStartedAt);
  return {
    workerId,
    claimed,
    claimCalls,
    stopReason,
    capacity: {
      maxClaimLimit: MAX_CLAIM_LIMIT,
      requestedBatchSize: batchSize,
      maxConcurrency,
      claimTrancheSize: maxConcurrency,
      softDeadlineMs,
      claimHeadroomMs,
    },
    metrics: workerMetrics(outcomes, durationMs),
    outcomes,
  };
}
