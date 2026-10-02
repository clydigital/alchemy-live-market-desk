import { type CanonicalResearchSlot } from "./research-schedule-health.ts";
import {
  scheduledVideoRunIdentity,
  scheduledVideoSlotForDesk,
  type ScheduledVideoSlot,
} from "./scheduled-video-identity.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { runScheduledVideoIntake } from "./video-intake-service.ts";

type ExistingVideoRun = {
  id: string;
  status: string;
};

type ExistingVideoSlotRun = {
  ingestion_status: string | null;
  transcript_status: string | null;
};

export type VideoCheckpointEnsureResult = {
  action: "reused" | "started" | "in_progress" | "failed";
  videoSlot: ScheduledVideoSlot;
  runKey: string;
  scheduledFor: string;
  runId: string | null;
  detail: string;
};

export type VideoCheckpointEnsureDependencies = {
  readExisting: (
    videoSlot: ScheduledVideoSlot,
    scheduledFor: string,
  ) => Promise<{
    run: ExistingVideoRun | null;
    slotRun: ExistingVideoSlotRun | null;
  }>;
  runVideoIntake: typeof runScheduledVideoIntake;
};

async function readExisting(
  videoSlot: ScheduledVideoSlot,
  scheduledFor: string,
) {
  const client = createSupabaseAdminClient();
  const { data: run, error: runError } = await client
    .from("research_runs")
    .select("id,status")
    .eq("schedule_slot", videoSlot)
    .eq("scheduled_for", scheduledFor)
    .maybeSingle<ExistingVideoRun>();
  if (runError) {
    throw new Error(`Could not inspect the creator-video discovery checkpoint: ${runError.message}`);
  }
  if (!run) return { run: null, slotRun: null };

  const { data: slotRun, error: slotError } = await client
    .from("research_slot_runs")
    .select("ingestion_status,transcript_status")
    .eq("research_run_id", run.id)
    .maybeSingle<ExistingVideoSlotRun>();
  if (slotError) {
    throw new Error(`Could not inspect the creator-video slot checkpoint: ${slotError.message}`);
  }
  return { run, slotRun };
}

const runQueueOnly: typeof runScheduledVideoIntake = (input) => (
  runScheduledVideoIntake(input, {
    // Research preflight may repair a missing discovery run, but transcript
    // retries remain exclusively owned by the leased transcript worker.
    browserTranscriptConfigured: () => false,
  })
);

const defaultDependencies: VideoCheckpointEnsureDependencies = {
  readExisting,
  runVideoIntake: runQueueOnly,
};

/**
 * Recover only a completely missing dedicated creator-video discovery run.
 *
 * Existing runs in every state are preserved. In particular, this helper never
 * re-enters partial/blocked/failed transcript work and never creates a second
 * transcript-retry path. The regular research cycle consumes whatever durable
 * state already exists and keeps incomplete creator evidence visible as debt.
 */
export async function ensureScheduledVideoCheckpoint(
  deskSlot: CanonicalResearchSlot,
  now = new Date(),
  dependencyOverrides: Partial<VideoCheckpointEnsureDependencies> = {},
): Promise<VideoCheckpointEnsureResult> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const videoSlot = scheduledVideoSlotForDesk(deskSlot);
  const { runKey, scheduledFor } = scheduledVideoRunIdentity(videoSlot, now);

  try {
    const existing = await dependencies.readExisting(videoSlot, scheduledFor);

    if (existing.run?.status === "running") {
      return {
        action: "in_progress",
        videoSlot,
        runKey,
        scheduledFor,
        runId: existing.run.id,
        detail: "Matching dedicated creator-video run is already in progress; research will not start a duplicate discovery run.",
      };
    }

    if (existing.run) {
      const ingestion = existing.slotRun?.ingestion_status ?? "unknown";
      const transcript = existing.slotRun?.transcript_status ?? "unknown";
      return {
        action: "reused",
        videoSlot,
        runKey,
        scheduledFor,
        runId: existing.run.id,
        detail: `Existing dedicated creator-video run preserved (run=${existing.run.status}, ingestion=${ingestion}, transcript=${transcript}); research preflight will not retry transcript work.`,
      };
    }

    const intake = await dependencies.runVideoIntake({
      slot: videoSlot,
      runKey,
      scheduledFor,
      now,
    });

    return {
      action: "started",
      videoSlot,
      runKey,
      scheduledFor,
      runId: intake.runId,
      detail: `Missing dedicated creator-video discovery run recovered in queue-only mode with status ${intake.status}.`,
    };
  } catch (error) {
    return {
      action: "failed",
      videoSlot,
      runKey,
      scheduledFor,
      runId: null,
      detail: error instanceof Error
        ? error.message
        : "Creator-video discovery checkpoint recovery failed.",
    };
  }
}
