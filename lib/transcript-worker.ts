import { randomUUID } from "node:crypto";

import type { TranscriptResearchReview } from "./transcript-research-review-contract.ts";
import {
  normalizeTranscriptApiError,
  TranscriptApiError,
  type TranscriptApiRetrieval,
} from "./transcriptapi.ts";

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
  batchSize?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
};

export class LostTranscriptLeaseError extends Error {
  constructor() {
    super("Transcript job lease is no longer owned by this worker.");
    this.name = "LostTranscriptLeaseError";
  }
}

export type TranscriptWorkerOutcome = {
  itemId: string;
  videoId: string;
  status: "completed" | "retryable" | "blocked" | "failed" | "lease_lost";
  resumedFrom: "extraction" | "interpretation" | "evidence" | "completion";
  evidenceId?: string;
  errorCode?: string;
  error?: string;
};

function retryAt(now: Date, seconds: number) {
  return new Date(now.getTime() + Math.max(60, seconds) * 1_000).toISOString();
}

async function assertLease(store: TranscriptWorkerStore, job: ClaimedTranscriptJob, leaseSeconds: number) {
  if (!await store.renew(job, leaseSeconds)) throw new LostTranscriptLeaseError();
}

export async function processTranscriptJob(
  job: ClaimedTranscriptJob,
  dependencies: Omit<TranscriptWorkerDependencies, "batchSize" | "maxAttempts"> & { maxAttempts: number },
): Promise<TranscriptWorkerOutcome> {
  const now = dependencies.now ?? (() => new Date());
  const leaseSeconds = Math.max(60, Math.min(dependencies.leaseSeconds ?? 300, 900));
  let stage: TranscriptWorkerOutcome["resumedFrom"] = job.evidenceId ? "completion"
    : job.videoReviewStatus === "reviewed" && job.interpretedAt ? "evidence"
      : job.transcriptStatus === "ready" && Boolean(job.transcriptText?.trim()) ? "interpretation"
        : "extraction";

  try {
    const existingEvidenceId = job.evidenceId ?? await dependencies.store.findEvidence(job);
    if (existingEvidenceId) {
      await dependencies.store.complete(job, existingEvidenceId, now().toISOString());
      return { itemId: job.id, videoId: job.videoId, status: "completed", resumedFrom: "completion", evidenceId: existingEvidenceId };
    }

    if (job.transcriptStatus !== "ready" || !job.transcriptText?.trim()) {
      stage = "extraction";
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
        return {
          itemId: job.id,
          videoId: job.videoId,
          status: failure.retryable ? "retryable" : "blocked",
          resumedFrom: stage,
          errorCode: failure.code,
          error: failure.message,
        };
      }
      await dependencies.store.saveTranscript(job, retrieval, attemptedAt);
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
      await assertLease(dependencies.store, job, leaseSeconds);
      const interpretedAt = now().toISOString();
      const review = await dependencies.interpret(job);
      await dependencies.store.saveInterpretation(job, review, interpretedAt);
      job = { ...job, videoReviewStatus: "reviewed", interpretedAt };
    }

    stage = "evidence";
    await assertLease(dependencies.store, job, leaseSeconds);
    const evidenceId = await dependencies.store.findEvidence(job) ?? await dependencies.store.persistEvidence(job);
    await dependencies.store.complete(job, evidenceId, now().toISOString());
    return { itemId: job.id, videoId: job.videoId, status: "completed", resumedFrom: stage, evidenceId };
  } catch (error) {
    if (error instanceof LostTranscriptLeaseError) {
      return { itemId: job.id, videoId: job.videoId, status: "lease_lost", resumedFrom: stage, error: error.message };
    }
    const failure = error instanceof Error ? error : new Error("Unknown transcript worker failure.");
    if (job.jobAttemptCount >= dependencies.maxAttempts) {
      await dependencies.store.fail(job, failure, now().toISOString());
      return { itemId: job.id, videoId: job.videoId, status: "failed", resumedFrom: stage, error: failure.message };
    }
    await dependencies.store.retry(job, failure, retryAt(now(), 30 * 60));
    return { itemId: job.id, videoId: job.videoId, status: "retryable", resumedFrom: stage, error: failure.message };
  }
}

export async function runTranscriptWorker(dependencies: TranscriptWorkerDependencies) {
  const batchSize = Math.max(1, Math.min(dependencies.batchSize ?? 1, 3));
  const leaseSeconds = Math.max(60, Math.min(dependencies.leaseSeconds ?? 300, 900));
  const maxAttempts = Math.max(1, dependencies.maxAttempts ?? 6);
  const workerId = `transcript-worker:${randomUUID()}`;
  const jobs = await dependencies.store.claim({ workerId, batchSize, leaseSeconds });
  const outcomes: TranscriptWorkerOutcome[] = [];
  for (const job of jobs) {
    outcomes.push(await processTranscriptJob(job, { ...dependencies, leaseSeconds, maxAttempts }));
  }
  return { workerId, claimed: jobs.length, outcomes };
}
