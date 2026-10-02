import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { scheduledVideoRunIdentity, type ScheduledVideoSlot } from "./scheduled-video-identity.ts";
import { runScheduledVideoIntake } from "./video-intake-service.ts";

export const VIDEO_DISCOVERY_STALE_MS = 15 * 60 * 1_000;

export type ScheduledVideoDiscoveryCheckpoint = {
  runId: string;
  status: "running" | "completed" | "blocked" | "failed";
  sourceChecks: unknown[];
  processLog: Array<Record<string, unknown>>;
  updatedAt: string | null;
  ingestionStatus: string | null;
  lastHeartbeatAt: string | null;
};

export type ScheduledVideoRecoveryResult = {
  action: "reused" | "in_progress" | "recovered" | "failed";
  slot: ScheduledVideoSlot;
  runKey: string;
  scheduledFor: string;
  runId: string | null;
  detail: string;
};

export type ScheduledVideoRecoveryDependencies = {
  readCheckpoint: (
    slot: ScheduledVideoSlot,
    scheduledFor: string,
  ) => Promise<ScheduledVideoDiscoveryCheckpoint | null>;
  runDiscovery: typeof runScheduledVideoIntake;
};

function stageShowsDurableDiscovery(processLog: Array<Record<string, unknown>>) {
  return processLog.some((entry) => (
    entry.stage === "youtube_discovery_complete"
    && (entry.status === "complete" || entry.status === "partial")
  ));
}

export function hasDurableVideoDiscovery(checkpoint: ScheduledVideoDiscoveryCheckpoint) {
  return checkpoint.sourceChecks.length > 0
    || checkpoint.ingestionStatus === "complete"
    || checkpoint.ingestionStatus === "partial"
    || stageShowsDurableDiscovery(checkpoint.processLog);
}

function checkpointTimestamp(checkpoint: ScheduledVideoDiscoveryCheckpoint) {
  const value = checkpoint.lastHeartbeatAt || checkpoint.updatedAt;
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function runningVideoDiscoveryIsStale(
  checkpoint: ScheduledVideoDiscoveryCheckpoint,
  now: Date,
  staleMs = VIDEO_DISCOVERY_STALE_MS,
) {
  if (checkpoint.status !== "running") return false;
  const lastSeen = checkpointTimestamp(checkpoint);
  return lastSeen !== null && now.getTime() - lastSeen >= staleMs;
}

async function readCheckpoint(
  slot: ScheduledVideoSlot,
  scheduledFor: string,
): Promise<ScheduledVideoDiscoveryCheckpoint | null> {
  const client = createSupabaseAdminClient();
  const { data: run, error: runError } = await client
    .from("research_runs")
    .select("id,status,source_checks,process_log,updated_at")
    .eq("schedule_slot", slot)
    .eq("scheduled_for", scheduledFor)
    .maybeSingle<{
      id: string;
      status: ScheduledVideoDiscoveryCheckpoint["status"];
      source_checks: unknown[] | null;
      process_log: Array<Record<string, unknown>> | null;
      updated_at: string | null;
    }>();

  if (runError) {
    throw new Error(`Could not inspect scheduled video discovery: ${runError.message}`);
  }
  if (!run) return null;

  const { data: slotRun, error: slotError } = await client
    .from("research_slot_runs")
    .select("ingestion_status,last_heartbeat_at")
    .eq("research_run_id", run.id)
    .maybeSingle<{ ingestion_status: string | null; last_heartbeat_at: string | null }>();

  if (slotError) {
    throw new Error(`Could not inspect scheduled video slot checkpoint: ${slotError.message}`);
  }

  return {
    runId: run.id,
    status: run.status,
    sourceChecks: Array.isArray(run.source_checks) ? run.source_checks : [],
    processLog: Array.isArray(run.process_log) ? run.process_log : [],
    updatedAt: run.updated_at,
    ingestionStatus: slotRun?.ingestion_status ?? null,
    lastHeartbeatAt: slotRun?.last_heartbeat_at ?? null,
  };
}

const runDiscoveryQueueOnly: typeof runScheduledVideoIntake = (input) => (
  runScheduledVideoIntake(input, {
    browserTranscriptConfigured: () => false,
  })
);

const defaultDependencies: ScheduledVideoRecoveryDependencies = {
  readCheckpoint,
  runDiscovery: runDiscoveryQueueOnly,
};

/**
 * Recover only a missing/failed/stale discovery checkpoint. Transcript retrieval
 * is deliberately excluded: discovered video rows remain owned by the leased
 * transcript worker and its retry/cooldown lifecycle.
 *
 * The production watchdog is scheduled once per video slot. Re-entry is blocked
 * while the canonical discovery is still running, and any durable discovery
 * checkpoint is reused even when transcript status remains partial or blocked.
 */
export async function ensureScheduledVideoDiscovery(
  slot: ScheduledVideoSlot,
  now = new Date(),
  dependencyOverrides: Partial<ScheduledVideoRecoveryDependencies> = {},
): Promise<ScheduledVideoRecoveryResult> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const { runKey, scheduledFor } = scheduledVideoRunIdentity(slot, now);

  try {
    const checkpoint = await dependencies.readCheckpoint(slot, scheduledFor);

    if (checkpoint && hasDurableVideoDiscovery(checkpoint)) {
      return {
        action: "reused",
        slot,
        runKey,
        scheduledFor,
        runId: checkpoint.runId,
        detail: "Durable creator-video discovery already exists; transcript readiness remains a separate worker concern.",
      };
    }

    if (checkpoint?.status === "running" && !runningVideoDiscoveryIsStale(checkpoint, now)) {
      return {
        action: "in_progress",
        slot,
        runKey,
        scheduledFor,
        runId: checkpoint.runId,
        detail: "Creator-video discovery is still active; watchdog will not re-enter the canonical run.",
      };
    }

    const recovered = await dependencies.runDiscovery({
      slot,
      runKey,
      scheduledFor,
      now,
    });

    return {
      action: "recovered",
      slot,
      runKey,
      scheduledFor,
      runId: recovered.runId,
      detail: checkpoint
        ? `Recovered creator-video discovery from ${checkpoint.status} / non-durable state.`
        : "Recovered a missing creator-video discovery checkpoint.",
    };
  } catch (error) {
    return {
      action: "failed",
      slot,
      runKey,
      scheduledFor,
      runId: null,
      detail: error instanceof Error ? error.message : "Creator-video discovery recovery failed.",
    };
  }
}
