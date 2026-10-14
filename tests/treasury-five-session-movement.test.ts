import assert from "node:assert/strict";
import test from "node:test";
import { deriveMatchedNominalCurveChange, NOMINAL_CURVE_IDS } from "../lib/dossier-v2/treasury-nominal-movement.ts";
import { augmentCandidateSnapshotWithMarketMonitor, type CanonicalSnapshotResult } from "../lib/dossier-v2/canonical-snapshot.ts";
import { buildRateCurveDiagnostic } from "../lib/dossier-v2/rate-curve-diagnostic.ts";
import type { ObservedEvidence } from "../lib/dossier-v2/input-packet.ts";

const DAYS = ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14"];
const VALUES: Record<string, number[]> = {
  us2y: [4.70, 4.72, 4.75, 4.76, 4.79, 4.82],
  "us5y-fred": [4.90, 4.92, 4.94, 4.96, 4.99, 5.00],
  "us10y-fred": [5.10, 5.13, 5.15, 5.16, 5.21, 5.19],
  "us20y-fred": [5.48, 5.50, 5.52, 5.54, 5.59, 5.57],
  "us30y-fred": [5.45, 5.46, 5.48, 5.50, 5.54, 5.52],
};
function rows() {
  return NOMINAL_CURVE_IDS.map((id) => ({
    id, symbol: id, label: id, type: "Rates", last: VALUES[id][5],
    dayChange: null, change5d: null, asOf: DAYS[5], frequency: "daily" as const,
    sourceName: "U.S. Department of the Treasury", sourceUrl: "https://home.treasury.gov/",
    points: DAYS.map((day, i) => ({ time: Date.parse(day + "T00:00:00Z") / 1000, close: VALUES[id][i] })),
  }));
}

test("official matched Treasury data yields actual 5-session absolute bp moves", () => {
  const result = deriveMatchedNominalCurveChange(rows(), DAYS[5]);
  assert.ok(result);
  assert.equal(result.baselineDate, "2026-10-07");
  assert.equal(result.matchedSessions, 5);
  assert.deepEqual(result.changeBp, {
    us2y: 12, "us5y-fred": 10, "us10y-fred": 9, "us20y-fred": 9, "us30y-fred": 7,
  });
});

test("a different maturity date or missing common trading session fails closed", () => {
  const mismatched = rows();
  mismatched[2].asOf = "2026-10-13";
  assert.equal(deriveMatchedNominalCurveChange(mismatched, DAYS[5]), null);
  const missing = rows();
  missing[0].points.splice(2, 1);
  assert.equal(deriveMatchedNominalCurveChange(missing, DAYS[5]), null);
});

test("future timestamps, duplicated conflicting values and ETF proxies cannot produce bp moves", () => {
  const future = rows(); future[0].points.pop();
  assert.equal(deriveMatchedNominalCurveChange(future, DAYS[5]), null);
  const conflict = rows(); conflict[0].points.push({ ...conflict[0].points[5], close: 19 });
  assert.equal(deriveMatchedNominalCurveChange(conflict, DAYS[5]), null);
  const proxy = rows(); proxy[1].sourceName = "Proxy ETF";
  assert.equal(deriveMatchedNominalCurveChange(proxy, DAYS[5]), null);
});

test("history cannot straddle a prolonged gap while claiming 5 trading sessions", () => {
  const old = rows();
  old.forEach((row) => { row.points[0].time = Date.parse("2026-09-01T00:00:00Z") / 1000; });
  assert.equal(deriveMatchedNominalCurveChange(old, DAYS[5]), null);
});

test("Dossier snapshot and curve diagnostic preserve verified bp moves and matched dates", () => {
  const asOf = "2026-10-15T02:00:00Z";
  const base: CanonicalSnapshotResult = {
    snapshot: { observed_evidence: [] },
    diagnostics: { rows_considered: 0, observed_count: 0, lead_count: 0, catalyst_count: 0,
      skipped_future_count: 0, skipped_expired_scheduled_count: 0,
      latest_available_at: null, price_data_status: "MISSING", macro_data_status: "MISSING" },
  };
  const output = augmentCandidateSnapshotWithMarketMonitor(base, {
    updatedAt: asOf, rows: rows(), breadth: [],
  }, { asOf });
  const observations = (output.snapshot.observed_evidence ?? []) as ObservedEvidence[];
  assert.equal(observations.filter((e) => e.evidence_id.startsWith("market-monitor:us")).length, 5);
  const rate2 = observations.find((e) => e.evidence_id === "market-monitor:us2y:2026-10-14");
  assert.equal(rate2?.metrics?.change_5d_bp, 12);
  assert.equal(rate2?.metrics?.baseline_observation_date, "2026-10-07");
  assert.equal(rate2?.metrics?.measurement_interval_sessions, 5);
  const curve = buildRateCurveDiagnostic(observations, asOf);
  assert.equal(curve.coverage.present, 5);
  assert.equal(curve.frontEndChange5dBp, 12);
  assert.equal(curve.points.find((p) => p.maturity === "10Y")?.change5dBp, 9);
  assert.equal(curve.spreads.find((p) => p.key === "2s10s")?.change5dBp, -3);
  assert.equal(curve.moveClass, "PARALLEL_TIGHTENING");
  assert.doesNotMatch(curve.detail, /n\/a 5D/);
});
