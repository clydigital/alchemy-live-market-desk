import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * TEMPORARY POST-#53 ACCEPTANCE HOOK.
 *
 * This already-registered Vercel Cron route is temporarily pinned to the
 * audited `post53-test` retry identity so production can exercise the split
 * acquisition path without mutating the failed canonical morning run. The
 * normal watchdog implementation must be restored immediately after the
 * acceptance run.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("retry", "post53-test");
  request = new Request(url, request);
  return handleScheduledResearchAcquisition(request, "morning");
}
