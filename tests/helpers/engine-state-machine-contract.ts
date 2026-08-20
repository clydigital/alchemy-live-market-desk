export const REQUIRED_REASONING_STAGES = [
  "market_belief",
  "divergence",
  "hypothesis",
  "scenario",
  "story_synthesis",
  "semantic_deduplication",
  "lifecycle",
] as const;

export type ReasoningStage = (typeof REQUIRED_REASONING_STAGES)[number];
export type ContinuationState = "CONTINUE" | "RETRY_STAGE" | "BUSY" | "COMPLETED";

export type FrozenInputManifest = {
  evidenceIds: string[];
  storyVersionIds: string[];
  macroSnapshotIds: string[];
  analysisTimestamp: string;
};

export type EngineContractRun = {
  runId: string;
  startedAt: string;
  frozenInput: Readonly<FrozenInputManifest>;
  completedStages: ReasoningStage[];
  stageAttempts: Partial<Record<ReasoningStage, number>>;
  stageOutputs: Partial<Record<ReasoningStage, unknown>>;
  activeClaim: ReasoningStage | "finalise" | null;
  finalisation: {
    storyPersisted: boolean;
    snapshotPersisted: boolean;
  };
  status: "running" | "completed";
};

export type EngineContractDeps = {
  runStage(stage: ReasoningStage, input: Readonly<FrozenInputManifest>): Promise<unknown>;
  persistStory(run: EngineContractRun): Promise<void>;
  persistSnapshot(run: EngineContractRun): Promise<void>;
};

export type ContinuationResult = {
  state: ContinuationState;
  stage: ReasoningStage | "finalise" | null;
  error?: string;
};

function deepFreezeManifest(input: FrozenInputManifest): Readonly<FrozenInputManifest> {
  const frozen: FrozenInputManifest = {
    evidenceIds: [...input.evidenceIds],
    storyVersionIds: [...input.storyVersionIds],
    macroSnapshotIds: [...input.macroSnapshotIds],
    analysisTimestamp: input.analysisTimestamp,
  };
  Object.freeze(frozen.evidenceIds);
  Object.freeze(frozen.storyVersionIds);
  Object.freeze(frozen.macroSnapshotIds);
  return Object.freeze(frozen);
}

export function createContractRun(input: {
  runId: string;
  startedAt: string;
  inputManifest: FrozenInputManifest;
}): EngineContractRun {
  return {
    runId: input.runId,
    startedAt: input.startedAt,
    frozenInput: deepFreezeManifest(input.inputManifest),
    completedStages: [],
    stageAttempts: {},
    stageOutputs: {},
    activeClaim: null,
    finalisation: {
      storyPersisted: false,
      snapshotPersisted: false,
    },
    status: "running",
  };
}

function nextReasoningStage(run: EngineContractRun): ReasoningStage | null {
  return REQUIRED_REASONING_STAGES.find((stage) => !run.completedStages.includes(stage)) ?? null;
}

export async function continueContractRun(
  run: EngineContractRun,
  deps: EngineContractDeps,
): Promise<ContinuationResult> {
  if (run.status === "completed") {
    return { state: "COMPLETED", stage: null };
  }

  if (run.activeClaim) {
    return { state: "BUSY", stage: run.activeClaim };
  }

  const nextStage = nextReasoningStage(run);
  if (nextStage) {
    run.activeClaim = nextStage;
    run.stageAttempts[nextStage] = (run.stageAttempts[nextStage] ?? 0) + 1;

    try {
      const output = await deps.runStage(nextStage, run.frozenInput);
      run.stageOutputs[nextStage] = output;
      run.completedStages.push(nextStage);
      run.activeClaim = null;
      return { state: "CONTINUE", stage: nextStage };
    } catch (error) {
      run.activeClaim = null;
      return {
        state: "RETRY_STAGE",
        stage: nextStage,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  run.activeClaim = "finalise";
  try {
    if (!run.finalisation.storyPersisted) {
      await deps.persistStory(run);
      run.finalisation.storyPersisted = true;
    }

    if (!run.finalisation.snapshotPersisted) {
      await deps.persistSnapshot(run);
      run.finalisation.snapshotPersisted = true;
    }

    run.status = "completed";
    run.activeClaim = null;
    return { state: "COMPLETED", stage: "finalise" };
  } catch (error) {
    run.activeClaim = null;
    return {
      state: "RETRY_STAGE",
      stage: "finalise",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
