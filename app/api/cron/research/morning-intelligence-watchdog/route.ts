import { handleScheduledResearchIntelligence } from "@/lib/cron-research-intelligence-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleScheduledResearchIntelligence(request, "morning");
}
