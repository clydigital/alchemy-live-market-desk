import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJobsPublicProjection,
  type JobsReleaseRecord,
  type JobsMetricRecord,
} from "../lib/macro/jobs-public-projection.ts";
import { BLS_MAJOR_SECTORS } from "../lib/macro/bls-labour-composition.ts";

const URL = "https://www.bls.gov/news.release/archives/empsit_11062026.htm";
const REFERENCE = "October 2026";
const CHANGES: Record<string, number> = {
  mining_logging: -1, construction: -3, manufacturing: 19, wholesale: -9.1,
  retail: 6, transport_warehousing: 24.8, utilities: 0.1, information: -1,
  financial: 7, professional_business: 70, education_health: 53,
  leisure_hospitality: -13, other_services: 6, government: 6,
};
function release(): JobsReleaseRecord {
  return {
    id: "us-bls-2026-11-06-employment-situation-october-2026",
    release_name: "Employment Situation for October 2026",
    reference_period: REFERENCE,
    release_date: "2026-11-06T13:30:00Z",
    source_url: URL, actual: "Nonfarm payrolls +165k; unemployment 4.1%",
    status: "completed", consensus: null, consensus_source: null,
    consensus_captured_at: null,
  };
}
function metric(key: string, actual: number, seriesId: string,
  survey: "CES" | "CPS", previous: number | null = null): JobsMetricRecord {
  return {
    metric_key: key, actual, previous, unit: null,
    source_url: URL, retrieved_at: "2026-11-07T21:46:06.048Z",
    metadata: {
      provider: "BLS", sourceSeriesId: seriesId, sourceSurvey: survey,
      referencePeriod: REFERENCE, sourceVintage: "original_archived_release",
      reconstructedAfterRelease: true,
    },
  };
}
function sourceMetrics() {
  return [
    ...BLS_MAJOR_SECTORS.map(s => metric(
      "employment_sector_" + s.key + "_net_change", CHANGES[s.key], s.id, "CES",
    )),
    metric("labour_u6_rate", 7.9, "LNS13327709", "CPS", 7.6),
    metric("labour_private_weekly_hours", 34.4, "CES0500000002", "CES", 34.4),
  ];
}

test("October 2026 public jobs readback reconciles the first-party archive, no invented forecast", () => {
  const panel = buildJobsPublicProjection(release(), sourceMetrics());
  assert.equal(panel.status, "ready");
  assert.equal(panel.headlineChangeK, 165);
  assert.equal(panel.sectorCount, 14);
  assert.equal(panel.summedChangeK, 164.8);
  assert.equal(panel.growing, 9);
  assert.equal(panel.shrinking, 5);
  assert.equal(panel.u6?.current, 7.9);
  assert.equal(panel.u6?.previous, 7.6);
  assert.equal(panel.weeklyHours?.current, 34.4);
  assert.equal(panel.weeklyHours?.previous, 34.4);
  assert.equal(panel.forecastState, "unverified");
  assert.equal(panel.sourceVintage, "original_archived_release");
  assert.deepEqual(panel.divergences.map(s => s.code),
    ["PAYROLL_VS_U6", "CONSUMER_EXPOSED_SECTORS"]);
});

test("missing industry, wrong series, missing source, or missing vintage withholds breadth", () => {
  const badFixtures = [
    sourceMetrics().filter(x => x.metric_key !== "employment_sector_retail_net_change"),
    sourceMetrics().map(x => x.metric_key === "employment_sector_retail_net_change"
      ? { ...x, metadata: { ...x.metadata, sourceSeriesId: "CES0000000001" } } : x),
    sourceMetrics().map(x => x.metric_key === "employment_sector_wholesale_net_change"
      ? { ...x, source_url: "https://example.com/not-the-release" } : x),
    sourceMetrics().map(x => x.metric_key === "employment_sector_information_net_change"
      ? { ...x, metadata: { ...x.metadata, sourceVintage: null } } : x),
  ];
  for (const rows of badFixtures) {
    const panel = buildJobsPublicProjection(release(), rows);
    assert.equal(panel.status, "incomplete");
    assert.equal(panel.growing, null);
    assert.equal(panel.divergences.length, 0);
  }
});

test("revised/mixed vintages or unreconciled totals never appear as confirmed divergences", () => {
  const mixed = sourceMetrics();
  mixed[0].metadata = { ...mixed[0].metadata, sourceVintage: "current_api_vintage" };
  assert.equal(buildJobsPublicProjection(release(), mixed).status, "mixed_vintage");
  const wrong = sourceMetrics();
  wrong[0].actual = 17;
  const panel = buildJobsPublicProjection(release(), wrong);
  assert.equal(panel.status, "unreconciled");
  assert.equal(panel.divergences.length, 0);
});

test("only a documented pre-release forecast can appear frozen", () => {
  const after = release();
  after.consensus = "+60k";
  after.consensus_source = "https://example.com/forecast";
  after.consensus_captured_at = "2026-11-07T12:00:00Z";
  assert.equal(buildJobsPublicProjection(after, sourceMetrics()).forecastState, "unverified");
  const before = { ...after, consensus_captured_at: "2026-11-05T12:00:00Z" };
  assert.equal(buildJobsPublicProjection(before, sourceMetrics()).forecastState, "frozen");
});

test("does not leak a non-BLS or incomplete release into the public labour dashboard", () => {
  assert.equal(buildJobsPublicProjection(null, sourceMetrics()).status, "unavailable");
  assert.equal(buildJobsPublicProjection({
    ...release(), source_url: "https://example.com/claim",
  }, sourceMetrics()).status, "unavailable");
  assert.equal(buildJobsPublicProjection({ ...release(), actual: null }, sourceMetrics()).status,
    "incomplete");
});
