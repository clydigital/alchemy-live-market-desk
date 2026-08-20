import assert from "node:assert/strict";
import test from "node:test";

import {
  SENSOR_REGISTRY,
  planSensorRuns,
  type SensorRegistration,
} from "../lib/providers/sensor-registry.ts";
import { runSensorBatch } from "../lib/providers/sensor-runner.ts";

function registration(
  id: SensorRegistration["id"],
  overrides: Partial<SensorRegistration> = {},
): SensorRegistration {
  return {
    id,
    provider: `provider-${id}`,
    integrationState: "memory_ready",
    cadence: "daily",
    minimumIntervalMinutes: 60,
    wakeModes: ["scheduled", "relevance", "event", "manual"],
    relevanceTokens: [id],
    ...overrides,
  };
}

test("specialist registry exposes every built adapter but only FINRA is memory-ready after PR #91", () => {
  assert.deepEqual(
    SENSOR_REGISTRY.map((sensor) => sensor.id),
    ["finra", "sec", "jodi", "mof", "statcan", "ons", "eurostat", "imf", "eia"],
  );
  assert.deepEqual(
    SENSOR_REGISTRY.filter((sensor) => sensor.integrationState === "memory_ready").map((sensor) => sensor.id),
    ["finra"],
  );
});

test("adapter-only sensors cannot be forced through the runner before memory wiring exists", () => {
  const plan = planSensorRuns({
    now: "2026-08-20T11:00:00Z",
    mode: "manual",
    force: ["sec", "jodi", "mof"],
  });

  for (const id of ["sec", "jodi", "mof"] as const) {
    const item = plan.find((entry) => entry.sensor.id === id);
    assert.equal(item?.decision, "skip");
    assert.equal(item?.reason, "not_memory_wired");
  }
});

test("scheduled planning runs a due FINRA sensor and suppresses a recent duplicate run", () => {
  const due = planSensorRuns({
    now: "2026-08-20T11:00:00Z",
    mode: "scheduled",
  }).find((item) => item.sensor.id === "finra");
  assert.equal(due?.decision, "run");
  assert.equal(due?.reason, "due_scheduled");

  const recent = planSensorRuns({
    now: "2026-08-20T11:00:00Z",
    mode: "scheduled",
    lastSuccessfulAt: { finra: "2026-08-20T00:00:00Z" },
  }).find((item) => item.sensor.id === "finra");
  assert.equal(recent?.decision, "skip");
  assert.equal(recent?.reason, "not_due");
});

test("relevance wake mode requires an exact registered token while manual force can override cadence", () => {
  const irrelevant = planSensorRuns({
    now: "2026-08-20T11:00:00Z",
    mode: "relevance",
    relevance: ["oil"],
  }).find((item) => item.sensor.id === "finra");
  assert.equal(irrelevant?.decision, "skip");
  assert.equal(irrelevant?.reason, "not_relevant");

  const relevant = planSensorRuns({
    now: "2026-08-20T11:00:00Z",
    mode: "relevance",
    relevance: ["positioning"],
  }).find((item) => item.sensor.id === "finra");
  assert.equal(relevant?.decision, "run");
  assert.equal(relevant?.reason, "relevance_match");

  const forced = planSensorRuns({
    now: "2026-08-20T11:00:00Z",
    mode: "manual",
    force: ["finra"],
    lastSuccessfulAt: { finra: "2026-08-20T10:59:00Z" },
  }).find((item) => item.sensor.id === "finra");
  assert.equal(forced?.decision, "run");
  assert.equal(forced?.reason, "forced");
  assert.equal(forced?.due, false);
});

test("sensor runner executes selected sensors sequentially and enforces a hard batch bound", async () => {
  const registry = [registration("finra"), registration("eia"), registration("jodi")];
  const calls: string[] = [];

  const result = await runSensorBatch({
    now: "2026-08-20T11:00:00Z",
    mode: "scheduled",
    maxRuns: 2,
    inputs: {
      finra: { tradeDate: "2026-08-19" },
      eia: { series: "inventories" },
    },
  }, {
    registry,
    executors: {
      finra: async ({ sensor, input }) => {
        calls.push(sensor.id);
        assert.deepEqual(input, { tradeDate: "2026-08-19" });
        return { state: "ready", summary: { persisted: 12 } };
      },
      eia: async ({ sensor, input }) => {
        calls.push(sensor.id);
        assert.deepEqual(input, { series: "inventories" });
        return { state: "ready" };
      },
      jodi: async ({ sensor }) => {
        calls.push(sensor.id);
        return { state: "ready" };
      },
    },
  });

  assert.deepEqual(calls, ["finra", "eia"]);
  assert.equal(result.runnableCount, 3);
  assert.equal(result.executedCount, 2);
  assert.equal(result.truncatedCount, 1);
  assert.equal(result.results.at(-1)?.sensorId, "jodi");
  assert.equal(result.results.at(-1)?.reason, "bounded_out");
});

test("one provider failure stays local and does not prevent later runnable sensors", async () => {
  const registry = [registration("finra"), registration("eia")];
  const calls: string[] = [];

  const result = await runSensorBatch({
    now: "2026-08-20T11:00:00Z",
    mode: "scheduled",
  }, {
    registry,
    executors: {
      finra: async ({ sensor }) => {
        calls.push(sensor.id);
        throw new Error("upstream unavailable");
      },
      eia: async ({ sensor }) => {
        calls.push(sensor.id);
        return { state: "ready", note: "healthy" };
      },
    },
  });

  assert.deepEqual(calls, ["finra", "eia"]);
  assert.equal(result.results[0].state, "unavailable");
  assert.equal(result.results[0].reason, "provider_error");
  assert.match(result.results[0].note || "", /upstream unavailable/);
  assert.equal(result.results[1].state, "ready");
  assert.equal(result.results[1].reason, "completed");
});

test("missing executors and invalid batch bounds remain explicit instead of fabricating work", async () => {
  const registry = [registration("finra")];
  const result = await runSensorBatch({
    now: "2026-08-20T11:00:00Z",
    mode: "scheduled",
  }, { registry });

  assert.equal(result.results[0].state, "skipped");
  assert.equal(result.results[0].reason, "missing_executor");
  assert.equal(result.executedCount, 0);

  await assert.rejects(
    () => runSensorBatch({ now: "2026-08-20T11:00:00Z", maxRuns: 0 }, { registry }),
    /between 1 and 8/,
  );
});
