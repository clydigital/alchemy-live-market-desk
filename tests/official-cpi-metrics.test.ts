import assert from "node:assert/strict";
import test from "node:test";
import { parseOfficialCpiMetricRows } from "../lib/macro/official-cpi-metrics.ts";
import { resolveOfficialActual } from "../lib/macro/official-actuals.ts";

test("official CPI releases yield four separately comparable actuals without invented consensus", () => {
  const rows = parseOfficialCpiMetricRows("Headline CPI +0.6% m/m; +3.7% y/y; Core +0.3% m/m; +2.6% y/y");
  assert.deepEqual(rows.map(({ metric_key, actual, previous, transformation }) =>
    [metric_key, actual, previous, transformation]), [
    ["cpi_headline_mom", 0.6, null, "mom"],
    ["cpi_headline_yoy", 3.7, null, "yoy"],
    ["cpi_core_mom", 0.3, null, "mom"],
    ["cpi_core_yoy", 2.6, null, "yoy"],
  ]);
  assert.deepEqual(parseOfficialCpiMetricRows("CPI rose 0.6%; core was strong."), []);
});

test("BLS prior-month CPI comparisons come from aligned official series", async () => {
  const points = (values: Array<[string, string, string]>) =>
    values.map(([year, period, value]) => ({ year, period, value }));
  const response = {
    status: "REQUEST_SUCCEEDED",
    Results: { series: [
      { seriesID: "CUSR0000SA0", data: points([
        ["2026", "M09", "102.000"], ["2026", "M08", "101.39165"], ["2026", "M07", "100.9877"],
      ]) },
      { seriesID: "CUUR0000SA0", data: points([
        ["2026", "M09", "103.700"], ["2025", "M09", "100.000"],
        ["2026", "M08", "102.500"], ["2025", "M08", "99.12959"],
      ]) },
      { seriesID: "CUSR0000SA0L1E", data: points([
        ["2026", "M09", "102.6069"], ["2026", "M08", "102.300"],
        ["2026", "M07", "101.994"],
      ]) },
      { seriesID: "CUUR0000SA0L1E", data: points([
        ["2026", "M09", "102.600"], ["2025", "M09", "100.000"],
        ["2026", "M08", "102.400"], ["2025", "M08", "100.000"],
      ]) },
    ] },
  };
  const resolved = await resolveOfficialActual({
    id: "us-bls-2026-10-14-cpi-september-2026",
    release_name: "Consumer Price Index for September 2026",
    agency: "U.S. Bureau of Labor Statistics",
    reference_period: "September 2026",
    release_date: "2026-10-14T12:30:00Z",
    status: "completed",
    actual: null,
    source_url: "https://www.bls.gov/news.release/archives/cpi_10142026.htm",
  }, async () => new Response(JSON.stringify(response), { status: 200 }));
  assert.deepEqual(resolved.previousCpiMetrics, {
    cpi_headline_mom: 0.4,
    cpi_headline_yoy: 3.4,
    cpi_core_mom: 0.3,
    cpi_core_yoy: 2.4,
  });
  assert.deepEqual(parseOfficialCpiMetricRows(resolved.actual, resolved.previousCpiMetrics)
    .map(({ metric_key, actual, previous }) => [metric_key, actual, previous]), [
    ["cpi_headline_mom", 0.6, 0.4],
    ["cpi_headline_yoy", 3.7, 3.4],
    ["cpi_core_mom", 0.3, 0.3],
    ["cpi_core_yoy", 2.6, 2.4],
  ]);
});
