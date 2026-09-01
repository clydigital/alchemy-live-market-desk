import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";
import { scheduledResearchEnabled } from "@/lib/cron-research-handler";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import type { CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { ensureScheduledVideoCheckpoint } from "@/lib/scheduled-video-ensure";

/**
 * Scheduled research normally follows its matching video intake by 15 minutes.
 * Production observability showed that the video cron can be absent even while
 * the desk cron fires. Before building a news-only research run, recover the
 * missing creator-video checkpoint through the same bounded intake service.
 *
 * This wrapper never runs video work for an unauthorised or disabled research
 * request. Completed checkpoints are reused and running checkpoints are not
 * re-entered.
 */
export async function handleScheduledResearchAcquisitionWithVideoCheckpoint(
  request: Request,
  slot: CanonicalResearchSlot,
) {
  const authorised = acceptsResearchAuthorization(request.headers.get("authorization"), [process.env.CRON_SECRET]);
  if (authorised && process.env.CRON_SECRET?.trim() && scheduledResearchEnabled()) {
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
  }
  return handleScheduledResearchAcquisition(request, slot);
}
