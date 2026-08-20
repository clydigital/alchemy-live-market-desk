import assert from "node:assert/strict";
import test from "node:test";

import {
  persistSensorMemoryWithStore,
  sensorContentHash,
  stableSensorJson,
  type SensorMemoryStore,
  type SensorObservationVersion,
  type SensorRawRecord,
} from "../lib/providers/sensor-memory.ts";

function memoryStore() {
  const raw: SensorRawRecord[] = [];
  const observations: Array<SensorObservationVersion & {
    rawRecordId: string;
    supersedesObservationId: string | null;
  }> = [];

  const sameSeries = (row: SensorObservationVersion, input: {
    observationType: string;
    subjectType: string;
    subjectKey: string;
    methodologyVersion: string;
  }) => row.observationType === input.observationType
    && row.subjectType === input.subjectType
    && row.subjectKey === input.subjectKey
    && row.methodologyVersion === input.methodologyVersion;

  const store: SensorMemoryStore = {
    async findRawRecord(input) {
      return raw.find((row) => row.provider === input.provider
        && row.sourceUrl === input.sourceUrl
        && row.contentHash === input.contentHash) ?? null;
    },
    async insertRawRecord(input) {
      const record = {
        id: `raw-${raw.length + 1}`,
        provider: input.provider,
        sourceUrl: input.sourceUrl,
        contentHash: input.contentHash,
      };
      raw.push(record);
      return record;
    },
    async latestObservation(input) {
      return [...observations].reverse().find((row) =>
        sameSeries(row, input) && row.observedAt === input.observedAt
      ) ?? null;
    },
    async latestObservationBefore(input) {
      return observations
        .filter((row) => sameSeries(row, input) && Date.parse(row.observedAt) < Date.parse(input.observedAt))
        .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
        .at(0) ?? null;
    },
    async hasSeriesObservation(input) {
      return observations.some((row) => sameSeries(row, input));
    },
    async insertObservation(input) {
      const id = `obs-${observations.length + 1}`;
      observations.push({
        id,
        rawRecordId: input.rawRecordId,
        supersedesObservationId: input.supersedesObservationId,
        observationType: input.observationType,
        subjectType: input.subjectType,
        subjectKey: input.subjectKey,
        observedAt: input.observedAt,
        effectiveAt: input.effectiveAt,
        value: input.value,
        unit: input.unit,
        confidence: input.confidence,
        isPreliminary: input.isPreliminary,
        methodologyVersion: input.methodologyVersion,
      });
      return { id, inserted: true };
    },
  };

  return { store, raw, observations };
}

test("sensor canonical JSON and content hash ignore object key order", () => {
  assert.equal(
    stableSensorJson({ b: 2, a: { d: 4, c: 3 } }),
    stableSensorJson({ a: { c: 3, d: 4 }, b: 2 }),
  );
  assert.equal(
    sensorContentHash({ rawPayload: { b: 2, a: 1 } }),
    sensorContentHash({ rawPayload: { a: 1, b: 2 } }),
  );
});

test("first sensor payload appends one raw record and emits NEW_SERIES", async () => {
  const memory = memoryStore();
  const result = await persistSensorMemoryWithStore({
    provider: "jodi",
    sourceUrl: "https://example.test/jodi.csv",
    sourceType: "official_dataset",
    rawPayload: { country: "US", production: 13.4 },
    observations: [{
      observationType: "oil_physical",
      subjectType: "series",
      subjectKey: "jodi:US:CRUDEOIL:PRODUCTION:KBD",
      observedAt: "2026-07-01T00:00:00.000Z",
      value: 13.4,
      unit: "KBD",
    }],
  }, memory.store);

  assert.equal(result.rawRecordId, "raw-1");
  assert.equal(result.rawRecordInserted, true);
  assert.equal(result.observationsInserted, 1);
  assert.equal(result.observationsUnchanged, 0);
  assert.equal(result.changeEvents.length, 1);
  assert.equal(result.changeEvents[0].eventType, "NEW_SERIES");
  assert.equal(result.changeEvents[0].previousObservationId, null);
  assert.equal(result.changeEvents[0].absoluteChange, null);
  assert.equal(memory.raw.length, 1);
  assert.equal(memory.observations.length, 1);
  assert.equal(memory.observations[0].supersedesObservationId, null);
});

