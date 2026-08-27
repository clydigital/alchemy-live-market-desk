import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { XwadaChannelKey, XwadaVideo } from "./youtube-reliability.ts";
import type {
  ReadyTranscriptCache,
  TranscriptDebtInput,
  TranscriptIntakeItem,
  TranscriptPipelineResult,
  TranscriptPipelineStore,
} from "./transcript-pipeline.ts";
import type { TranscriptApiError, TranscriptApiRetrieval, TranscriptSegment } from "./transcriptapi.ts";

export type VideoResearchSlot = "video_midnight" | "video_late_morning";

type IntakeRow = {
  id: string;
  run_id: string;
  external_id: string | null;
  publisher: string;
  title: string;
  url: string;
  transcript_status: "ready" | "missing" | "unavailable" | "not_applicable";
  transcript_text?: string | null;
  transcript_language?: string | null;
  transcript_segments?: unknown;
  transcript_duration_seconds?: number | null;
  transcript_metadata?: unknown;
  transcript_retrieved_at?: string | null;
  transcript_attempted_at?: string | null;
  transcript_error_code?: string | null;
  transcript_error_message?: string | null;
  transcript_http_status?: number | null;
  transcript_retryable?: boolean | null;
  transcript_attempt_count?: number | null;
};

type RunRow = {
  id: string;
  run_key: string;
  schedule_slot: string;
  scheduled_for: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "blocked" | "failed";
  warnings: string[];
  process_log: Array<Record<string, unknown>>;
};

function throwIfError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((segment): TranscriptSegment[] => {
    if (!segment || typeof segment !== "object" || Array.isArray(segment)) return [];
    const row = segment as Record<string, unknown>;
    const startSeconds = Number(row.startSeconds);
    const durationSeconds = Number(row.durationSeconds);
    const endSeconds = Number(row.endSeconds);
    const text = typeof row.text === "string" ? row.text : "";
    if (!text || !Number.isFinite(startSeconds) || !Number.isFinite(durationSeconds) || !Number.isFinite(endSeconds)) return [];
    return [{ startSeconds, durationSeconds, endSeconds, text }];
  });
}

function toIntakeItem(row: IntakeRow): TranscriptIntakeItem {
  return {
    id: row.id,
    runId: row.run_id,
    videoId: row.external_id || "",
    publisher: row.publisher,
    title: row.title,
    url: row.url,
    transcriptStatus: row.transcript_status,
    transcriptRetryable: row.transcript_retryable ?? null,
    transcriptErrorCode: row.transcript_error_code ?? null,
    transcriptErrorMessage: row.transcript_error_message ?? null,
    transcriptHttpStatus: row.transcript_http_status ?? null,
    required: true,
    attemptCount: row.transcript_attempt_count ?? 0,
  };
}

