import { handleScheduledResearchAcquisition } from "@/lib/cron-research-acquisition-handler";
import { handleScheduledResearchIntelligence } from "@/lib/cron-research-intelligence-handler";
import { resolveLiveResearchCronDecision } from "@/lib/vercel-live-research-orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const decision = resolveLiveResearchCronDecision(
    request.headers.get("x-vercel-cron-schedule"),
    new Date(),
  );

  if (decision.action === "skip") {
    return Response.json({
      status: "skipped",
      reason: decision.reason,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return decision.stage === "acquisition"
    ? handleScheduledResearchAcquisition(request, decision.slot)
    : handleScheduledResearchIntelligence(request, decision.slot);
}
