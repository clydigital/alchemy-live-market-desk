import assert from "node:assert/strict";
import test from "node:test";

import { buildMacroSnapshot } from "../lib/macro/macro-snapshot.ts";
import {
  buildMacroNormalizationPlan,
  buildMacroSourceChangeEvents,
  mergeSecondaryReleaseCandidate,
} from "../lib/macro/macro-normalization.ts";

const ALL_SECTIONS = [
  "Calendar", "ISM", "NFIB", "Housing", "Energy", "Bonds", "Retail",
  "Employment", "Inflation", "FedWatch", "Credit", "COT", "Commodities",
];

function fixture(input: { cpi?: string; core?: string; ism?: string; includeGeneric?: boolean; includeCot?: boolean } = {}) {
  const includeCot = input.includeCot ?? true;
  const sections = ALL_SECTIONS.filter((section) => includeCot || section !== "COT").join(" ");
  return [
    sections,
    "# Calendar",
    "| Date | Time (CET) | Imp | Event | Actual | Surprise | Forecast | Previous | Charts |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| 19-Aug-26 | 14:30 | ★★★ | CPI YoY | ${input.cpi ?? "3.4%"} | 0.0% | 3.4% | 3.5% | Inflation |`,
    `| 19-Aug-26 | 14:30 | ★★★ | Core CPI YoY | ${input.core ?? "2.5%"} | 0.0% | 2.5% | 2.6% | Inflation |`,
    "# ISM Manufacturing",
    "|  | Headline | New Ord | Prod/BA | Empl | Deliv | Inv | Prices | Backlog | Exports | Imports | Cust/Sent |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| Jul-26 | ${input.ism ?? "55.6"} | 56.7 | 58.5 | 52.8 | 58.9 | 51.2 | 71.1 | 55.0 | 53.0 | 55.7 | 40.7 |`,
    "# FedWatch",
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
    ...(includeCot ? [
      "# COT",
      "| Instrument | Noncommercial smart money net (1w Δ) | 3y %ile | Commercial net (1w Δ) | 3y %ile | Nonreportable net (1w Δ) | 3y %ile | Open Int. |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| Metals |",
      "| Gold | +100 | 90 | -100 | 10 | 0 | 50 | 500 |",
    ] : []),
    ...(input.includeGeneric ? [
      "# Credit",
      "Generic extra table",
      "| Name | Value |",
      "| --- | --- |",
      "| Stress | 12 |",
    ] : []),
    "x".repeat(600),
  ].join("\n");
}

test("calendar components group into one canonical release while retaining row-level metrics", () => {
  const snapshot = buildMacroSnapshot(fixture(), "2026-08-19T14:35:00Z");
  const plan = buildMacroNormalizationPlan(snapshot, "snapshot-a", "https://macro-indicators-a3d.pages.dev/");

  assert.equal(snapshot.status, "COMPLETE");
  assert.equal(plan.releases.length, 1);
  assert.equal(plan.metrics.length, 2);
  const release = plan.releases[0];
  assert.equal(release.seriesKey, "cpi");
  assert.equal(release.releaseName, "Consumer Price Index");
  assert.equal(release.releaseDate, "2026-08-19T13:30:00.000Z");
  assert.equal(release.actual, null, "multi-metric releases must not collapse component Actuals into one prose field");
  assert.equal(release.sourceRowKey, null, "grouped release anchor must not pretend to come from one component row");
  assert.deepEqual(plan.metrics.map((metric) => metric.actual), [3.4, 2.5]);
  assert.deepEqual(plan.metrics.map((metric) => metric.sourceRowKey), [
    "19-Aug-26|14:30|CPI YoY",
    "19-Aug-26|14:30|Core CPI YoY",
  ]);
});

test("ISM main table becomes deterministic monthly canonical series observations", () => {
  const snapshot = buildMacroSnapshot(fixture(), "2026-08-19T14:35:00Z");
  const plan = buildMacroNormalizationPlan(snapshot, "snapshot-a", "https://macro-indicators-a3d.pages.dev/");
  assert.equal(plan.seriesObservations.length, 11);
  const headline = plan.seriesObservations.find((observation) => observation.seriesKey === "ism_manufacturing_headline");
  assert.equal(headline?.observationDate, "2026-07-01");
  assert.equal(headline?.value, 55.6);
  assert.equal(headline?.unit, "Index");
  assert.equal(headline?.sourceRowKey, "Jul-26");
  assert.equal(headline?.sourceColumn, "Headline");
  assert.equal(headline?.id, "jina-series:ism_manufacturing_headline:2026-07-01");
});