export class SupabaseTranscriptStore implements TranscriptPipelineStore {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? createSupabaseAdminClient();
  }

  async findReadyTranscript(videoId: string): Promise<ReadyTranscriptCache | null> {
    const { data, error } = await this.client
      .from("research_intake_items")
      .select("id,run_id,external_id,publisher,title,url,transcript_status,transcript_text,transcript_language,transcript_segments,transcript_duration_seconds,transcript_metadata,transcript_retrieved_at,transcript_attempt_count")
      .eq("item_type", "video")
      .eq("external_id", videoId)
      .eq("transcript_status", "ready")
      .not("transcript_text", "is", null)
      .order("transcript_retrieved_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<IntakeRow>();
    throwIfError(error, "Could not read the transcript cache");
    if (!data?.transcript_text?.trim()) return null;
    return {
      itemId: data.id,
      runId: data.run_id,
      retrievedAt: data.transcript_retrieved_at || new Date(0).toISOString(),
      transcript: {
        videoId,
        language: data.transcript_language || "unknown",
        segments: asSegments(data.transcript_segments),
        text: data.transcript_text,
        durationSeconds: data.transcript_duration_seconds ?? null,
        metadata: asRecord(data.transcript_metadata),
        httpStatus: 200,
        cacheStatus: "DATABASE-HIT",
      },
    };
  }

  async findVideoItem(videoId: string): Promise<TranscriptIntakeItem | null> {
    const { data, error } = await this.client
      .from("research_intake_items")
      .select("id,run_id,external_id,publisher,title,url,transcript_status,transcript_attempted_at,transcript_error_code,transcript_error_message,transcript_http_status,transcript_retryable,transcript_attempt_count")
      .eq("item_type", "video")
      .eq("external_id", videoId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<IntakeRow>();
    throwIfError(error, "Could not locate the video intake item");
    return data ? toIntakeItem(data) : null;
  }

  async saveSuccess(item: TranscriptIntakeItem, retrieval: TranscriptApiRetrieval, attemptedAt: string) {
    const transcript = retrieval.transcript;
    const { error } = await this.client
      .from("research_intake_items")
      .update({
        transcript_status: "ready",
        transcript_provider: "transcriptapi",
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
        review_reason: "Transcript retrieved through TranscriptAPI; creator claims remain subject to verification.",
        updated_at: attemptedAt,
      })
      .eq("id", item.id)
      .neq("transcript_status", "ready");
    throwIfError(error, "Could not persist the TranscriptAPI transcript");
  }

  async saveFailure(item: TranscriptIntakeItem, failure: TranscriptApiError, attemptedAt: string) {
    const { error } = await this.client
      .from("research_intake_items")
      .update({
        transcript_status: failure.retryable ? "missing" : "unavailable",
        transcript_provider: "transcriptapi",
        transcript_attempted_at: attemptedAt,
        transcript_error_code: failure.code,
        transcript_error_message: failure.message.slice(0, 1_000),
        transcript_http_status: failure.httpStatus,
        transcript_retryable: failure.retryable,
        transcript_attempt_count: item.attemptCount + 1,
        video_review_status: failure.retryable ? null : "unavailable",
        status: "blocked",
        review_reason: `TranscriptAPI failed with ${failure.code}; creator claims remain blocked.`,
        updated_at: attemptedAt,
      })
      .eq("id", item.id)
      .neq("transcript_status", "ready");
    throwIfError(error, "Could not persist the TranscriptAPI failure");
  }

  async upsertDebt(item: TranscriptIntakeItem, debt: TranscriptDebtInput) {
    const metadata = {
      provider: debt.provider,
      videoId: debt.videoId,
      publisher: debt.publisher,
      errorCode: debt.errorCode,
      httpStatus: debt.httpStatus,
      retryable: debt.retryable,
      retryAfterSeconds: debt.retryAfterSeconds,
      disposition: debt.retryable ? "retry_scheduled" : debt.nextCheckAt ? "revalidation_scheduled" : "permanent_unavailable",
      lastAttemptedAt: debt.attemptedAt,
      attemptCount: item.attemptCount + 1,
    };
    const { data: existing, error: readError } = await this.client
      .from("research_debt")
      .select("id")
      .eq("debt_key", debt.debtKey)
      .eq("status", "open")
      .limit(1)
      .maybeSingle<{ id: string }>();
    throwIfError(readError, "Could not read transcript research debt");
    if (existing) {
      const { error } = await this.client.from("research_debt").update({
        research_run_id: item.runId,
        severity: "high",
        reason: debt.reason,
        next_action: debt.nextAction,
        last_attempt_at: debt.attemptedAt,
        next_check_at: debt.nextCheckAt,
        metadata,
        updated_at: debt.attemptedAt,
      }).eq("id", existing.id);
      throwIfError(error, "Could not update transcript research debt");
      return;
    }
    const payload = {
      research_run_id: item.runId,
      debt_key: debt.debtKey,
      severity: "high",
      status: "open",
      reason: debt.reason,
      next_action: debt.nextAction,
      last_attempt_at: debt.attemptedAt,
      next_check_at: debt.nextCheckAt,
      metadata,
      updated_at: debt.attemptedAt,
    };
    const { error } = await this.client.from("research_debt").insert(payload);
    if (!error) return;
    if ((error as { code?: string }).code !== "23505") throwIfError(error, "Could not create transcript research debt");
    const { data: raced, error: racedReadError } = await this.client
      .from("research_debt")
      .select("id")
      .eq("debt_key", debt.debtKey)
      .eq("status", "open")
      .limit(1)
      .maybeSingle<{ id: string }>();
    throwIfError(racedReadError, "Could not recover a concurrent transcript debt upsert");
    if (!raced) throw error;
    const { error: racedUpdateError } = await this.client.from("research_debt").update(payload).eq("id", raced.id);
    throwIfError(racedUpdateError, "Could not finish a concurrent transcript debt upsert");
  }

  async resolveDebt(videoId: string, attemptedAt: string) {
    const { error } = await this.client
      .from("research_debt")
      .update({
        status: "resolved",
        resolved_at: attemptedAt,
        resolution_note: "TranscriptAPI transcript retrieved and stored.",
        next_check_at: null,
        updated_at: attemptedAt,
      })
      .eq("debt_key", `transcript:youtube:${videoId}`)
      .eq("status", "open");
    throwIfError(error, "Could not resolve transcript research debt");
  }

  async recalculateRunState(runId: string) {
    const { data: items, error: itemsError } = await this.client
      .from("research_intake_items")
      .select("external_id,transcript_status,transcript_error_code,transcript_retryable")
      .eq("run_id", runId)
      .eq("item_type", "video");
    throwIfError(itemsError, "Could not recalculate transcript run state");
    const videos = items || [];
    const readyVideos = videos.filter((item) => item.transcript_status === "ready");
    const ready = readyVideos.length;
    const readyVideoIds = readyVideos
      .map((item) => item.external_id)
      .filter((value): value is string => Boolean(value));
    const { data: run, error: runError } = await this.client
      .from("research_runs")
      .select("id,run_key,schedule_slot,scheduled_for,started_at,completed_at,status,warnings,process_log")
      .eq("id", runId)
      .maybeSingle<RunRow>();
    throwIfError(runError, "Could not read the transcript research run");
    if (!run) return;
    const stageStatus = !videos.length ? "not_required" : ready === videos.length ? "complete" : ready ? "partial" : "blocked";
    const stageEntry = {
      stage: "transcribe_and_review_videos",
      status: stageStatus,
      videos: videos.length,
      ready,
      failures: videos.filter((item) => item.transcript_status !== "ready").map((item) => ({
        videoId: item.external_id,
        errorCode: item.transcript_error_code,
        retryable: item.transcript_retryable,
      })),
    };
    const processLog = [...(run.process_log || [])];
    const stageIndex = processLog.findIndex((entry) => entry.stage === "transcribe_and_review_videos");
    if (stageIndex >= 0) processLog[stageIndex] = stageEntry;
    else processLog.push(stageEntry);
    const warnings = (run.warnings || []).filter(
      (warning) => !readyVideoIds.some((videoId) => warning.includes(videoId)),
    );
    const { error: updateError } = await this.client.from("research_runs").update({
      videos_found: videos.length,
      transcripts_ready: ready,
      process_log: processLog,
      warnings,
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    throwIfError(updateError, "Could not update transcript run counters");

    if (!(["video_midnight", "video_late_morning"] as string[]).includes(run.schedule_slot)) return;
    const status = ready === videos.length ? "completed" : ready ? "partial" : "blocked";
    const healthState = ready === videos.length ? "healthy" : ready ? "degraded" : "blocked";
    const transcriptStatus = ready === videos.length ? "complete" : ready ? "partial" : "blocked";
    const { error: slotError } = await this.client.from("research_slot_runs").upsert({
      research_run_id: run.id,
      slot_key: run.schedule_slot,
      scheduled_for: run.scheduled_for,
      started_at: run.started_at,
      completed_at: run.completed_at,
      last_heartbeat_at: new Date().toISOString(),
      status,
      health_state: healthState,
      ingestion_status: "complete",
      transcript_status: transcriptStatus,
      verification_status: "not_required",
      live_publication_status: "not_required",
      hybrid_handoff_status: "not_required",
      videos_detected: videos.length,
      transcripts_saved: ready,
      stage_summary: { transcript: stageEntry },
      warnings,
      updated_at: new Date().toISOString(),
    }, { onConflict: "research_run_id" });
    throwIfError(slotError, "Could not update transcript slot state");
  }
}

export async function createVideoIntakeRun(input: {
  slot: VideoResearchSlot;
  runKey: string;
  scheduledFor: string;
  client?: SupabaseClient;
}) {
  const client = input.client ?? createSupabaseAdminClient();
  const now = new Date().toISOString();
  const initialLog = [
    { stage: "create_run", status: "complete", timestamp: now },
    { stage: "youtube_discovery_started", status: "running", timestamp: now },
    { stage: "detect_new_videos", status: "running", timestamp: now },
  ];
  const { data, error } = await client.from("research_runs").upsert({
    run_key: input.runKey,
    schedule_slot: input.slot,
    scheduled_for: input.scheduledFor,
    started_at: now,
    completed_at: null,
    status: "running",
    accuracy_gate: "blocked",
    required_sources_complete: false,
    evidence_gate_passed: false,
    source_checks: [],
    warnings: [],
    process_log: initialLog,
    summary: "Required creator video discovery and transcript intake.",
    updated_at: now,
  }, { onConflict: "run_key" }).select("id").single<{ id: string }>();
  throwIfError(error, "Could not create the video intake research run");
  if (!data) throw new Error("Could not create the video intake research run: no row returned.");
  const { error: slotError } = await client.from("research_slot_runs").upsert({
    research_run_id: data.id,
    slot_key: input.slot,
    scheduled_for: input.scheduledFor,
    started_at: now,
    last_heartbeat_at: now,
    status: "running",
    health_state: "unknown",
    ingestion_status: "running",
    transcript_status: "pending",
    verification_status: "not_required",
    live_publication_status: "not_required",
    hybrid_handoff_status: "not_required",
    stage_summary: { lastStage: "youtube_discovery_started", discovery: { status: "running" } },
    updated_at: now,
  }, { onConflict: "research_run_id" });
  throwIfError(slotError, "Could not create the video intake slot run");
  return { id: data.id, client };
}

export async function recordVideoIntakeStage(input: {
  runId: string;
  slot: VideoResearchSlot;
  stage: string;
  status: "running" | "complete" | "partial" | "failed" | "blocked";
  detail?: Record<string, unknown>;
  client?: SupabaseClient;
}) {
  const client = input.client ?? createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: run, error: runError } = await client
    .from("research_runs")
    .select("process_log")
    .eq("id", input.runId)
    .maybeSingle<{ process_log: Array<Record<string, unknown>> }>();
  throwIfError(runError, `Could not read process_log for stage ${input.stage}`);
  if (!run) throw new Error(`Could not record stage ${input.stage}: research run ${input.runId} not found.`);

  const processLog = [...(run.process_log || [])];
  const videoId = typeof input.detail?.videoId === "string" ? input.detail.videoId : null;
  const existingIndex = processLog.findIndex((entry) => (
    entry.stage === input.stage && (videoId ? entry.videoId === videoId : true)
  ));
  const newEntry = {
    stage: input.stage,
    status: input.status,
    timestamp: now,
    ...(input.detail || {}),
  };
  if (existingIndex >= 0) {
    processLog[existingIndex] = newEntry;
  } else {
    processLog.push(newEntry);
  }

  const { error: updateRunError } = await client.from("research_runs").update({
    process_log: processLog,
    updated_at: now,
  }).eq("id", input.runId);
  throwIfError(updateRunError, `Could not record stage ${input.stage} on research_runs`);

  const { error: updateSlotError } = await client.from("research_slot_runs").update({
    last_heartbeat_at: now,
    stage_summary: { lastStage: input.stage, lastStatus: input.status, timestamp: now, detail: input.detail },
    updated_at: now,
  }).eq("research_run_id", input.runId);
  throwIfError(updateSlotError, `Could not record stage ${input.stage} on research_slot_runs`);
}

export async function persistDiscoveryResult(input: {
  runId: string;
  slot: VideoResearchSlot;
  channelChecks: Array<{ source: string; status: string; itemCount: number; note?: string }>;
  discoveryFailures: Array<{ source: string; detail: string }>;
  videosDetected: number;
  client?: SupabaseClient;
}) {
  const client = input.client ?? createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: run, error: runReadError } = await client
    .from("research_runs")
    .select("process_log, warnings")
    .eq("id", input.runId)
    .maybeSingle<{ process_log: Array<Record<string, unknown>>; warnings: string[] }>();
  throwIfError(runReadError, "Could not read research_runs for discovery persistence");
  if (!run) throw new Error(`Could not persist discovery result: research run ${input.runId} not found.`);

  const warnings = [
    ...(run.warnings || []),
    ...input.discoveryFailures.map((failure) => `${failure.source}: ${failure.detail}`),
  ];

  const processLog = [...(run.process_log || [])];
  const updateStage = (stageName: string, status: string, detail?: Record<string, unknown>) => {
    const idx = processLog.findIndex((entry) => entry.stage === stageName);
    const entry = { stage: stageName, status, timestamp: now, ...(detail || {}) };
    if (idx >= 0) processLog[idx] = entry;
    else processLog.push(entry);
  };

  updateStage("youtube_discovery_started", "complete");
  updateStage("youtube_discovery_complete", input.discoveryFailures.length ? "partial" : "complete", {
    videosDetected: input.videosDetected,
    discoveryFailuresCount: input.discoveryFailures.length,
  });
  updateStage("detect_new_videos", input.discoveryFailures.length ? "partial" : "complete");

  const { error: runUpdateError } = await client.from("research_runs").update({
    source_checks: input.channelChecks,
    videos_found: input.videosDetected,
    warnings,
    process_log: processLog,
    updated_at: now,
  }).eq("id", input.runId);
  throwIfError(runUpdateError, "Could not update research_runs for discovery persistence");

  const { error: slotUpdateError } = await client.from("research_slot_runs").update({
    last_heartbeat_at: now,
    ingestion_status: input.discoveryFailures.length ? "partial" : "complete",
    videos_detected: input.videosDetected,
    stage_summary: {
      lastStage: "youtube_discovery_complete",
      discovery: { status: input.discoveryFailures.length ? "partial" : "complete", videosDetected: input.videosDetected },
    },
    warnings,
    updated_at: now,
  }).eq("research_run_id", input.runId);
  throwIfError(slotUpdateError, "Could not update research_slot_runs for discovery persistence");
}

export async function failVideoIntakeRun(input: {
  runId: string;
  slot: VideoResearchSlot;
  stage: string;
  error: unknown;
  client?: SupabaseClient;
}) {
  const client = input.client ?? createSupabaseAdminClient();
  const now = new Date().toISOString();
  const errorMessage = input.error instanceof Error ? input.error.message : String(input.error);
  const errorSummary = `Execution failed at stage '${input.stage}': ${errorMessage.slice(0, 500)}`;

  let processLog: Array<Record<string, unknown>> = [];
  let warnings: string[] = [];

  try {
    const { data: run } = await client
      .from("research_runs")
      .select("process_log, warnings")
      .eq("id", input.runId)
      .maybeSingle<{ process_log: Array<Record<string, unknown>>; warnings: string[] }>();

    processLog = [...(run?.process_log || [])];
    warnings = [...(run?.warnings || [])];
  } catch {
    // Best-effort read
  }

  const idx = processLog.findIndex((entry) => entry.stage === input.stage);
  const failureEntry = { stage: input.stage, status: "failed", error: errorMessage, timestamp: now };
  if (idx >= 0) processLog[idx] = failureEntry;
  else processLog.push(failureEntry);

  warnings.push(errorSummary);

  const { error: runError } = await client.from("research_runs").update({
    completed_at: now,
    status: "failed",
    summary: errorSummary,
    process_log: processLog,
    warnings,
    updated_at: now,
  }).eq("id", input.runId);

  const { error: slotError } = await client.from("research_slot_runs").update({
    completed_at: now,
    last_heartbeat_at: now,
    status: "failed",
    health_state: "failed",
    ingestion_status: "failed",
    transcript_status: "failed",
    stage_summary: { lastStage: input.stage, lastStatus: "failed", error: errorMessage },
    warnings,
    updated_at: now,
  }).eq("research_run_id", input.runId);

  if (runError || slotError) {
    throw new Error(
      `failVideoIntakeRun failed to persist terminal failure state: ` +
      `runError=${runError?.message || "none"}, slotError=${slotError?.message || "none"}`
    );
  }
}

export async function ensureVideoIntakeItem(input: {
  runId: string;
  channelKey: XwadaChannelKey;
  video: XwadaVideo;
  client?: SupabaseClient;
}) {
  const client = input.client ?? createSupabaseAdminClient();
  const itemKey = `youtube:${input.channelKey}:${input.video.videoId}`;
  const select = "id,run_id,external_id,publisher,title,url,transcript_status,transcript_attempted_at,transcript_error_code,transcript_error_message,transcript_http_status,transcript_retryable,transcript_attempt_count";
  const { data: existing, error: readError } = await client
    .from("research_intake_items")
    .select(select)
    .eq("item_key", itemKey)
    .maybeSingle<IntakeRow>();
  throwIfError(readError, "Could not read the canonical video intake item");
  if (existing) {
    const { error } = await client.from("research_intake_items").update({
      title: input.video.title,
      url: input.video.url,
      published_at: input.video.publishedAt,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    throwIfError(error, "Could not refresh video intake metadata");
    return toIntakeItem(existing);
  }
  const { data, error } = await client.from("research_intake_items").insert({
    run_id: input.runId,
    item_key: itemKey,
    item_type: "video",
    publisher: input.video.channelName,
    external_id: input.video.videoId,
    title: input.video.title,
    url: input.video.url,
    published_at: input.video.publishedAt,
    transcript_status: "missing",
    transcript_provider: null,
    summary: "New monitored creator video discovered; transcript collection and claim verification are pending.",
    affected_story_slugs: [],
    source_quality: 80,
    relevance: 70,
    novelty: 80,
    materiality: 65,
    candidate_score: 73,
    recommended_action: "collect_evidence",
    status: "blocked",
    news_signal: "Monitored creator video discovered; claims remain blocked pending transcript retrieval.",
    divergence_kind: "none",
    evidence_links: [{ url: input.video.url, kind: "direct_video" }],
    review_reason: "Transcript collection is pending.",
    updated_at: new Date().toISOString(),
  }).select(select).single<IntakeRow>();
  throwIfError(error, "Could not persist the discovered video intake item");
  if (!data) throw new Error("Could not persist the discovered video intake item: no row returned.");
  return toIntakeItem(data);
}

export async function finalizeVideoIntakeRun(input: {
  runId: string;
  slot: VideoResearchSlot;
  channelChecks: Array<{ source: string; status: string; itemCount: number; note?: string }>;
  results: TranscriptPipelineResult[];
  knownUnavailableVideos?: Array<{
    videoId: string;
    errorCode: string | null;
    errorMessage: string | null;
    httpStatus: number | null;
  }>;
  deferredVideoIds?: string[];
  discoveryFailures: Array<{ source: string; detail: string }>;
  client?: SupabaseClient;
}) {
  const client = input.client ?? createSupabaseAdminClient();
  const completedAt = new Date().toISOString();
  const ready = input.results.filter((result) => result.status === "ready").length;
  const failures = input.results.filter((result) => result.status === "failed");
  const knownUnavailableVideos = input.knownUnavailableVideos || [];
  const deferredVideoIds = input.deferredVideoIds || [];
  const warnings = [
    ...input.discoveryFailures.map((failure) => `${failure.source}: ${failure.detail}`),
    ...failures.map((failure) => failure.status === "failed"
      ? `${failure.videoId}: transcript provider ${failure.errorCode}${failure.httpStatus ? ` (HTTP ${failure.httpStatus})` : ""}; retryable=${failure.retryable}.`
      : ""),
    ...knownUnavailableVideos.map((video) => (
      `${video.videoId}: prior transcript provider ${video.errorCode || "unavailable"}${video.httpStatus ? ` (HTTP ${video.httpStatus})` : ""}; retryable=false; skipped without a provider request.`
    )),
    ...(deferredVideoIds.length
      ? [`${deferredVideoIds.length} discovered video(s) were persisted but deferred to a later cycle to stay within the scheduled intake budget.`]
      : []),
  ].filter(Boolean);
  const blocked = Boolean(input.discoveryFailures.length || failures.length || knownUnavailableVideos.length);
  const { data: existingRun } = await client
    .from("research_runs")
    .select("process_log")
    .eq("id", input.runId)
    .maybeSingle<{ process_log: Array<Record<string, unknown>> }>();

  const processLog = [...(existingRun?.process_log || [])];
  const updateStage = (stageName: string, status: string, detail?: Record<string, unknown>) => {
    const idx = processLog.findIndex((entry) => entry.stage === stageName);
    const entry = { stage: stageName, status, timestamp: completedAt, ...(detail || {}) };
    if (idx >= 0) processLog[idx] = entry;
    else processLog.push(entry);
  };

  updateStage("detect_new_videos", input.discoveryFailures.length ? "partial" : "complete");
  updateStage(
    "transcribe_and_review_videos",
    failures.length || knownUnavailableVideos.length
      ? (ready ? "partial" : "blocked_for_detected_video")
      : deferredVideoIds.length ? "partial" : "complete",
    {
      ready,
      failed: failures.length,
      knownUnavailable: knownUnavailableVideos.length,
      deferred: deferredVideoIds.length,
    },
  );
  const { error } = await client.from("research_runs").update({
    completed_at: completedAt,
    status: blocked ? "blocked" : "completed",
    source_checks: input.channelChecks,
    videos_found: input.results.length + knownUnavailableVideos.length + deferredVideoIds.length,
    transcripts_ready: ready,
    warnings,
    process_log: processLog,
    summary: blocked
      ? "Video discovery completed with unresolved transcript requirements recorded as research debt."
      : deferredVideoIds.length
        ? "Video discovery completed; bounded transcript intake deferred remaining videos to a later cycle."
        : "Video discovery and transcript persistence completed.",
    updated_at: completedAt,
  }).eq("id", input.runId);
  throwIfError(error, "Could not finalize the video intake research run");
  const transcriptStatus = failures.length || knownUnavailableVideos.length ? (ready ? "partial" : "blocked") : deferredVideoIds.length ? "partial" : "complete";
  const { error: slotError } = await client.from("research_slot_runs").update({
    completed_at: completedAt,
    last_heartbeat_at: completedAt,
    status: blocked ? "blocked" : "completed",
    health_state: blocked || deferredVideoIds.length ? "degraded" : "healthy",
    ingestion_status: input.discoveryFailures.length ? "partial" : "complete",
    transcript_status: transcriptStatus,
    verification_status: "not_required",
    live_publication_status: "not_required",
    hybrid_handoff_status: "not_required",
    videos_detected: input.results.length + knownUnavailableVideos.length + deferredVideoIds.length,
    transcripts_saved: ready,
    stage_summary: { discovery: processLog[0], transcript: processLog[1] },
    warnings,
    updated_at: completedAt,
  }).eq("research_run_id", input.runId);
  throwIfError(slotError, "Could not finalize the video intake slot run");
}
