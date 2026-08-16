import { handleScheduledResearchIntelligence } from "@/lib/cron-research-intelligence-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** TEMPORARY production acceptance hook for the audited fastfloor-test retry. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("retry", "fastfloor-test");
  request = new Request(url, request);
  return handleScheduledResearchIntelligence(request, "morning");
}
