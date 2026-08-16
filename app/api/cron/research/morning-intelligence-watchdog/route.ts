import { handleScheduledResearchIntelligence } from "@/lib/cron-research-intelligence-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** TEMPORARY POST-#53 ACCEPTANCE HOOK. Restore after the acceptance run. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("retry", "post53-test");
  request = new Request(url, request);
  return handleScheduledResearchIntelligence(request, "morning");
}
