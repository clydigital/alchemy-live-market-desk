import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRateCurveDiagnostic,
  RATE_CURVE_DIAGNOSTIC_VERSION,
} from "../lib/dossier-v2/rate-curve-diagnostic.ts";
import type { ObservedEvidence } from "../lib/dossier-v2/input-packet.ts";

const AS_OF = "2026-10-03T02:00:00.000Z";

function monitor(id: string, last: number, prior: number): ObservedEvidence {
  const change5dPct = ((last / prior) - 1) * 100;
  return {
    evidence_id: `market-monitor:${id}:2026-10-03`,
    epistemic_label: "OBSERVED",
    claim_or_fact: `${id} ${last}`,
    category: "Rates",
    source_type: "MARKET_DATA",
    available_at: AS_OF,
    occurrence_time: AS_OF,
    metrics: {
      last,
      change_5d_pct: change5dPct,
      frequency: "daily",
    },
    provenance: [],
  };
}

function direct30y(level: number): ObservedEvidence {
  return {
    evidence_id: "verified-macro:us30y:2026-10-03",
    epistemic_label: "OBSERVED",
    claim_or_fact: `Verified US 30Y ${level}%`,
    category: "Rates",
    source_type: "VERIFIED_MACRO_DATA",
    available_at: AS_OF,
    occurrence_time: AS_OF,
    metrics: {
      signal_kind: "market_reaction",
      signal_context: "us30y",
      observed_value: level,
      measurement_unit: "percent",
    },
    provenance: [],
  };
}

function curve(values: {
  y2: [number, number];
  y5?: [number, number];
  y10: [number, number];
  y20?: [number, number];
  y30?: [number, number];
}) {
  const evidence: ObservedEvidence[] = [
    monitor("us2y", values.y2[0], values.y2[1]),
    ...(values.y5 ? [monitor("us5y-fred", values.y5[0], values.y5[1])] : []),
    monitor("us10y", values.y10[0], values.y10[1]),
    ...(values.y20 ? [monitor("us20y-fred", values.y20[0], values.y20[1])] : []),
    ...(values.y30 ? [monitor("us30y-fred", values.y30[0], values.y30[1])] : []),
  ];
  return buildRateCurveDiagnostic(evidence, AS_OF);
}

test("full Treasury curve computes all maturities, spreads and positive shape", () => {
  const result = curve({
    y2: [4.80, 4.85],
    y5: [4.95, 5.00],
    y10: [5.20, 5.25],
    y20: [5.55, 5.60],
    y30: [5.60, 5.65],
  });

  assert.equal(result.contractVersion, RATE_CURVE_DIAGNOSTIC_VERSION);
  assert.equal(result.coverage.present, 5);
  assert.equal(result.shape, "POSITIVE");
  assert.equal(result.spreads.find((item) => item.key === "2s10s")?.bps, 40);
  assert.equal(result.spreads.find((item) => item.key === "2s30s")?.bps, 80);
  assert.deepEqual(result.coverage.missing, []);
});

test("bull steepener means yields fall while the front end falls more", () => {
  const result = curve({
    y2: [4.70, 4.90],
    y5: [4.85, 5.00],
    y10: [5.10, 5.20],
    y20: [5.45, 5.52],
    y30: [5.50, 5.56],
  });

  assert.equal(result.moveClass, "BULL_STEEPENER");
  assert.equal(result.frontEndDirection, "DOWN");
  assert.equal(result.longEndDirection, "DOWN");
});

test("bull flattener means the long end falls more than the front end", () => {
  const result = curve({
    y2: [4.85, 4.90],
    y5: [4.90, 5.00],
    y10: [5.00, 5.20],
    y20: [5.30, 5.52],
    y30: [5.32, 5.56],
  });

  assert.equal(result.moveClass, "BULL_FLATTENER");
});

test("bear steepener means the long end rises more than the front end", () => {
  const result = curve({
    y2: [4.95, 4.90],
    y5: [5.08, 5.00],
    y10: [5.35, 5.20],
    y20: [5.70, 5.52],
    y30: [5.76, 5.56],
  });

  assert.equal(result.moveClass, "BEAR_STEEPENER");
});

test("bear flattener means the front end rises more than the long end", () => {
  const result = curve({
    y2: [5.10, 4.90],
    y5: [5.12, 5.00],
    y10: [5.25, 5.20],
    y20: [5.57, 5.52],
    y30: [5.61, 5.56],
  });

  assert.equal(result.moveClass, "BEAR_FLATTENER");
});

test("opposite front-end and long-end moves classify divergent steepening", () => {
  const result = curve({
    y2: [4.72, 4.90],
    y5: [4.90, 5.00],
    y10: [5.26, 5.20],
    y20: [5.60, 5.55],
    y30: [5.66, 5.60],
  });

  assert.equal(result.moveClass, "DIVERGENT_STEEPENING");
  assert.equal(result.separationState, "FRONT_END_EASING_LONG_END_STICKY");
  assert.equal(result.frontEndDirection, "DOWN");
  assert.equal(result.longEndDirection, "UP");
});

test("front-end easing with nearly flat long end is explicitly sticky", () => {
  const result = curve({
    y2: [4.72, 4.90],
    y5: [4.88, 4.98],
    y10: [5.19, 5.20],
    y20: [5.54, 5.55],
    y30: [5.59, 5.60],
  });

  assert.equal(result.separationState, "FRONT_END_EASING_LONG_END_STICKY");
});

test("missing 20Y and 30Y degrades coverage but preserves 2s10s", () => {
  const result = curve({
    y2: [4.80, 4.85],
    y5: [4.95, 5.00],
    y10: [5.20, 5.25],
  });

  assert.equal(result.coverage.present, 3);
  assert.deepEqual(result.coverage.missing, ["20Y", "30Y"]);
  assert.equal(result.spreads.find((item) => item.key === "2s10s")?.bps, 40);
  assert.equal(result.spreads.find((item) => item.key === "2s30s")?.bps, null);
  assert.notEqual(result.shape, "UNRESOLVED");
});

test("verified direct 30Y supplies the level while FRED supplies its 5D change", () => {
  const fred = monitor("us30y-fred", 5.60, 5.50);
  const result = buildRateCurveDiagnostic([
    monitor("us2y", 4.80, 4.85),
    monitor("us10y", 5.20, 5.20),
    fred,
    direct30y(5.64),
  ], AS_OF);

  const y30 = result.points.find((item) => item.maturity === "30Y");
  assert.equal(y30?.yieldPct, 5.64);
  assert.equal(y30?.change5dBp, 10);
  assert.equal(y30?.levelEvidenceRef, "verified-macro:us30y:2026-10-03");
  assert.equal(y30?.changeEvidenceRef, fred.evidence_id);
});

test("no usable curve evidence fails closed", () => {
  const result = buildRateCurveDiagnostic([], AS_OF);
  assert.equal(result.shape, "UNRESOLVED");
  assert.equal(result.moveClass, "UNRESOLVED");
  assert.equal(result.separationState, "UNRESOLVED");
  assert.equal(result.coverage.present, 0);
  assert.equal(result.evidenceRefs.length, 0);
});
