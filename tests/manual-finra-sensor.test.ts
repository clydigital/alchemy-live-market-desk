import assert from "node:assert/strict";
import test from "node:test";

import { handleManualFinraSensorRunWithDependencies } from "../lib/manual-finra-sensor.ts";

const authorized = async () => ({
  authorized: true as const,
  actor: "clydigital",
  githubRunId: "123",
  workflowSha: "abc",
});

test("FINRA memory proof rejects unauthorized callers before any capture", async () => {
  let captureCalls = 0;
  const response = await handleManualFinraSensorRunWithDependencies(
    new Request("https://example.test/api/admin/sensors/finra/run", {
      method: "POST",
      body: JSON.stringify({ tradeDate: "2026-08-19", symbols: ["AAPL"] }),
    }),
    {
      authorize: async () => ({ authorized: false as const }),
      capture: async () => {
        captureCalls += 1;
        throw new Error("should not run");
      },
    },
  );

  assert.equal(response.status, 401);
  assert.equal(captureCalls, 0);
});

test("FINRA memory proof validates date and a bounded unique symbol list", async () => {
  const response = await handleManualFinraSensorRunWithDependencies(
    new Request("https://example.test/api/admin/sensors/finra/run", {
      method: "POST",
      body: JSON.stringify({ tradeDate: "2026-02-30", symbols: ["AAPL", "AAPL"] }),
    }),
    { authorize: authorized },
  );

  assert.equal(response.status, 400);
});

test("FINRA memory proof returns append-only persistence counters without exposing raw payloads", async () => {
  const events: Record<string, unknown>[] = [];
  const response = await handleManualFinraSensorRunWithDependencies(
    new Request("https://example.test/api/admin/sensors/finra/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tradeDate: "2026-08-19", symbols: ["nvda", "AAPL", "SPY"] }),
    }),
    {
      authorize: authorized,
      logger: (event) => events.push(event),
      capture: async (tradeDate, symbols) => ({
        state: "ready",
        tradeDate,
        sourceUrl: "https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260819.txt",
        rowsFetched: 12345,
        selectedSymbols: symbols,
        memory: {
          rawRecordId: "raw-1",
          rawRecordInserted: true,
          observationsInserted: 12,
          observationsUnchanged: 0,
        },
        note: null,
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json() as {
    status: string;
    symbols: string[];
    memory: { observationsInserted: number };
    rawPayload?: unknown;
  };
  assert.equal(body.status, "ready");
  assert.deepEqual(body.symbols, ["AAPL", "NVDA", "SPY"]);
  assert.equal(body.memory.observationsInserted, 12);
  assert.equal(body.rawPayload, undefined);
  assert.equal(events[0]?.event, "manual_finra_sensor_memory_authorized");
});
