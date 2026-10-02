import { scheduledResearchEnabled } from "@/lib/cron-research-handler";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import type { CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { ensureScheduledVideoCheckpoint } from "@/lib/scheduled-video-ensure";

/**
 * Scheduled research normally follows the matching dedicated creator-video
 * discovery run. If that run is completely absent, recover discovery before
 * building the desk input. Existing partial/failed transcript state is never
 * retried here; the leased transcript worker remains the sole retry owner.
 */
export async function prepareScheduledResearchVideoCheckpoint(
  request: Request,
  slot: CanonicalResearchSlot,
) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorised = acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [cronSecret],
  );

  if (!authorised || !cronSecret || !scheduledResearchEnabled()) return null;

  const checkpoint = await ensureScheduledVideoCheckpoint(slot);
  console.info(JSON.stringify({
    event: "scheduled_research_video_checkpoint",
    slot,
    action: checkpoint.action,
    videoSlot: checkpoint.videoSlot,
    runKey: checkpoint.runKey,
    runId: checkpoint.runId,
    detail: checkpoint.detail,
  }));
  return checkpoint;
}
