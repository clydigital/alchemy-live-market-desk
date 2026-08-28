import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";
import { handleScheduledResearchIntelligence } from "@/lib/cron-research-intelligence-handler";
import { handleScheduledLiveTriggerWithDependencies } from "@/lib/scheduled-live-trigger";
import { handleVideoIntakeRequest } from "@/lib/video-intake-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleScheduledLiveTriggerWithDependencies(request, {
    acquisition: handleScheduledResearchAcquisition,
    intelligence: handleScheduledResearchIntelligence,
    video: handleVideoIntakeRequest,
  });
}
