import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scheduledVideoRunIdentity, scheduledVideoSlotForDesk } from "@/lib/scheduled-video-identity";
import { runScheduledVideoIntake } from "@/lib/video-intake-service";
import type { CanonicalResearchSlot } from "@/lib/research-schedule-health";

type ExistingVideoRun = {
  id: string;
  status: string;
};

type ExistingVideoSlotRun = {
  transcript_status: string | null;
};

export type VideoCheckpointEnsureResult = {
  action: "reused" | "started" | "in_progress" | "failed";
  videoSlot: "video_midnight" | "video_late_morning";
  runKey: string;
  scheduledFor: string;
  runId: string | null;
  detail: string;
};

export type VideoCheckpointEnsureDependencies = {
  readExisting: (videoSlot: "video_midnight" | "video_late_morning", scheduledFor: string) => Promise<{
    run: ExistingVideoRun | null;
    slotRun: ExistingVideoSlotRun | null;
  }>;
  runVideoIntake: typeof runScheduledVideoIntake;
};

async function readExisting(
  videoSlot: "video_midnight" | "video_late_morning",
  scheduledFor: string,
) {
  const client = createSupabaseAdminClient();
  const { data: run, error: runError } = await client
    .from("research_runs")
    .select("id,status")
    .eq("schedule_slot", videoSlot)
    .eq("scheduled_for", scheduledFor)
    .maybeSingle<ExistingVideoRun>();
  if (runError) throw new Error(`Could not inspect the creator-video checkpoint: ${runError.message}`);
  if (!run) return { run: null, slotRun: null };

  const { data: slotRun, error: slotError } = await client
    .from("research_slot_runs")
    .select("transcript_status")
    .eq("research_run_id", run.id)
    .maybeSingle<ExistingVideoSlotRun>();
  if (slotError) throw new Error(`Could not inspect the creator-video slot checkpoint: ${slotError.message}`);
  return { run, slotRun };
}

const defaultDependencies: VideoCheckpointEnsureDependencies = {
  readExisting,
  runVideoIntake: runScheduledVideoIntake,
};

/**
 * Research depends on the matching creator-video intake window. Vercel normally
 * runs that intake 15 minutes earlier, but a missing cron invocation must not
 * silently turn the regular sweep into a news-only run.
 *
 * Completed transcript checkpoints are reused. A currently running checkpoint
 * is never re-entered. Missing or failed checkpoints are recovered by invoking
 * the same bounded, idempotent-by-window video intake before research builds its
 * source checks.
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
    if (existing.run?.status === "completed" && existing.slotRun?.transcript_status === "complete") {
      return {
        action: "reused",
        videoSlot,
        runKey,
        scheduledFor,
        runId: existing.run.id,
        detail: "Matching completed creator-video checkpoint already exists.",
      };
    }
    if (existing.run?.status === "running") {
      return {
        action: "in_progress",
        videoSlot,
        runKey,
        scheduledFor,
        runId: existing.run.id,
        detail: "Matching creator-video checkpoint is already running; research will not start a duplicate intake.",
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
      detail: `Creator-video checkpoint self-heal completed with status ${intake.status}.`,
    };
  } catch (error) {
    return {
      action: "failed",
      videoSlot,
      runKey,
      scheduledFor,
      runId: null,
      detail: error instanceof Error ? error.message : "Creator-video checkpoint self-heal failed.",
    };
  }
}
