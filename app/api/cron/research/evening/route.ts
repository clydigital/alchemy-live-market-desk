import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleScheduledResearchAcquisition(request, "evening");
}