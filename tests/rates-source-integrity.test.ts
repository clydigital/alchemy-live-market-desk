import assert from "node:assert/strict";
import test from "node:test";
import { assessRatesSourceIntegrity, NOMINAL_TENOR_IDS, type RatesIntegrityInput } from "../lib/rates-source-integrity.ts";

const AS_OF = "2026-10-14T21:00:00.000Z";
const DOSS_AS_OF = "2026-10-14T20:55:22.057Z";
const UPSTREAM_UPDATED_AT = "2026-10-14T15:54:40Z";
function input(overrides: Partial<RatesIntegrityInput> = {}): RatesIntegrityInput {
  return {
    asOf: AS_OF, dossierId: "dossier-canonical-uuid", dossierAsOf: DOSS_AS_OF,
    dossierCoveragePresent: 5,
    dossierCurveEvidenceRefs: NOMINAL_TENOR_IDS.map((id) => "market-monitor:" + id + ":2026-10-14"),
    monitorRows: NOMINAL_TENOR_IDS.map((id) => ({ id, asOf: "2026-10-14", last: 5.1,
      sourceName: "U.S. Department of the Treasury", sourceUrl: "https://home.treasury.gov/rates",
      sourceUpdatedAt: UPSTREAM_UPDATED_AT })),
    dealer: { status: "STALE", asOf: "2026-09-30", sourceUrl: "https://markets.newyorkfed.org/api/pd", warnings: ["Weekly source delayed"] },
    ...overrides,
  };
}

test("complete five-tenor production snapshot warns only about stale upstream dealer publication", () => {
  const actual = assessRatesSourceIntegrity(input());
  assert.equal(actual.treasury.complete, 5);
  assert.equal(actual.operationalStatus, "WATCH");
  assert.ok(actual.treasury.states.every((item) => item.state === "COMPLETE"));
  assert.equal(actual.primaryDealers.state, "UPSTREAM_STALE");
  assert.ok(actual.alerts.every((alert) => alert.severity === "WATCH"));
});

test("loss of US 2Y after official publication is a downstream operational failure", () => {
  const x = input();
  x.dossierCurveEvidenceRefs = x.dossierCurveEvidenceRefs.filter((id) => !id.startsWith("market-monitor:us2y:"));
  x.dossierCoveragePresent = 4;
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.operationalStatus, "ACTION_REQUIRED");
  assert.equal(actual.treasury.states.find((item) => item.id === "us2y")?.state, "DOWNSTREAM_LOSS");
  assert.equal(actual.treasury.complete, 4);
  assert.ok(actual.alerts.some((alert) => alert.code === "PERSISTED_RATE_COVERAGE_INCOMPLETE"));
});

test("fresh source released after Dossier as-of must not be called downstream loss", () => {
  const x = input({ dossierAsOf: "2026-10-14T15:00:00.000Z" });
  x.dossierCurveEvidenceRefs = x.dossierCurveEvidenceRefs.filter((id) => !id.startsWith("market-monitor:us2y:"));
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us2y")?.state, "PENDING_REBASE");
});

test("older-than-five-day source data is upstream stale rather than invented fresh evidence", () => {
  const x = input();
  x.monitorRows = x.monitorRows.map((row) => row.id === "us30y-fred" ? { ...row, asOf: "2026-10-05", sourceUpdatedAt: null } : row);
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us30y-fred")?.state, "UPSTREAM_STALE");
});

test("missing monitor rows distinguish provider outage from lost Dossier evidence", () => {
  const x = input();
  x.monitorRows = x.monitorRows.filter((row) => row.id !== "us5y-fred");
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us5y-fred")?.state, "UPSTREAM_UNAVAILABLE");
  assert.equal(actual.operationalStatus, "WATCH");
});

test("alternative historical ten-year market-monitor ID is recognized without fabricating it", () => {
  const x = input();
  x.dossierCurveEvidenceRefs = x.dossierCurveEvidenceRefs.map((ref) => ref.startsWith("market-monitor:us10y-fred:") ? ref.replace("us10y-fred", "us10y") : ref);
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us10y-fred")?.state, "COMPLETE");
  assert.equal(actual.treasury.complete, 5);
});

test("missing licensed MOVE/FedWatch/direct UST are research gaps, not fictional market series", () => {
  const actual = assessRatesSourceIntegrity(input());
  assert.deepEqual(actual.inaccessibleDirectFeeds.map((item) => item.id),
    ["CME_FEDWATCH_INTRADAY", "INTRADAY_UST_2Y_10Y"]);
  assert.equal(actual.inaccessibleDirectFeeds.every((item) => item.state === "NOT_ENTITLED_OR_NOT_INTEGRATED"), true);
});

test("stored five-session bp movements must survive whenever all source sessions are directly observed", () => {
  const x = input();
  const dates = ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14"];
  x.monitorRows = x.monitorRows.map((row) => ({ ...row,
    points: dates.map((date, index) => ({ time: Date.parse(date + "T00:00:00Z") / 1000, close: 5 + index * 0.02 })),
  }));
  x.dossierCurveMoves = [
    { maturity: "2Y", change5dBp: 10 },
    { maturity: "5Y", change5dBp: 10 },
    { maturity: "10Y", change5dBp: null },
    { maturity: "20Y", change5dBp: 10 },
    { maturity: "30Y", change5dBp: 10 },
  ];
  const bad = assessRatesSourceIntegrity(x);
  assert.equal(bad.fiveSessionCurve.state, "DOWNSTREAM_MEASUREMENT_MISSING");
  assert.deepEqual(bad.fiveSessionCurve.missingMaturities, ["10Y"]);
  assert.ok(bad.alerts.some((a) => a.code === "TREASURY_FIVE_SESSION_MOVEMENT_LOST"));
  assert.equal(bad.operationalStatus, "ACTION_REQUIRED");
  x.dossierCurveMoves[2].change5dBp = 10;
  const repaired = assessRatesSourceIntegrity(x);
  assert.equal(repaired.fiveSessionCurve.state, "COMPLETE");
  assert.equal(repaired.operationalStatus, "WATCH"); // existing genuinely stale NY Fed source
});

