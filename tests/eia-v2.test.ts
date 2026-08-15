import assert from "node:assert/strict";
import test from "node:test";

import { buildGlobalFlowMonitorFromInputs } from "../lib/global-flow-monitor.ts";
import {
  buildEiaWeeklyPetroleumUrl,
  EIA_WEEKLY_SERIES,
  fetchEiaWeeklyPetroleumSnapshot,
  parseEiaWeeklyPetroleumPayload,
  type EiaWeeklyPetroleumSnapshot,
} from "../lib/providers/eia-v2.ts";

test("EIA URL requests the configured weekly series through the official v2 route", () => {
  const url = new URL(buildEiaWeeklyPetroleumUrl("test-key"));
  assert.equal(url.origin + url.pathname, "https://api.eia.gov/v2/petroleum/sum/sndw/data/");
  assert.equal(url.searchParams.get("api_key"), "test-key");
  assert.equal(url.searchParams.get("frequency"), "weekly");
  assert.deepEqual(
    url.searchParams.getAll("facets[series][]").sort(),
    Object.values(EIA_WEEKLY_SERIES).map((item) => item.id).sort(),
  );
});

test("EIA payload parser keeps latest and previous values by stable series identity and sets retrievedAt", () => {
  const customRetrievedAt = "2026-08-15T10:00:00.000Z";
  const result = parseEiaWeeklyPetroleumPayload(
    {
      response: {
        data: [
          { period: "2026-08-07", series: "WCESTUS1", value: "430000", units: "Thousand Barrels" },
          { period: "2026-07-31", series: "WCESTUS1", value: "421000", units: "Thousand Barrels" },
          { period: "2026-08-07", series: "WPULEUS3", value: 95.1, units: "Percent" },
          { period: "2026-07-31", series: "WPULEUS3", value: 94.2, units: "Percent" },
          { period: "2026-08-07", series: "WCRRIUS2", value: "16500", units: "Thousand Barrels per Day" },
        ],
      },
    },
    { retrievedAt: customRetrievedAt },
  );

  assert.equal(result.state, "ready");
  assert.equal(result.asOf, "2026-08-07");
  assert.equal(result.retrievedAt, customRetrievedAt);
  assert.equal(result.metrics.crudeStocksExSpr?.seriesId, "WCESTUS1");
  assert.equal(result.metrics.crudeStocksExSpr?.canonicalUnit, "MBBL");
  assert.equal(result.metrics.crudeStocksExSpr?.latest.units, "MBBL");
  assert.equal(result.metrics.crudeStocksExSpr?.latest.value, 430000);
  assert.equal(result.metrics.crudeStocksExSpr?.previous?.value, 421000);
  assert.equal(result.metrics.refineryUtilisation?.latest.value, 95.1);
  assert.equal(result.metrics.refineryUtilisation?.latest.units, "%");
  assert.equal(result.metrics.refineryCrudeInputs?.latest.units, "MBBL/D");
});

test("EIA parser handles missing data, malformed payloads and non-numeric rows without fabricating data", () => {
  const malformed = parseEiaWeeklyPetroleumPayload({ response: "not an object" });
  assert.equal(malformed.state, "unavailable");
  assert.deepEqual(malformed.metrics, {});

  const invalidRows = parseEiaWeeklyPetroleumPayload({
    response: {
      data: [
        { period: "2026-08-07", series: "WCESTUS1", value: "not-a-number", units: "MBBL" },
        { period: "2026-08-07", series: "UNKNOWN_SERIES", value: "12345", units: "MBBL" },
        { period: null, series: "WGTSTUS1", value: 200000, units: "MBBL" },
      ],
    },
  });
  assert.equal(invalidRows.state, "unavailable");
  assert.deepEqual(invalidRows.metrics, {});
});

test("EIA fetch degrades explicitly when no key is configured", async () => {
  const result = await fetchEiaWeeklyPetroleumSnapshot("");
  assert.equal(result.state, "unconfigured");
  assert.equal(result.retrievedAt, null);
  assert.match(result.note || "", /EIA_API_KEY/);
  assert.deepEqual(result.metrics, {});
});

