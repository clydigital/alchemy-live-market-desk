import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBeaDataUrl,
  fetchBeaSnapshot,
  parseBeaPayload,
} from "../lib/providers/bea.ts";

test("BEA URL requests only the registered GDP and PCE tables with the private key", () => {
  const url = new URL(buildBeaDataUrl("private-test-key", "2026"));
  assert.equal(url.origin + url.pathname, "https://apps.bea.gov/api/data");
  assert.equal(url.searchParams.get("UserID"), "private-test-key");
  assert.equal(url.searchParams.get("method"), "GetData");
  assert.equal(url.searchParams.get("datasetname"), "NIPA");
  assert.equal(url.searchParams.get("TableName"), "T10101,T20304");
  assert.equal(url.searchParams.get("Frequency"), "Q");
  assert.equal(url.searchParams.get("Year"), "2026");
  assert.equal(url.searchParams.get("ResultFormat"), "JSON");
});

test("BEA parser preserves table, line, period, value, units, and retrieval time", () => {
  const result = parseBeaPayload({
    BEAAPI: { Results: { Data: [
      { TableName: "T10101", LineNumber: "1", LineDescription: "Gross domestic product", TimePeriod: "2026Q2", DataValue: "31,000.0", Unit: "Billions of dollars" },
      { TableName: "T20304", LineNumber: "1", LineDescription: "Personal consumption expenditures", TimePeriod: "2026Q2", DataValue: "123.45", Unit: "Index 2017=100" },
      { TableName: "T10101", LineNumber: "1", TimePeriod: "2026Q1", DataValue: "30,500.0", Unit: "Billions of dollars" },
    ] } },
  }, { retrievedAt: "2026-10-13T00:00:00.000Z" });
  assert.equal(result.state, "ready");
  assert.equal(result.retrievedAt, "2026-10-13T00:00:00.000Z");
  assert.equal(result.observations.length, 3);
  assert.deepEqual(result.observations[0], {
    metric: "gdp", tableName: "T10101", lineNumber: "1", seriesId: "NIPA:T10101:1",
    label: "Gross domestic product", period: "2026Q2", value: 31000,
    unit: "Billions of dollars", frequency: "Q",
  });
});

test("BEA parser rejects malformed and nonnumeric observations without inventing values", () => {
  assert.equal(parseBeaPayload({ BEAAPI: { Results: { Data: "bad" } } }).state, "unavailable");
  const result = parseBeaPayload({ BEAAPI: { Results: { Data: [
    { TableName: "T10101", LineNumber: "1", TimePeriod: "2026Q2", DataValue: "N/A" },
    { TableName: "OTHER", LineNumber: "1", TimePeriod: "2026Q2", DataValue: "7" },
  ] } } });
  assert.equal(result.state, "unavailable");
  assert.deepEqual(result.observations, []);
});

test("BEA fetch reports missing configuration and provider failures explicitly", async () => {
  const unconfigured = await fetchBeaSnapshot("");
  assert.equal(unconfigured.state, "unconfigured");
  assert.equal(unconfigured.retrievedAt, null);
  const unavailable = await fetchBeaSnapshot("key", { fetchImpl: async () => new Response("no", { status: 503 }) });
  assert.equal(unavailable.state, "unavailable");
  assert.match(unavailable.note ?? "", /503/);
});

test("BEA transport failures never expose a credential-bearing URL", async () => {
  const result = await fetchBeaSnapshot("private-test-key", {
    fetchImpl: async () => { throw new Error("https://apps.bea.gov/api/data?UserID=private-test-key"); },
  });
  assert.equal(result.state, "unavailable");
  assert.equal(result.note, "BEA_REQUEST_FAILED");
  assert.doesNotMatch(JSON.stringify(result), /private-test-key/);
});
