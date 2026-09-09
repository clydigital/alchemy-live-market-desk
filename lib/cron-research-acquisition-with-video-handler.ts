import { scheduledResearchEnabled } from "@/lib/cron-research-handler";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import type { CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { ensureScheduledVideoCheckpoint } from "@/lib/scheduled-video-ensure";

/**
 * Scheduled research normally follows its matching video intake by 15 minutes.
 * Production observability showed that the video cron can be absent even while
 * the desk cron fires. Prepare the missing creator-video checkpoint before the
 * route delegates to the existing canonical acquisition handler.
 *
 * This helper never runs video work for an unauthorised or disabled research
 * request. Completed checkpoints are reused and running checkpoints are not
 * re-entered.
 */
export async function prepareScheduledResearchVideoCheckpoint(
  request: Request,
  slot: CanonicalResearchSlot,
) {
  const authorised = acceptsResearchAuthorization(request.headers.get("authorization"), [process.env.CRON_SECRET]);
  if (!authorised || !process.env.CRON_SECRET?.trim() || !scheduledResearchEnabled()) return null;

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