test("an identical retry reuses raw content and emits no change event", async () => {
  const memory = memoryStore();
  const input = {
    provider: "finra",
    sourceUrl: "https://example.test/CNMSshvol20260819.txt",
    sourceType: "official_market_data",
    rawPayload: { symbol: "NVDA", shortVolume: 10, totalVolume: 20 },
    observations: [{
      observationType: "short_volume",
      subjectType: "security",
      subjectKey: "finra:NVDA:CNMS",
      observedAt: "2026-08-19T00:00:00.000Z",
      value: 10,
      unit: "shares",
    }],
  };

  await persistSensorMemoryWithStore(input, memory.store);
  const second = await persistSensorMemoryWithStore(input, memory.store);

  assert.equal(memory.raw.length, 1);
  assert.equal(memory.observations.length, 1);
  assert.equal(second.rawRecordInserted, false);
  assert.equal(second.observationsInserted, 0);
  assert.equal(second.observationsUnchanged, 1);
  assert.deepEqual(second.changeEvents, []);
});

test("a revised value appends a linked observation and emits REVISION", async () => {
  const memory = memoryStore();
  const base = {
    provider: "statcan",
    sourceUrl: "https://www150.statcan.gc.ca/t1/wds/rest/getChangedSeriesDataFromVector",
    sourceType: "official_statistics",
    observations: [{
      observationType: "macro_series",
      subjectType: "vector",
      subjectKey: "statcan:v41690973",
      observedAt: "2026-07-01T00:00:00.000Z",
      value: 100.1,
      unit: "index",
      isPreliminary: true,
    }],
  };

  await persistSensorMemoryWithStore({ ...base, rawPayload: { value: 100.1 } }, memory.store);
  const revised = await persistSensorMemoryWithStore({
    ...base,
    rawPayload: { value: 100.4, revision: true },
    observations: [{ ...base.observations[0], value: 100.4, isPreliminary: false }],
  }, memory.store);

  assert.equal(revised.rawRecordInserted, true);
  assert.equal(revised.observationsInserted, 1);
  assert.equal(revised.changeEvents.length, 1);
  assert.equal(revised.changeEvents[0].eventType, "REVISION");
  assert.equal(revised.changeEvents[0].previousObservationId, "obs-1");
  assert.ok(Math.abs((revised.changeEvents[0].absoluteChange ?? 0) - 0.3) < 1e-9);
  assert.equal(memory.raw.length, 2);
  assert.equal(memory.observations.length, 2);
  assert.equal(memory.observations[1].supersedesObservationId, "obs-1");
});

test("a new source period emits NEW_PERIOD with deterministic scalar deltas", async () => {
  const memory = memoryStore();
  const base = {
    provider: "finra",
    sourceUrl: "https://example.test/finra.txt",
    sourceType: "official_market_data",
  };

  await persistSensorMemoryWithStore({
    ...base,
    rawPayload: { date: "2026-08-18", share: 0.4 },
    observations: [{
      observationType: "finra.short_share_reported_volume",
      subjectType: "security",
      subjectKey: "US_NMS:NVDA",
      observedAt: "2026-08-18T00:00:00.000Z",
      value: 0.4,
      unit: "ratio",
      methodologyVersion: "finra-cnms-v1",
    }],
  }, memory.store);

  const next = await persistSensorMemoryWithStore({
    ...base,
    rawPayload: { date: "2026-08-19", share: 0.5 },
    observations: [{
      observationType: "finra.short_share_reported_volume",
      subjectType: "security",
      subjectKey: "US_NMS:NVDA",
      observedAt: "2026-08-19T00:00:00.000Z",
      value: 0.5,
      unit: "ratio",
      methodologyVersion: "finra-cnms-v1",
    }],
  }, memory.store);

  const event = next.changeEvents[0];
  assert.equal(event.eventType, "NEW_PERIOD");
  assert.equal(event.previousObservationId, "obs-1");
  assert.equal(event.previousObservedAt, "2026-08-18T00:00:00.000Z");
  assert.ok(Math.abs((event.absoluteChange ?? 0) - 0.1) < 1e-12);
  assert.ok(Math.abs((event.relativeChange ?? 0) - 0.25) < 1e-12);
});

