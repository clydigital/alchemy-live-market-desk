import { revalidatePath } from "next/cache";

import type { ReasoningProvider } from "./contracts.ts";
import { OpenAIReasoningProvider, ReasoningConfigurationError } from "./openai-reasoning.ts";
import { IntelligenceRepository } from "./repository.ts";
import { lifecycleDefinition } from "./stage-definitions.ts";

export async function runOneTargetedReevaluation(
  queueId?: string,
  repository = new IntelligenceRepository(),
  provider: ReasoningProvider = new OpenAIReasoningProvider(),
) {
  const queue = await repository.claimStoryReevaluation(queueId);
  if (!queue) return { processed: false as const, reason: "No pending Story re-evaluation is available." };

  const runId = await repository.beginEngineRun("targeted_reevaluation", { queueId: queue.id, storyId: queue.target_id });
  try {
    const context = await repository.targetedReevaluationContext(queue);
    const execution = await provider.execute(lifecycleDefinition, {
      candidate: context.candidate,
      priorStatus: context.candidate.lifecycleStatus,
      newEvidence: context.evidence,
    });
    await repository.persistStageExecution(runId, execution);
    await repository.finishStoryReevaluation(queue.id, String(queue.target_id), {
      status: execution.output.status,
      evidenceId: String(queue.requested_by_evidence_id),
      succeeded: true,
    });
    await repository.finishEngineRun(runId, { status: "completed", storiesConsidered: 1, storiesPublished: 0 });
    revalidatePath("/");
    revalidatePath("/stories");
    revalidatePath("/api/hybrid-feed");
    revalidatePath("/api/hybrid-feed-v2");
    return { processed: true as const, runId, queueId: queue.id, storyId: queue.target_id, lifecycle: execution.output };
  } catch (error) {
    await repository.finishStoryReevaluation(queue.id, String(queue.target_id), {
      status: "developing",
      evidenceId: String(queue.requested_by_evidence_id),
      succeeded: false,
      error: error instanceof Error ? error.message : String(error),
    });
    await repository.finishEngineRun(runId, {
      status: error instanceof ReasoningConfigurationError ? "blocked" : "failed",
      storiesConsidered: 1,
      failureDetail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
