import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStructuredEconomicMetrics,
  economicGeography,
  parseEconomicNumber,
  type EconomicMetricRelease,
} from "../lib/economic-metrics.ts";

function release(overrides: Partial<EconomicMetricRelease> = {}): EconomicMetricRelease {
  return {
    id: "us-cpi-yoy-2026-07",
    series_key: "us-cpi-yoy",
    release_name: "Consumer Price Index (CPI) YoY",
    agency: "U.S. Bureau of Labor Statistics",
    category: "Inflation",
    release_date: "2026-08-12T12:30:00.000Z",
    reference_period: "July 2026",
    frequency: "Monthly",
    actual: "2.7%",
    consensus: "2.8%",
    previous: "2.9%",
    revised_previous: null,
    unit: "%",
    source_url: "https://www.bls.gov/cpi/",
    published_at: "2026-08-12T12:30:00.000Z",
    actual_retrieved_at: "2026-08-12T12:31:00.000Z",
    consensus_source: "Desk consensus review",
    consensus_captured_at: "2026-08-12T11:00:00.000Z",
    ...overrides,
  };
}

test("parses CPI YoY as a percent rate of change", () => {
  const [metric] = buildStructuredEconomicMetrics([release()]);
  assert.equal(metric.transformation, "yoy");
  assert.equal(metric.unit, "%");
  assert.equal(metric.actual, 2.7);
});

test("parses existing economic value units with percentage-point precedence", () => {
  assert.deepEqual(parseEconomicNumber("0.3 percentage points"), { value: 0.3, unit: "percentage points" });
  assert.deepEqual(parseEconomicNumber("2.7%"), { value: 2.7, unit: "%" });
  assert.deepEqual(parseEconomicNumber("323.048 index points"), { value: 323.048, unit: "index points" });
});

test("maps only deterministically recognised economic geographies", () => {
  const geography = (agency: string, series_key: string, source_url: string) => economicGeography({ agency, series_key, source_url });

  assert.equal(geography("U.S. Bureau of Labor Statistics", "cpi-yoy", "https://www.bls.gov/cpi/"), "United States");
  assert.equal(geography("Reserve Bank of Australia", "cash-rate", "https://www.rba.gov.au/"), "Australia");
  assert.equal(geography("Reserve Bank of New Zealand", "ocr", "https://www.rbnz.govt.nz/"), "New Zealand");
  assert.equal(geography("Bank of England", "bank-rate", "https://www.bankofengland.co.uk/"), "United Kingdom");
  assert.equal(geography("Bank of Japan", "policy-rate", "https://www.boj.or.jp/en/"), "Japan");
  assert.equal(geography("Bank of Canada", "policy-rate", "https://www.bankofcanada.ca/"), "Canada");
  assert.equal(geography("European Central Bank", "deposit-rate", "https://www.ecb.europa.eu/"), "Euro Area");
  assert.equal(geography("Banco Central do Brasil", "policy-rate", "https://www.bcb.gov.br/"), "Unknown");
  assert.notEqual(geography("Unknown foreign agency", "mystery-release", "https://example.test/release"), "United States");
});

test("parses CPI MoM separately from CPI YoY", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    id: "us-cpi-mom-2026-07",
    series_key: "us-cpi-mom",
    release_name: "Consumer Price Index (CPI) MoM",
    actual: "0.2%",
    consensus: "0.3%",
    previous: "0.3%",
  })]);
  assert.equal(metric.transformation, "mom");
  assert.equal(metric.actual, 0.2);
});

test("keeps a CPI index observation as a level", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    id: "us-cpi-index-2026-07",
    series_key: "us-cpi-index",
    release_name: "Consumer Price Index level",
    actual: "323.048 index points",
    consensus: null,
    previous: "322.561 index points",
    unit: "index points",
  })]);
  assert.equal(metric.transformation, "level");
  assert.equal(metric.unit, "index points");
  assert.equal(metric.actual, 323.048);
});

test("preserves revised previous separately", () => {
  const [metric] = buildStructuredEconomicMetrics([release({ revised_previous: "2.8%" })]);
  assert.equal(metric.previous, 2.9);
  assert.equal(metric.revised_previous, 2.8);
});

test("creates a pre-release metric without fabricating Actual", () => {
  const [metric] = buildStructuredEconomicMetrics([release({ actual: null })]);
  assert.equal(metric.actual, null);
  assert.equal(metric.consensus, 2.8);
});

test("keeps a valid scheduled metric identity when every observation is still absent", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    actual: null,
    consensus: null,
    previous: null,
    revised_previous: null,
  })]);
  assert.equal(metric.transformation, "yoy");
  assert.deepEqual(
    [metric.actual, metric.consensus, metric.previous, metric.revised_previous],
    [null, null, null, null],
  );
});

