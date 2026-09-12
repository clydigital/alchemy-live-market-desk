export type CompletedEnginePublicationCheckpoint = {
  engineRunId: string | null;
  engineStatus: string | null;
  storiesPublished: number;
  engineWarnings: string[];
  storySnapshotCount: number;
  baseEditionId: string | null;
  composedEditionId: string | null;
};

export type PublicationRecoveryStep =
  | "not_eligible"
  | "freeze_and_publish_base"
  | "compose"
  | "complete";

export function nextPublicationRecoveryStep(
  checkpoint: CompletedEnginePublicationCheckpoint | null | undefined,
): PublicationRecoveryStep {
  if (checkpoint?.engineStatus !== "completed") return "not_eligible";
  if (checkpoint.composedEditionId) return "complete";
  if (checkpoint.baseEditionId) return "compose";
  return "freeze_and_publish_base";
}

export function publicationFailureDisposition(engineCompleted: boolean) {
  return engineCompleted ? "resumable" as const : "terminal" as const;
}

/**
 * Resume only the publication work downstream of a durably completed engine.
 * Deliberately has no engine dependency: publication recovery cannot restart
 * acquisition, recruitment, reasoning, or any other intelligence stage.
 */
export async function resumePublicationAfterCompletedEngine<TComposition>({
  checkpoint,
  freezeAndPublishBase,
  compose,
}: {
  checkpoint: CompletedEnginePublicationCheckpoint;
  freezeAndPublishBase: () => Promise<string>;
  compose: () => Promise<TComposition>;
}) {
  const step = nextPublicationRecoveryStep(checkpoint);
  if (step === "not_eligible") {
    throw new Error("Publication recovery requires a durably completed intelligence engine.");
  }
  if (step === "complete") {
    return {
      status: "complete" as const,
      baseEditionId: checkpoint.baseEditionId,
      composedEditionId: checkpoint.composedEditionId,
      composition: null,
    };
  }
  if (step === "freeze_and_publish_base") {
    const baseEditionId = await freezeAndPublishBase();
    return {
      status: "base_ready" as const,
      baseEditionId,
      composedEditionId: null,
      composition: null,
    };
  }

  const composition = await compose();
  return {
    status: "complete" as const,
    baseEditionId: checkpoint.baseEditionId,
    composedEditionId: checkpoint.composedEditionId,
    composition,
  };
}
