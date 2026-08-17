import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";
import { handleScheduledResearchIntelligence } from "@/lib/cron-research-intelligence-handler";
import { handleManualLiveTriggerWithDependencies } from "@/lib/manual-live-trigger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleManualLiveTriggerWithDependencies(request, {
    acquisition: handleScheduledResearchAcquisition,
    intelligence: handleScheduledResearchIntelligence,
  });
}
