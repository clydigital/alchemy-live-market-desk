import "server-only";

import { runWithIntelligenceInvocation } from "./intelligence/invocation-context.ts";
import { runIntelligenceEngine } from "./intelligence/runtime.ts";

type CanonicalResearchSlot = "morning" | "evening";

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleManualStoryMaintenance(
  request: Request,
  slot: CanonicalResearchSlot,
) {
  const retryKey = new URL(request.url).searchParams.get("retry")?.trim() || "";
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/i.test(retryKey)) {
    return response({ error: "A valid audited retry identity is required." }, 400);
  }

  const runKey = `story-maintenance:${slot}:${retryKey}`;
  const invocation = await runWithIntelligenceInvocation({ oneModelStage: true }, async () =>
    runIntelligenceEngine({
      researchRunId: null,
      triggerKind: "new_evidence",
      runKey,
      maintenanceOnly: true,
      stageMaxAttempts: 1,
    }));

  return response({
    status: invocation.value.status,
    slot,
    runKey,
    engineRunId: invocation.value.engineRunId,
    storiesConsidered: invocation.value.storiesConsidered,
    storiesPublished: invocation.value.storiesPublished,
    warnings: invocation.value.warnings,
  });
}
