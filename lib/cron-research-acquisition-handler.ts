import { POST as publishResearchUpdate } from "@/app/api/research-update/route";
import { handleScheduledResearchWithDependencies } from "@/lib/cron-research-handler";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";

async function publishDeferredScheduledResearch(request: Request) {
  const headers = new Headers(request.headers);
  headers.set("x-alchemy-defer-intelligence", "1");
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
