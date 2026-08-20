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
        row.observationType === input.observationType
        && row.subjectType === input.subjectType
        && row.subjectKey === input.subjectKey
        && row.observedAt === input.observedAt
        && row.methodologyVersion === input.methodologyVersion
      ) ?? null;
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
      return id;
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

test("first sensor payload appends one raw record and normalized observations", async () => {
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
      value: { value: 13.4 },
      unit: "KBD",
    }],
  }, memory.store);

  assert.deepEqual(result, {
    rawRecordId: "raw-1",
    rawRecordInserted: true,
    observationsInserted: 1,
    observationsUnchanged: 0,
  });
  assert.equal(memory.raw.length, 1);
  assert.equal(memory.observations.length, 1);
  assert.equal(memory.observations[0].supersedesObservationId, null);
});

test("an identical retry reuses raw content and does not duplicate the normalized reading", async () => {
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
      value: { shortVolume: 10, totalVolume: 20, shortShare: 0.5 },
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
});

test("a revised value appends a new observation linked to the prior version", async () => {
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
      value: { value: 100.1 },
      unit: "index",
      isPreliminary: true,
    }],
  };

  await persistSensorMemoryWithStore({ ...base, rawPayload: { value: 100.1 } }, memory.store);
  const revised = await persistSensorMemoryWithStore({
    ...base,
    rawPayload: { value: 100.4, revision: true },
    observations: [{ ...base.observations[0], value: { value: 100.4 }, isPreliminary: false }],
  }, memory.store);

  assert.equal(revised.rawRecordInserted, true);
  assert.equal(revised.observationsInserted, 1);
  assert.equal(memory.raw.length, 2);
  assert.equal(memory.observations.length, 2);
  assert.equal(memory.observations[1].supersedesObservationId, "obs-1");
  assert.deepEqual(memory.observations[0].value, { value: 100.1 });
  assert.deepEqual(memory.observations[1].value, { value: 100.4 });
});

test("a new raw payload with an unchanged reading preserves raw provenance without creating false change", async () => {
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
      value: { netPurchasesJpyBn: 250.2 },
      unit: "JPY bn",
    }],
  };

  await persistSensorMemoryWithStore({ ...base, rawPayload: { release: 1, value: 250.2 } }, memory.store);
  const next = await persistSensorMemoryWithStore({ ...base, rawPayload: { release: 2, value: 250.2 } }, memory.store);

  assert.equal(memory.raw.length, 2);
  assert.equal(memory.observations.length, 1);
  assert.equal(next.rawRecordInserted, true);
  assert.equal(next.observationsUnchanged, 1);
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
      value: { value: 1 },
    }],
  }, memory.store), /subject key|observedAt/);
});
