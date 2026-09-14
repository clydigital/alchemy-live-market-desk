import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicaliseIntake } from "./intelligence/runtime.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { TranscriptResearchReview } from "./transcript-research-review-contract.ts";
import {
  LostTranscriptLeaseError,
  type ClaimedTranscriptJob,
  type TranscriptWorkerStore,
} from "./transcript-worker.ts";
import type { TranscriptApiError, TranscriptApiRetrieval } from "./transcriptapi.ts";

type ClaimedRow = {
  id: string;
  run_id: string;
  item_key: string;
  external_id: string;
  publisher: string;
  title: string;
  url: string;
  published_at: string;
  transcript_status: ClaimedTranscriptJob["transcriptStatus"];
  transcript_text: string | null;
  transcript_provider: string | null;
  transcript_attempt_count: number;
  video_review_status: string | null;
  transcript_claim_token: string;
  transcript_lease_expires_at: string;
  transcript_job_attempt_count: number;
  transcript_interpreted_at: string | null;
  transcript_evidence_id: string | null;
};

function message(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function toJob(row: ClaimedRow): ClaimedTranscriptJob {
  return {
    id: row.id,
    runId: row.run_id,
    itemKey: row.item_key,
    videoId: row.external_id,
    publisher: row.publisher,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at,
    transcriptStatus: row.transcript_status,
    transcriptText: row.transcript_text,
    transcriptProvider: row.transcript_provider,
    transcriptAttemptCount: row.transcript_attempt_count ?? 0,
    videoReviewStatus: row.video_review_status,
    claimToken: row.transcript_claim_token,
    leaseExpiresAt: row.transcript_lease_expires_at,
    jobAttemptCount: row.transcript_job_attempt_count ?? 1,
    interpretedAt: row.transcript_interpreted_at,
    evidenceId: row.transcript_evidence_id,
  };
}

export class SupabaseTranscriptWorkerStore implements TranscriptWorkerStore {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient = createSupabaseAdminClient()) {
    this.client = client;
  }

  async claim(input: { workerId: string; batchSize: number; leaseSeconds: number }) {
    const { data, error } = await this.client.rpc("claim_transcript_jobs", {
      p_worker_id: input.workerId,
      p_batch_size: input.batchSize,
      p_lease_seconds: input.leaseSeconds,
    });
    message(error, "Could not atomically claim transcript jobs");
    return ((data ?? []) as ClaimedRow[]).map(toJob);
  }

  async ownedUpdate(job: ClaimedTranscriptJob, values: Record<string, unknown>, context: string) {
    const { data, error } = await this.client
      .from("research_intake_items")
      .update(values)
      .eq("id", job.id)
      .eq("transcript_job_status", "running")
      .eq("transcript_claim_token", job.claimToken)
      .select("id")
      .maybeSingle<{ id: string }>();
    message(error, context);
    if (!data) throw new LostTranscriptLeaseError();
  }

  async renew(job: ClaimedTranscriptJob, leaseSeconds: number) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Math.max(60, Math.min(leaseSeconds, 900)) * 1_000).toISOString();
    const { data, error } = await this.client
      .from("research_intake_items")
      .update({ transcript_lease_expires_at: expiresAt, updated_at: now.toISOString() })
      .eq("id", job.id)
      .eq("transcript_job_status", "running")
      .eq("transcript_claim_token", job.claimToken)
      .select("id")
      .maybeSingle<{ id: string }>();
    message(error, "Could not renew transcript job lease");
    return Boolean(data);
  }

  async saveTranscript(job: ClaimedTranscriptJob, retrieval: TranscriptApiRetrieval, attemptedAt: string) {
    const transcript = retrieval.transcript;
    await this.ownedUpdate(job, {
      transcript_status: "ready",
      transcript_provider: "supadata",
      transcript_text: transcript.text,
      transcript_language: transcript.language,
      transcript_segments: transcript.segments,
      transcript_retrieved_at: attemptedAt,
      transcript_attempted_at: attemptedAt,
      transcript_error_code: null,
      transcript_error_message: null,
      transcript_http_status: transcript.httpStatus,
      transcript_retryable: false,
      transcript_attempt_count: job.transcriptAttemptCount + 1,
      transcript_duration_seconds: transcript.durationSeconds,
      transcript_metadata: {
        ...retrieval.info,
        ...transcript.metadata,
        cacheStatus: transcript.cacheStatus,
      },
      video_review_status: "transcript_only",
      status: "blocked",
      review_reason: "Transcript persisted; structured creator review is pending.",
      updated_at: attemptedAt,
    }, "Could not checkpoint the Supadata transcript");
  }

  async saveExtractionFailure(
    job: ClaimedTranscriptJob,
    failure: TranscriptApiError,
    attemptedAt: string,
    nextAttemptAt: string | null,
  ) {
    await this.ownedUpdate(job, {
      transcript_status: failure.retryable ? "missing" : "unavailable",
      transcript_provider: "supadata",
      transcript_attempted_at: attemptedAt,
      transcript_error_code: failure.code,
      transcript_error_message: failure.message.slice(0, 1_000),
      transcript_http_status: failure.httpStatus,
      transcript_retryable: failure.retryable,
      transcript_attempt_count: job.transcriptAttemptCount + 1,
      video_review_status: failure.retryable ? null : "unavailable",
      transcript_job_status: failure.retryable ? "retryable" : "blocked",
      transcript_job_last_error: failure.message.slice(0, 1_000),
      transcript_next_attempt_at: nextAttemptAt,
      transcript_claim_token: null,
      transcript_lease_expires_at: null,
      status: "blocked",
      review_reason: failure.retryable
        ? `Supadata failed with ${failure.code}; a bounded retry is scheduled.`
        : `Supadata concluded ${failure.code}; transcript work is terminally blocked.`,
      updated_at: attemptedAt,
    }, "Could not persist the transcript extraction outcome");
  }

  async saveInterpretation(job: ClaimedTranscriptJob, review: TranscriptResearchReview, interpretedAt: string) {
    await this.ownedUpdate(job, {
      summary: review.summary || job.title,
      creator_logic: review.creatorLogic || null,
      recontextualized_summary: review.recontextualizedSummary || null,
      terms_detected: review.termsDetected,
      claim_checks: review.claimChecks,
      expert_notes: review.expertNotes,
      affected_story_slugs: review.affectedStorySlugs,
      video_review_status: "reviewed",
      transcript_interpreted_at: interpretedAt,
      status: "accepted",
      review_reason: "Transcript reviewed into a research lead. Creator claims remain non-canonical until independently corroborated.",
      updated_at: interpretedAt,
    }, "Could not checkpoint transcript interpretation");
  }

  async findEvidence(job: ClaimedTranscriptJob) {
    const { data, error } = await this.client
      .from("intelligence_evidence")
      .select("id")
      .eq("external_evidence_id", `research-intake:${job.id}`)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    message(error, "Could not inspect the transcript evidence checkpoint");
    return data?.id ?? null;
  }

  async persistEvidence(job: ClaimedTranscriptJob) {
    const { data, error } = await this.client
      .from("stories")
      .select("id,slug,title,thesis,status,confidence,market_question,dominant_narrative,strongest_support,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,assets,created_by,article_verdict")
      .neq("status", "archived")
      .neq("status", "discarded")
      .order("updated_at", { ascending: false });
    message(error, "Could not load Stories for transcript evidence routing");
    const evidenceIds = await canonicaliseIntake(
      (data ?? []) as Parameters<typeof canonicaliseIntake>[0],
      new Set([job.itemKey]),
    );
    const evidenceId = evidenceIds[0] ?? await this.findEvidence(job);
    if (!evidenceId) throw new Error("Canonical transcript evidence was not persisted.");
    return evidenceId;
  }

  complete(job: ClaimedTranscriptJob, evidenceId: string, completedAt: string) {
    return this.ownedUpdate(job, {
      transcript_job_status: "completed",
      transcript_evidence_id: evidenceId,
      transcript_job_completed_at: completedAt,
      transcript_job_last_error: null,
      transcript_next_attempt_at: null,
      transcript_claim_token: null,
      transcript_lease_expires_at: null,
      updated_at: completedAt,
    }, "Could not complete transcript job");
  }

  retry(job: ClaimedTranscriptJob, error: Error, nextAttemptAt: string) {
    return this.ownedUpdate(job, {
      transcript_job_status: "retryable",
      transcript_job_last_error: error.message.slice(0, 1_000),
      transcript_next_attempt_at: nextAttemptAt,
      transcript_claim_token: null,
      transcript_lease_expires_at: null,
      updated_at: new Date().toISOString(),
    }, "Could not release transcript job for retry");
  }

  fail(job: ClaimedTranscriptJob, error: Error, completedAt: string) {
    return this.ownedUpdate(job, {
      transcript_job_status: "failed",
      transcript_job_last_error: error.message.slice(0, 1_000),
      transcript_job_completed_at: completedAt,
      transcript_claim_token: null,
      transcript_lease_expires_at: null,
      updated_at: completedAt,
    }, "Could not persist terminal transcript worker failure");
  }
}