test("Canonical global-flow monitor consumes correctly normalized EIA output", async () => {
  const mockEia: EiaWeeklyPetroleumSnapshot = parseEiaWeeklyPetroleumPayload(
    {
      response: {
        data: [
          { period: "2026-08-07", series: "WCESTUS1", value: 435000, units: "MBBL" },
          { period: "2026-07-31", series: "WCESTUS1", value: 420000, units: "MBBL" },
          { period: "2026-08-07", series: "WGTSTUS1", value: 220000, units: "MBBL" },
          { period: "2026-07-31", series: "WGTSTUS1", value: 218000, units: "MBBL" },
          { period: "2026-08-07", series: "WDISTUS1", value: 115000, units: "MBBL" },
          { period: "2026-07-31", series: "WDISTUS1", value: 116000, units: "MBBL" },
          { period: "2026-08-07", series: "WPULEUS3", value: 92.5, units: "%" },
          { period: "2026-07-31", series: "WPULEUS3", value: 91.0, units: "%" },
          { period: "2026-08-07", series: "WCRRIUS2", value: 16400, units: "MBBL/D" },
          { period: "2026-07-31", series: "WCRRIUS2", value: 16200, units: "MBBL/D" },
          { period: "2026-08-07", series: "WCRFPUS2", value: 13300, units: "MBBL/D" },
          { period: "2026-07-31", series: "WCRFPUS2", value: 13300, units: "MBBL/D" },
          { period: "2026-08-07", series: "WCSSTUS1", value: 375000, units: "MBBL" },
          { period: "2026-07-31", series: "WCSSTUS1", value: 374000, units: "MBBL" },
          { period: "2026-08-07", series: "WGFUPUS2", value: 9100, units: "MBBL/D" },
          { period: "2026-07-31", series: "WGFUPUS2", value: 8900, units: "MBBL/D" },
        ],
      },
    },
    { retrievedAt: "2026-08-15T10:00:00.000Z" },
  );

  const mockMarket = { rows: [], researchTriggers: [] };
  const monitor = await buildGlobalFlowMonitorFromInputs(null, mockMarket as never, mockEia);

  const crudeMetric = monitor.oil.find((item) => item.id === "us-crude-stocks");
  assert.ok(crudeMetric);
  assert.equal(crudeMetric.state, "ready");
  assert.equal(crudeMetric.current, "435,000 MBBL");
  assert.equal(crudeMetric.previous, "420,000 MBBL");
  assert.equal(crudeMetric.delta, "15,000 MBBL");
  assert.equal(crudeMetric.direction, "rising");
  assert.equal(crudeMetric.asOf, "2026-08-07");
  assert.equal(crudeMetric.sourceName, "U.S. EIA Open Data v2 · WCESTUS1");

  const buildTrigger = monitor.researchTriggers.find((t) => t.id === "eia-large-crude-inventory-build");
  assert.ok(buildTrigger);
  assert.match(buildTrigger.reason, /15,000 MBBL/);

  const allEiaIds = [
    "us-crude-stocks",
    "us-gasoline-stocks",
    "us-distillate-stocks",
    "us-refinery-utilisation",
    "us-refinery-inputs",
    "us-implied-demand",
    "us-spr",
    "us-production",
  ];
  for (const id of allEiaIds) {
    const m = monitor.oil.find((item) => item.id === id);
    assert.ok(m, `Metric ${id} should be present`);
    assert.equal(m.state, "ready");
  }
});

test("Canonical global-flow monitor consumes explicit unavailable/degraded diagnostic state gracefully", async () => {
  const degradedEia: EiaWeeklyPetroleumSnapshot = {
    state: "unavailable",
    asOf: null,
    retrievedAt: "2026-08-15T10:00:00.000Z",
    metrics: {},
    sourceName: "U.S. Energy Information Administration",
    sourceUrl: "https://api.eia.gov/v2/petroleum/sum/sndw/data/",
    note: "EIA Open Data API returned HTTP 503.",
  };

  const mockMarket = { rows: [], researchTriggers: [] };
  const monitor = await buildGlobalFlowMonitorFromInputs(null, mockMarket as never, degradedEia);

  const crudeMetric = monitor.oil.find((item) => item.id === "us-crude-stocks");
  assert.ok(crudeMetric);
  assert.equal(crudeMetric.state, "coverage_gap");
  assert.equal(crudeMetric.current, null);
  assert.equal(crudeMetric.previous, null);
  assert.equal(crudeMetric.delta, null);
  assert.equal(crudeMetric.direction, "unknown");

  const gapEntry = monitor.coverageGaps.find((g) => g.includes("EIA Open Data v2"));
  assert.ok(gapEntry);
  assert.match(gapEntry, /HTTP 503/);
});
