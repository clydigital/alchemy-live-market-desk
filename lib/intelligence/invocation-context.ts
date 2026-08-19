import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export type FrozenIntelligenceInputs = {
  analysisAsOf: string;
  macroSnapshotId: string | null;
  stories: unknown[] | null;
  evidence: unknown[] | null;
  researchDebt: unknown[] | null;
};

export type IntelligenceInvocationState = {
  engineRunId: string | null;
  oneModelStage: boolean;
  invokedModelStage: string | null;
  deferredStage: string | null;
  frozenInputs: FrozenIntelligenceInputs | null;
};

const storage = new AsyncLocalStorage<IntelligenceInvocationState>();

export async function runWithIntelligenceInvocation<T>(
  input: {
    oneModelStage?: boolean;
    frozenInputs?: FrozenIntelligenceInputs | null;
  },
  fn: () => Promise<T>,
) {
  const state: IntelligenceInvocationState = {
    engineRunId: null,
    oneModelStage: input.oneModelStage ?? true,
    invokedModelStage: null,
    deferredStage: null,
    frozenInputs: input.frozenInputs ?? null,
  };
  const value = await storage.run(state, fn);
  return {
    value,
    summary: {
      engineRunId: state.engineRunId,
      invokedModelStage: state.invokedModelStage,
      deferredStage: state.deferredStage,
    },
  };
}

export function currentIntelligenceInvocation() {
  return storage.getStore() ?? null;
}

export function attachEngineRunToInvocation(engineRunId: string) {
  const state = storage.getStore();
  if (state) state.engineRunId = engineRunId;
}

export function setFrozenIntelligenceInputs(inputs: FrozenIntelligenceInputs) {
  const state = storage.getStore();
  if (state) state.frozenInputs = inputs;
}

export function markModelStageInvoked(stageKey: string) {
  const state = storage.getStore();
  if (!state?.oneModelStage) return;
  if (!state.invokedModelStage) state.invokedModelStage = stageKey;
}

export function shouldDeferStageClaim(stageKey: string) {
  const state = storage.getStore();
  if (!state?.oneModelStage || !state.invokedModelStage) return false;
  if (state.invokedModelStage === stageKey) return false;
  state.deferredStage = stageKey;
  return true;
}

export function frozenRead(kind: "stories" | "evidence" | "researchDebt") {
  const frozen = storage.getStore()?.frozenInputs;
  if (!frozen) return null;
  if (kind === "stories") return frozen.stories;
  if (kind === "evidence") return frozen.evidence;
  return frozen.researchDebt;
}

export function rememberFrozenRead(kind: "stories" | "evidence" | "researchDebt", value: unknown[]) {
  const state = storage.getStore();
  if (!state?.frozenInputs) return;
  if (kind === "stories" && state.frozenInputs.stories === null) state.frozenInputs.stories = structuredClone(value);
  if (kind === "evidence" && state.frozenInputs.evidence === null) state.frozenInputs.evidence = structuredClone(value);
  if (kind === "researchDebt" && state.frozenInputs.researchDebt === null) state.frozenInputs.researchDebt = structuredClone(value);
}
