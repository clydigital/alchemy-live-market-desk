import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ReadyTranscriptCache,
  TranscriptDebtInput,
  TranscriptIntakeItem,
  TranscriptPipelineStore,
  TranscriptProvider,
} from "@/lib/transcript-pipeline";
import type { TranscriptApiError, TranscriptApiRetrieval } from "@/lib/transcriptapi";
import { SupabaseTranscriptStore } from "@/lib/youtube-transcript-persistence";

function throwIfError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function providerLabel(provider: TranscriptProvider) {
  return provider === "supadata" ? "Supadata" : "TranscriptAPI";
}

/**
 * Provider-aware persistence shim for Supadata. It delegates the existing
 * cache/debt/run-state behaviour to the canonical transcript store and only
 * owns the provider-specific transcript/failure writes and provenance.
 */
export class SupadataTranscriptStore implements TranscriptPipelineStore {
  private readonly client: SupabaseClient;
  private readonly delegate: SupabaseTranscriptStore;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.delegate = new SupabaseTranscriptStore(client);
  }

  async findReadyTranscript(videoId: string): Promise<ReadyTranscriptCache | null> {
    const cached = await this.delegate.findReadyTranscript(videoId);
    if (!cached) return null;
    const { data, error } = await this.client
      .from("research_intake_items")
      .select("transcript_provider")
      .eq("id", cached.itemId)
      .maybeSingle<{ transcript_provider: string | null }>();
    throwIfError(error, "Could not read transcript provider provenance");
    const provider: TranscriptProvider = data?.transcript_provider === "supadata" ? "supadata" : "transcriptapi";
    return { ...cached, provider };
  }

  findVideoItem(videoId: string) {
    return this.delegate.findVideoItem(videoId);
  }

  async saveSuccess(
    item: TranscriptIntakeItem,
    retrieval: TranscriptApiRetrieval,
    attemptedAt: string,
    provider: TranscriptProvider,
  ) {
    const transcript = retrieval.transcript;
    const label = providerLabel(provider);
    const { error } = await this.client
      .from("research_intake_items")
      .update({
        transcript_status: "ready",
        transcript_provider: provider,
        transcript_text: transcript.text,
        transcript_language: transcript.language,
        transcript_segments: transcript.segments,
        transcript_retrieved_at: attemptedAt,
        transcript_attempted_at: attemptedAt,
        transcript_error_code: null,
        transcript_error_message: null,
        transcript_http_status: transcript.httpStatus,
        transcript_retryable: false,
        transcript_attempt_count: item.attemptCount + 1,
        transcript_duration_seconds: transcript.durationSeconds,
        transcript_metadata: {
          ...retrieval.info,
          ...transcript.metadata,
          cacheStatus: transcript.cacheStatus,
        },
        video_review_status: "transcript_only",
        status: "accepted",
        review_reason: `Transcript retrieved through ${label}; creator claims remain subject to verification.`,
        updated_at: attemptedAt,
      })
      .eq("id", item.id)
      .neq("transcript_status", "ready");
    throwIfError(error, `Could not persist the ${label} transcript`);
  }

  async saveFailure(
    item: TranscriptIntakeItem,
    failure: TranscriptApiError,
    attemptedAt: string,
    provider: TranscriptProvider,
  ) {
    const label = providerLabel(provider);
    const { error } = await this.client
      .from("research_intake_items")
      .update({
        transcript_status: failure.retryable ? "missing" : "unavailable",
        transcript_provider: provider,
        transcript_attempted_at: attemptedAt,
        transcript_error_code: failure.code,
        transcript_error_message: failure.message.slice(0, 1_000),
        transcript_http_status: failure.httpStatus,
        transcript_retryable: failure.retryable,
        transcript_attempt_count: item.attemptCount + 1,
        video_review_status: failure.retryable ? null : "unavailable",
        status: "blocked",
        review_reason: `${label} failed with ${failure.code}; creator claims remain blocked.`,
        updated_at: attemptedAt,
      })
      .eq("id", item.id)
      .neq("transcript_status", "ready");
    throwIfError(error, `Could not persist the ${label} failure`);
  }

  upsertDebt(item: TranscriptIntakeItem, debt: TranscriptDebtInput) {
    return this.delegate.upsertDebt(item, debt);
  }

  async resolveDebt(videoId: string, attemptedAt: string) {
    const { error } = await this.client
      .from("research_debt")
      .update({
        status: "resolved",
        resolved_at: attemptedAt,
        resolution_note: "Transcript retrieved and stored.",
        next_check_at: null,
        updated_at: attemptedAt,
      })
      .eq("debt_key", `transcript:youtube:${videoId}`)
      .eq("status", "open");
    throwIfError(error, "Could not resolve transcript research debt");
  }

  recalculateRunState(runId: string) {
    return this.delegate.recalculateRunState(runId);
  }
}