test("unsupported FedWatch, COT and generic structures remain raw-only instead of being forced into canonical series", () => {
  const snapshot = buildMacroSnapshot(fixture({ includeGeneric: true }));
  const plan = buildMacroNormalizationPlan(snapshot, "snapshot-a", "https://macro-indicators-a3d.pages.dev/");
  const skippedKinds = snapshot.tables
    .filter((table) => plan.skippedTableIds.includes(table.tableId))
    .map((table) => table.kind);
  assert.equal(skippedKinds.includes("fedwatch-rate-path"), true);
  assert.equal(skippedKinds.includes("cot-legacy"), true);
  assert.equal(skippedKinds.includes("generic"), true);
});

test("PARTIAL snapshots are never normalized into canonical tables", () => {
  const snapshot = buildMacroSnapshot(fixture({ includeCot: false }));
  const plan = buildMacroNormalizationPlan(snapshot, "snapshot-b", "https://macro-indicators-a3d.pages.dev/");
  assert.equal(snapshot.status, "PARTIAL");
  assert.equal(plan.releases.length, 0);
  assert.equal(plan.metrics.length, 0);
  assert.equal(plan.seriesObservations.length, 0);
});

test("deterministic change events preserve exact old/new values and are idempotent for identical captures", () => {
  const previous = buildMacroSnapshot(fixture({ cpi: "3.4%" }), "2026-08-19T14:35:00Z");
  const current = buildMacroSnapshot(fixture({ cpi: "3.5%" }), "2026-08-19T15:35:00Z");
  const events = buildMacroSourceChangeEvents(previous, current, "snapshot-a", "snapshot-b");
  assert.equal(events.length, 1);
  assert.equal(events[0].changeType, "CELL_CHANGED");
  assert.equal(events[0].rowKey, "19-Aug-26|14:30|CPI YoY");
  assert.equal(events[0].columnKey, "Actual");
  assert.equal(events[0].oldValue, "3.4%");
  assert.equal(events[0].newValue, "3.5%");

  const identical = buildMacroSnapshot(fixture({ cpi: "3.4%" }), "2026-08-19T15:35:00Z");
  assert.equal(buildMacroSourceChangeEvents(previous, identical, "snapshot-a", "snapshot-c").length, 0);
});

test("a table removed from an otherwise COMPLETE snapshot becomes an explicit deterministic TABLE_REMOVED event", () => {
  const previous = buildMacroSnapshot(fixture({ includeGeneric: true }), "2026-08-19T14:35:00Z");
  const current = buildMacroSnapshot(fixture({ includeGeneric: false }), "2026-08-19T15:35:00Z");
  assert.equal(previous.status, "COMPLETE");
  assert.equal(current.status, "COMPLETE");
  const events = buildMacroSourceChangeEvents(previous, current, "snapshot-a", "snapshot-b");
  assert.equal(events.some((event) => event.changeType === "TABLE_REMOVED"), true);
});

test("secondary Jina data fills canonical gaps but never overwrites an existing official value", () => {
  const snapshot = buildMacroSnapshot(fixture({ cpi: "3.4%" }));
  const candidate = buildMacroNormalizationPlan(snapshot, "snapshot-a", "https://macro-indicators-a3d.pages.dev/").releases[0];
  const existing = {
    actual: "3.3%",
    consensus: null,
    previous: "3.5%",
    revised_previous: null,
    unit: "Percent",
    country: null,
    impact: "High",
  };
  const patch = mergeSecondaryReleaseCandidate(existing, candidate);
  assert.equal("actual" in patch, false);
  assert.equal(patch.consensus, null, "grouped CPI anchor has no single consensus and must not fabricate one");
  assert.equal("previous" in patch, false);
  assert.equal("unit" in patch, false);
  assert.equal(patch.source_snapshot_id, undefined, "lineage is attached only when the secondary source actually fills a field");

  const singleSnapshot = buildMacroSnapshot(fixture().replace(/\n\| 19-Aug-26 \| 14:30 \| ★★★ \| Core CPI YoY[^\n]+/, ""));
  const singleCandidate = buildMacroNormalizationPlan(singleSnapshot, "snapshot-b", "https://macro-indicators-a3d.pages.dev/").releases[0];
  const gapPatch = mergeSecondaryReleaseCandidate({ ...existing, actual: null }, singleCandidate);
  assert.equal(gapPatch.actual, "3.4%");
  assert.equal(gapPatch.source_snapshot_id, "snapshot-b");
});
