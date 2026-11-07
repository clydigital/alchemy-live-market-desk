import { POST as publishResearchUpdate } from "@/app/api/research-update/route";
import { handleScheduledResearchWithDependencies } from "@/lib/cron-research-handler";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { scheduledSourceOnlyEnabled } from "@/lib/bluebelly-source-only-research";

async function publishDeferredScheduledResearch(request: Request) {
  const headers = new Headers(request.headers);
  if (scheduledSourceOnlyEnabled(process.env)) {
    // This trusted server-to-server header is accepted only after CRON_SECRET auth
    // and only on the scheduled-acquisition path; no new writer is started.
    headers.set("x-alchemy-source-only", "1");
  } else {
    headers.set("x-alchemy-defer-intelligence", "1");
  }
  return publishResearchUpdate(new Request(request, { headers }));
}

/**
 * Scheduled acquisition uses the canonical research handler and publisher, but
 * marks its internal publisher request so OpenAI reasoning is continued in a
 * fresh serverless invocation after the intake ledger is durable.
 */
export async function handleScheduledResearchAcquisition(
  request: Request,
  slot: CanonicalResearchSlot,
) {
  return handleScheduledResearchWithDependencies(request, slot, {
    publishResearchUpdate: publishDeferredScheduledResearch,
  });
}
