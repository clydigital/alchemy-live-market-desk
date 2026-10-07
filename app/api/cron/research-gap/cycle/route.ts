import { handleScheduledResearchGapCycle } from "@/lib/research-gap-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleScheduledResearchGapCycle(request);
}
