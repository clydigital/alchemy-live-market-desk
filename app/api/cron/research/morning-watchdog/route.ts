import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * PART C: Watchdog for morning research acquisition.
 * Invoked ~5 minutes after the primary morning cron (09:15 → 09:20 MYT).
 * It shares the canonical run identity and safely no-ops when the primary
 * already claimed or completed the acquisition phase.
 */
export async function GET(request: Request) {
  return handleScheduledResearchAcquisition(request, "morning");
}
