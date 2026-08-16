import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** TEMPORARY production acceptance hook for the audited fast20-test retry. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("retry", "fast20-test");
  request = new Request(url, request);
  return handleScheduledResearchAcquisition(request, "morning");
}