test("unfinished newer Dossier or insufficient matched history cannot trigger a false momentum loss alert", () => {
  const x = input();
  const assessed = assessRatesSourceIntegrity(x);
  assert.equal(assessed.fiveSessionCurve.state, "NOT_COMPUTABLE");
  assert.equal(assessed.alerts.some((a) => a.code === "TREASURY_FIVE_SESSION_MOVEMENT_LOST"), false);
});

test("MOVE adapter readiness is source-derived rather than perpetually marked unintegrated", () => {
  const x = input();
  assert.equal(assessRatesSourceIntegrity(x).move.state, "ADAPTER_PRESENT_NO_VERIFIED_DATA");
  x.monitorRows.push({ id: "move", asOf: "2026-10-14", last: 81.1,
    sourceName: "Barchart OnDemand · ICE BofA MOVE Index", sourceUrl: "https://www.barchart.com/stocks/quotes/$MOVE" });
  assert.equal(assessRatesSourceIntegrity(x).move.state, "OBSERVED");
  x.monitorRows[x.monitorRows.length - 1].sourceName = "VIXY proxy";
  assert.equal(assessRatesSourceIntegrity(x).move.state, "ADAPTER_PRESENT_NO_VERIFIED_DATA");
  x.monitorRows[x.monitorRows.length - 1].sourceName = "Barchart OnDemand · ICE BofA MOVE Index";
  x.monitorRows[x.monitorRows.length - 1].asOf = "2026-10-03";
  const stale = assessRatesSourceIntegrity(x);
  assert.equal(stale.move.state, "STALE");
  assert.ok(stale.alerts.some((a) => a.code === "MOVE_UPSTREAM_STALE"));
});

test("lost eligible 10Y breakeven escalates even while five nominal tenors remain 5/5", () => {
  const x = input();
  x.dossierCoveragePresent = 4;
  x.dossierRequiredRateMissing = ["US 10Y breakeven"];
  x.monitorRows.push({ id: "us10y-breakeven", asOf: "2026-10-13", last: 2.35,
    sourceName: "Federal Reserve Economic Data", sourceUrl: "https://fred.stlouisfed.org/series/T10YIE" });
  const result = assessRatesSourceIntegrity(x);
  assert.equal(result.treasury.complete, 5);
  assert.equal(result.requiredRateInputs.present, 4);
  assert.equal(result.operationalStatus, "ACTION_REQUIRED");
  assert.deepEqual(result.requiredRateInputs.diagnostics.map((x) => x.state), ["DOWNSTREAM_LOSS"]);
  assert.ok(result.alerts.some((x) => x.code === "REQUIRED_RATE_INPUT_US10Y_BREAKEVEN" && x.severity === "ACTION_REQUIRED"));
});

test("same-day FRED received after dossier as-of is pending, not a proven downstream loss", () => {
  const x = input();
  x.dossierCoveragePresent = 4;
  x.dossierRequiredRateMissing = ["US 10Y breakeven"];
  x.monitorUpdatedAt = "2026-10-14T21:00:00.000Z"; // newer than Dossier
  x.monitorRows.push({ id: "us10y-breakeven", asOf: "2026-10-14", last: 2.35,
    sourceName: "Federal Reserve Economic Data", sourceUrl: "https://fred.stlouisfed.org/series/T10YIE" });
  const result = assessRatesSourceIntegrity(x);
  assert.equal(result.requiredRateInputs.diagnostics[0].state, "PENDING_REBASE");
  assert.equal(result.operationalStatus, "WATCH");
});

test("same-day FRED with a pre-Dossier near-live source receipt is a real downstream loss", () => {
  const x = input();
  x.dossierCoveragePresent = 4;
  x.dossierRequiredRateMissing = ["US 10Y breakeven"];
  x.monitorUpdatedAt = "2026-10-14T20:50:00.000Z";
  x.monitorRows.push({ id: "us10y-breakeven", asOf: "2026-10-14", last: 2.35,
    sourceName: "Federal Reserve Economic Data", sourceUrl: "https://fred.stlouisfed.org/series/T10YIE" });
  assert.equal(assessRatesSourceIntegrity(x).requiredRateInputs.diagnostics[0].state, "DOWNSTREAM_LOSS");
});

test("missing required source with no monitor observation remains a source warning, not a fabricated regression", () => {
  const x = input();
  x.dossierCoveragePresent = 4;
  x.dossierRequiredRateMissing = ["Effective fed funds"];
  const result = assessRatesSourceIntegrity(x);
  assert.equal(result.requiredRateInputs.diagnostics[0].state, "UPSTREAM_UNAVAILABLE");
  assert.equal(result.operationalStatus, "WATCH");
});

test("malformed incomplete rate coverage without named missing fields fails closed", () => {
  const x = input();
  x.dossierCoveragePresent = 4;
  const result = assessRatesSourceIntegrity(x);
  assert.ok(result.alerts.some((x) => x.code === "REQUIRED_RATE_COVERAGE_SCHEMA_INCONSISTENT"));
  assert.equal(result.operationalStatus, "ACTION_REQUIRED");
});