test("a backfilled older period is NEW_PERIOD but never compares against future data", async () => {
  const memory = memoryStore();
  const identity = {
    observationType: "macro_series",
    subjectType: "series",
    subjectKey: "example:series",
    unit: "index",
  };

  await persistSensorMemoryWithStore({
    provider: "example",
    sourceUrl: "https://example.test/data",
    sourceType: "official_statistics",
    rawPayload: { period: "2026-08", value: 120 },
    observations: [{ ...identity, observedAt: "2026-08-01T00:00:00.000Z", value: 120 }],
  }, memory.store);

  const backfill = await persistSensorMemoryWithStore({
    provider: "example",
    sourceUrl: "https://example.test/data",
    sourceType: "official_statistics",
    rawPayload: { period: "2026-07", value: 100 },
    observations: [{ ...identity, observedAt: "2026-07-01T00:00:00.000Z", value: 100 }],
  }, memory.store);

  const event = backfill.changeEvents[0];
  assert.equal(event.eventType, "NEW_PERIOD");
  assert.equal(event.previousObservationId, null);
  assert.equal(event.previousValue, null);
  assert.equal(event.absoluteChange, null);
  assert.equal(event.relativeChange, null);
});

test("a new raw payload with an unchanged reading preserves raw provenance without a false event", async () => {
  const memory = memoryStore();
  const base = {
    provider: "mof",
    sourceUrl: "https://www.mof.go.jp/policy/international_policy/reference/itn_transactions_in_securities/week.csv",
    sourceType: "official_statistics",
    observations: [{
      observationType: "portfolio_flow",
      subjectType: "series",
      subjectKey: "mof:japan:outward_lt_bonds",
      observedAt: "2026-08-15T00:00:00.000Z",
      value: 250.2,
      unit: "JPY bn",
    }],
  };

  await persistSensorMemoryWithStore({ ...base, rawPayload: { release: 1, value: 250.2 } }, memory.store);
  const next = await persistSensorMemoryWithStore({ ...base, rawPayload: { release: 2, value: 250.2 } }, memory.store);

  assert.equal(memory.raw.length, 2);
  assert.equal(memory.observations.length, 1);
  assert.equal(next.rawRecordInserted, true);
  assert.equal(next.observationsUnchanged, 1);
  assert.deepEqual(next.changeEvents, []);
});

test("a concurrent unique-index replay cannot emit a duplicate change event", async () => {
  const memory = memoryStore();
  memory.store.insertObservation = async () => ({ id: "existing-race", inserted: false });

  const result = await persistSensorMemoryWithStore({
    provider: "finra",
    sourceUrl: "https://example.test/finra.txt",
    sourceType: "official_market_data",
    rawPayload: { date: "2026-08-19", value: 1 },
    observations: [{
      observationType: "finra.short_volume",
      subjectType: "security",
      subjectKey: "US_NMS:AAPL",
      observedAt: "2026-08-19T00:00:00.000Z",
      value: 1,
      unit: "shares",
    }],
  }, memory.store);

  assert.equal(result.observationsInserted, 0);
  assert.equal(result.observationsUnchanged, 1);
  assert.deepEqual(result.changeEvents, []);
});

test("invalid observation identity is rejected rather than fabricated", async () => {
  const memory = memoryStore();
  await assert.rejects(() => persistSensorMemoryWithStore({
    provider: "sec",
    sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
    sourceType: "regulatory_filing",
    rawPayload: { cik: "0000320193" },
    observations: [{
      observationType: "company_fact",
      subjectType: "company",
      subjectKey: "",
      observedAt: "not-a-date",
      value: 1,
    }],
  }, memory.store), /subject key|observedAt/);
});
