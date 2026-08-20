import {
  SENSOR_REGISTRY,
  planSensorRuns,
  type SensorId,
  type SensorPlanContext,
  type SensorPlanItem,
  type SensorRegistration,
} from "./sensor-registry.ts";

export type SensorExecutionState = "ready" | "partial" | "unavailable";

export type SensorExecutionResult = {
  state: SensorExecutionState;
  summary?: Record<string, unknown>;
  note?: string | null;
};

export type SensorExecutorContext = {
  now: string;
  sensor: SensorRegistration;
  input: unknown;
};

export type SensorExecutor = (
  context: SensorExecutorContext,
) => Promise<SensorExecutionResult>;

export type SensorRunnerInput = SensorPlanContext & {
  inputs?: Partial<Record<SensorId, unknown>>;
  maxRuns?: number;
};

export type SensorRunnerDependencies = {
  registry?: readonly SensorRegistration[];
  executors?: Partial<Record<SensorId, SensorExecutor>>;
};

export type SensorRunnerResultItem = {
  sensorId: SensorId;
  provider: string;
  state: SensorExecutionState | "skipped";
  reason: "completed" | "missing_executor" | "provider_error" | "bounded_out";
  summary: Record<string, unknown> | null;
  note: string | null;
};

export type SensorRunnerResult = {
  planned: SensorPlanItem[];
  results: SensorRunnerResultItem[];
  runnableCount: number;
  executedCount: number;
  truncatedCount: number;
};

function normalizeMaxRuns(value: number | undefined) {
  const maxRuns = value ?? 4;
  if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 8) {
    throw new Error("Sensor runner maxRuns must be an integer between 1 and 8.");
  }
  return maxRuns;
}

function safeMessage(error: unknown) {
  if (!(error instanceof Error)) return "Sensor provider failed.";
  return error.message.slice(0, 500) || "Sensor provider failed.";
}

export async function runSensorBatch(
  input: SensorRunnerInput,
  dependencies: SensorRunnerDependencies = {},
): Promise<SensorRunnerResult> {
  const registry = dependencies.registry ?? SENSOR_REGISTRY;
  const executors = dependencies.executors ?? {};
  const maxRuns = normalizeMaxRuns(input.maxRuns);
  const now = input.now instanceof Date ? input.now : new Date(input.now);
  if (!Number.isFinite(now.getTime())) throw new Error("Sensor runner now must be a valid date.");

  const planned = planSensorRuns(input, registry);
  const runnable = planned.filter((item) => item.decision === "run");
  const selected = runnable.slice(0, maxRuns);
  const boundedOut = runnable.slice(maxRuns);
  const results: SensorRunnerResultItem[] = [];

  // Deliberately sequential. Specialist sensors are low-frequency and this
  // keeps upstream rate limits, retries and production writes easy to audit.
  for (const item of selected) {
    const executor = executors[item.sensor.id];
    if (!executor) {
      results.push({
        sensorId: item.sensor.id,
        provider: item.sensor.provider,
        state: "skipped",
        reason: "missing_executor",
        summary: null,
        note: "Sensor was selected but has no registered executor.",
      });
      continue;
    }

    try {
      const result = await executor({
        now: now.toISOString(),
        sensor: item.sensor,
        input: input.inputs?.[item.sensor.id],
      });
      results.push({
        sensorId: item.sensor.id,
        provider: item.sensor.provider,
        state: result.state,
        reason: "completed",
        summary: result.summary ?? null,
        note: result.note ?? null,
      });
    } catch (error) {
      results.push({
        sensorId: item.sensor.id,
        provider: item.sensor.provider,
        state: "unavailable",
        reason: "provider_error",
        summary: null,
        note: safeMessage(error),
      });
    }
  }

  for (const item of boundedOut) {
    results.push({
      sensorId: item.sensor.id,
      provider: item.sensor.provider,
      state: "skipped",
      reason: "bounded_out",
      summary: null,
      note: `Sensor batch limit ${maxRuns} reached before this runnable sensor.`,
    });
  }

  return {
    planned,
    results,
    runnableCount: runnable.length,
    executedCount: results.filter((item) => item.reason === "completed" || item.reason === "provider_error").length,
    truncatedCount: boundedOut.length,
  };
}
