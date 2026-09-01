import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";
import { prepareScheduledResearchVideoCheckpoint } from "@/lib/cron-research-acquisition-with-video-handler";
import { promoteManualScheduledResearchAuthorization } from "@/lib/scheduled-research-manual-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  request = promoteManualScheduledResearchAuthorization(request);
  await prepareScheduledResearchVideoCheckpoint(request, "evening");
  return handleScheduledResearchAcquisition(request, "evening");
}
