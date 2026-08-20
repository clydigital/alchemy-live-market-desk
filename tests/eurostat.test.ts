import assert from "node:assert/strict";
import test from "node:test";

import {
  EUROSTAT_STATISTICS_BASE_URL,
  buildEurostatStatisticsUrl,
  fetchEurostatSensor,
  normalizeEurostatDatasetCode,
  parseEurostatJsonStat,
} from "../lib/providers/eurostat.ts";

test("Eurostat dataset identity and bounded Statistics API URL are deterministic", () => {
  assert.equal(normalizeEurostatDatasetCode("prc_hicp_midx"), "prc_hicp_midx");
  assert.throws(() => normalizeEurostatDatasetCode("../prc_hicp_midx"), /invalid/);

  const url = buildEurostatStatisticsUrl("prc_hicp_midx", {
    freq: "M",
    unit: "I25",
    geo: ["EA20", "DE"],
    lastTimePeriod: "3",
  });
  assert.ok(url.startsWith(`${EUROSTAT_STATISTICS_BASE_URL}/prc_hicp_midx?`));
  assert.match(url, /format=JSON/);
  assert.match(url, /lang=EN/);
  assert.match(url, /geo=EA20/);
  assert.match(url, /geo=DE/);
  assert.match(url, /lastTimePeriod=3/);
});

test("Eurostat query refuses unbounded requests and geo/geoLevel conflicts", () => {
  assert.throws(() => buildEurostatStatisticsUrl("nama_10_gdp", {}), /bounded filter/);
  assert.throws(() => buildEurostatStatisticsUrl("nama_10_gdp", {
    geo: "DE",
    geoLevel: "country",
  }), /mutually exclusive/);
  assert.throws(() => buildEurostatStatisticsUrl("nama_10_gdp", {
    lastTimePeriod: "25",
  }), /between 1 and 24/);
});

test("Eurostat parser expands dense JSON-stat cells with exact dimensions and labels", () => {
  const parsed = parseEurostatJsonStat({
    version: "2.0",
    class: "dataset",
    label: "Example HICP",
    source: "ESTAT",
    updated: "2026-08-20T11:00:00+0200",
    id: ["freq", "unit", "geo", "time"],
    size: [1, 1, 1, 2],
    dimension: {
      freq: { category: { index: { M: 0 }, label: { M: "Monthly" } } },
      unit: { category: { index: { I25: 0 }, label: { I25: "Index, 2025=100" } } },
      geo: { category: { index: { EA20: 0 }, label: { EA20: "Euro area - 20 countries" } } },
      time: { category: { index: { "2026-06": 0, "2026-07": 1 }, label: { "2026-06": "2026-06", "2026-07": "2026-07" } } },
    },
    value: [101.2, 102.4],
  }, "prc_hicp_midx", "https://example.test/eurostat");

  assert.equal(parsed.label, "Example HICP");
  assert.equal(parsed.updated, "2026-08-20T11:00:00+0200");
  assert.equal(parsed.observations.length, 2);
  assert.deepEqual(parsed.observations[1].dimensions, {
    freq: "M",
    unit: "I25",
    geo: "EA20",
    time: "2026-07",
  });
  assert.equal(parsed.observations[1].labels.geo, "Euro area - 20 countries");
  assert.equal(parsed.observations[1].value, 102.4);
});

test("Eurostat parser preserves sparse values and observation status", () => {
  const parsed = parseEurostatJsonStat({
    class: "dataset",
    id: ["geo", "time"],
    size: [2, 2],
    dimension: {
      geo: { category: { index: ["DE", "FR"], label: { DE: "Germany", FR: "France" } } },
      time: { category: { index: ["2025", "2026"], label: { "2025": "2025", "2026": "2026" } } },
    },
    value: { "0": 1.5, "3": 2.5 },
    status: { "3": "p" },
  }, "demo", "https://example.test/eurostat");

  assert.equal(parsed.observations.length, 2);
  assert.deepEqual(parsed.observations[1].dimensions, { geo: "FR", time: "2026" });
  assert.equal(parsed.observations[1].value, 2.5);
  assert.equal(parsed.observations[1].status, "p");
});

test("Eurostat parser rejects schema drift and oversized responses", () => {
  assert.throws(() => parseEurostatJsonStat({
    class: "dataset",
    id: ["geo"],
    size: [2],
    dimension: { geo: { category: { index: { DE: 0 } } } },
    value: [1, 2],
  }, "demo", "https://example.test/eurostat"), /expected 2 categories/);

  assert.throws(() => parseEurostatJsonStat({
    class: "dataset",
    id: ["geo", "time"],
    size: [100, 100],
    dimension: {
      geo: { category: { index: Array.from({ length: 100 }, (_, i) => `G${i}`) } },
      time: { category: { index: Array.from({ length: 100 }, (_, i) => `T${i}`) } },
    },
    value: {},
  }, "demo", "https://example.test/eurostat", 5_000), /safety bound/);
});

test("Eurostat fetch returns a ready normalized snapshot from the keyless official endpoint", async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      class: "dataset",
      label: "GDP example",
      source: "ESTAT",
      updated: "2026-08-20T11:00:00+0200",
      id: ["geo", "time"],
      size: [1, 1],
      dimension: {
        geo: { category: { index: { DE: 0 }, label: { DE: "Germany" } } },
        time: { category: { index: { "2026": 0 }, label: { "2026": "2026" } } },
      },
      value: [3.1],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const snapshot = await fetchEurostatSensor({
    datasetCode: "nama_10_gdp",
    filters: { geo: "DE", lastTimePeriod: "1" },
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.dataset?.observations[0].value, 3.1);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith(`${EUROSTAT_STATISTICS_BASE_URL}/nama_10_gdp?`));
});

test("Eurostat HTTP, network and invalid-query failures remain explicit", async () => {
  const badQuery = await fetchEurostatSensor({
    datasetCode: "nama_10_gdp",
    filters: {},
    fetchImpl: (async () => new Response("unused", { status: 200 })) as typeof fetch,
  });
  assert.equal(badQuery.state, "unavailable");

  const httpFailure = await fetchEurostatSensor({
    datasetCode: "nama_10_gdp",
    filters: { geo: "DE" },
    fetchImpl: (async () => new Response("down", { status: 503 })) as typeof fetch,
  });
  assert.equal(httpFailure.state, "unavailable");
  assert.match(httpFailure.note ?? "", /HTTP 503/);
});