test("allows consensus to remain absent", () => {
  const [metric] = buildStructuredEconomicMetrics([release({ consensus: null })]);
  assert.equal(metric.consensus, null);
  assert.equal(metric.actual, 2.7);
});

test("identifies an RBA rate decision as an Australian level", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    id: "au-rba-2026-08",
    series_key: "au-rba-cash-rate",
    release_name: "RBA cash rate decision",
    agency: "Reserve Bank of Australia",
    category: "Central bank",
    actual: "3.60%",
    consensus: "3.60%",
    previous: "3.85%",
  })]);
  assert.equal(metric.geography, "Australia");
  assert.equal(metric.transformation, "level");
  assert.equal(metric.unit, "%");
});

test("identifies an RBNZ OCR decision as a New Zealand level", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    id: "nz-rbnz-2026-08",
    series_key: "nz-rbnz-ocr",
    release_name: "RBNZ OCR decision",
    agency: "Reserve Bank of New Zealand",
    category: "Central bank",
    actual: null,
    consensus: "2.25%",
    previous: "2.25%",
  })]);
  assert.equal(metric.geography, "New Zealand");
  assert.equal(metric.transformation, "level");
});

test("parses US payrolls on the reported thousand-person scale", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    id: "us-payrolls-2026-07",
    series_key: "us-nonfarm-payrolls",
    release_name: "Nonfarm Payrolls",
    category: "Labour",
    actual: "73k payrolls",
    consensus: "104k",
    previous: "147k",
    unit: "thousand",
  })]);
  assert.equal(metric.transformation, "change");
  assert.equal(metric.unit, "thousand");
  assert.equal(metric.actual, 73);
});

test("distinguishes GDP QoQ from GDP YoY", () => {
  const metrics = buildStructuredEconomicMetrics([
    release({ id: "uk-gdp-qoq", series_key: "uk-gdp-qoq", release_name: "GDP QoQ", agency: "UK Office for National Statistics", actual: "0.3%" }),
    release({ id: "uk-gdp-yoy", series_key: "uk-gdp-yoy", release_name: "GDP YoY", agency: "UK Office for National Statistics", actual: "1.2%" }),
  ]);
  assert.deepEqual(new Set(metrics.map((metric) => metric.transformation)), new Set(["qoq", "yoy"]));
});

test("deduplicates equivalent releases and retains the richer record", () => {
  const metrics = buildStructuredEconomicMetrics([
    release({ id: "duplicate-empty", actual: null, consensus: null }),
    release({ id: "duplicate-rich" }),
  ]);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].release_id, "duplicate-rich");
});

test("rejects malformed numeric strings", () => {
  assert.equal(parseEconomicNumber("1.2.3%"), null);
  assert.equal(parseEconomicNumber("2.7% revised from 2.9%"), null);
  assert.equal(parseEconomicNumber("not available"), null);
});

test("does not mix percentages with index points", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    id: "us-cpi-index-unit-conflict",
    series_key: "us-cpi-index",
    release_name: "Consumer Price Index level",
    unit: "index points",
    actual: "2.7%",
    consensus: null,
    previous: "322.561 index points",
  })]);
  assert.equal(metric.actual, null);
  assert.equal(metric.previous, 322.561);
  assert.equal(metric.unit, "index points");
});

test("production-like release rows generate structured metrics", () => {
  const metrics = buildStructuredEconomicMetrics([
    release(),
    release({ id: "us-payrolls", series_key: "us-nonfarm-payrolls", release_name: "Nonfarm Payrolls", category: "Labour", actual: "73k", unit: "thousand" }),
    release({ id: "au-rba", series_key: "au-rba-cash-rate", release_name: "RBA cash rate decision", agency: "Reserve Bank of Australia", category: "Central bank", actual: null, consensus: "3.60%", previous: "3.85%" }),
  ]);
  assert.ok(metrics.length > 0);
  assert.equal(metrics.length, 3);
});

test("a valid index-level release is never labelled as rate of change", () => {
  const [metric] = buildStructuredEconomicMetrics([release({
    series_key: "us-cpi-index",
    release_name: "CPI Index",
    actual: "323.048",
    unit: "index",
  })]);
  assert.equal(metric.transformation, "level");
  assert.notEqual(metric.transformation, "mom");
  assert.notEqual(metric.transformation, "yoy");
});

test("previous and revised previous remain distinct in the structured output", () => {
  const [metric] = buildStructuredEconomicMetrics([release({ previous: "2.9%", revised_previous: "2.8%" })]);
  assert.deepEqual({ previous: metric.previous, revisedPrevious: metric.revised_previous }, { previous: 2.9, revisedPrevious: 2.8 });
});
