import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFinraSensorMemoryInput,
  captureFinraSensorMemory,
  FINRA_SENSOR_MEMORY_METHOD,
} from "../lib/providers/finra-sensor-memory.ts";
import {
  FINRA_SCOPE_NOTE,
  FINRA_SOURCE_NAME,
  type FinraShortVolumeSnapshot,
} from "../lib/providers/finra-short-volume.ts";
import { sensorContentHash } from "../lib/providers/sensor-memory.ts";

function readySnapshot(retrievedAt = "2026-08-20T10:00:00.000Z"): FinraShortVolumeSnapshot {
  return {
    state: "ready",
    tradeDate: "2026-08-19",
    retrievedAt,
    sourceName: FINRA_SOURCE_NAME,
    sourceUrl: "https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260819.txt",
    scopeNote: FINRA_SCOPE_NOTE,
    note: null,
    rows: [
      {
        tradeDate: "2026-08-19",
        symbol: "AAPL",
        shortVolume: 100,
        shortExemptVolume: 5,
        totalVolume: 250,
        shortShareOfReportedVolume: 0.4,
        marketCodes: ["B", "Q", "N"],
      },
      {
        tradeDate: "2026-08-19",
        symbol: "NVDA",
        shortVolume: 240,
        shortExemptVolume: 10,
        totalVolume: 400,
        shortShareOfReportedVolume: 0.6,
        marketCodes: ["Q", "N"],
      },
      {
        tradeDate: "2026-08-19",
        symbol: "SPY",
        shortVolume: 300,
        shortExemptVolume: 0,
        totalVolume: 600,
        shortShareOfReportedVolume: 0.5,
        marketCodes: ["Q"],
      },
    ],
  };
}

test("FINRA memory maps selected securities into deterministic scalar observations", () => {
  const input = buildFinraSensorMemoryInput(readySnapshot(), ["nvda", "aapl"]);

  assert.equal(input.provider, "finra-cnms");
  assert.equal(input.observedAt, "2026-08-19T00:00:00.000Z");
  assert.equal(input.observations.length, 8);
  assert.deepEqual(
    [...new Set(input.observations.map((observation) => observation.subjectKey))],
    ["US_NMS:AAPL", "US_NMS:NVDA"],
  );
  assert.deepEqual(
    input.observations.slice(0, 4).map((observation) => observation.observationType),
    [
      "finra.short_volume",
      "finra.short_exempt_volume",
      "finra.total_reported_volume",
      "finra.short_share_reported_volume",
    ],
  );
  assert.ok(input.observations.every((observation) => observation.methodologyVersion === FINRA_SENSOR_MEMORY_METHOD));
});

test("FINRA raw-memory identity ignores retrieval time while preserving the complete file", () => {
  const first = buildFinraSensorMemoryInput(readySnapshot("2026-08-20T10:00:00Z"), ["AAPL"]);
  const retry = buildFinraSensorMemoryInput(readySnapshot("2026-08-20T10:05:00Z"), ["NVDA"]);

  assert.equal(sensorContentHash(first), sensorContentHash(retry));
  const raw = first.rawPayload as { rows: unknown[] };
  assert.equal(raw.rows.length, 3);
  assert.equal(first.observations.length, 4);
  assert.equal(retry.observations.length, 4);
});

test("FINRA capture fetches the complete official file then persists only selected observations", async () => {
  let fetchOptions: unknown;
  let persistedObservationCount = 0;
  const result = await captureFinraSensorMemory("2026-08-19", ["SPY", "AAPL"], {
    fetchSnapshot: async (...args) => {
      fetchOptions = args[1];
      return readySnapshot();
    },
    persist: async (input) => {
      persistedObservationCount = input.observations.length;
      return {
        rawRecordId: "raw-1",
        rawRecordInserted: true,
        observationsInserted: input.observations.length,
        observationsUnchanged: 0,
      };
    },
  });

  assert.equal(fetchOptions, undefined);
  assert.equal(result.state, "ready");
  assert.equal(result.rowsFetched, 3);
  assert.deepEqual(result.selectedSymbols, ["AAPL", "SPY"]);
  assert.equal(persistedObservationCount, 8);
  assert.equal(result.memory?.rawRecordInserted, true);
});

test("unavailable FINRA files never become successful empty sensor memory", async () => {
  let persistCalls = 0;
  const result = await captureFinraSensorMemory("2026-08-16", ["AAPL"], {
    fetchSnapshot: async () => ({
      state: "unavailable",
      tradeDate: "2026-08-16",
      retrievedAt: "2026-08-20T10:00:00Z",
      sourceName: FINRA_SOURCE_NAME,
      sourceUrl: "https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260816.txt",
      scopeNote: FINRA_SCOPE_NOTE,
      note: "HTTP 404",
      rows: [],
    }),
    persist: async () => {
      persistCalls += 1;
      throw new Error("should not persist");
    },
  });

  assert.equal(result.state, "unavailable");
  assert.equal(result.memory, null);
  assert.equal(persistCalls, 0);
});
