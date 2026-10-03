import type { ObservedEvidence } from "./input-packet.ts";

export const RATE_CURVE_DIAGNOSTIC_VERSION = "rate-curve-diagnostic/1" as const;

export type RateCurveMaturity = "2Y" | "5Y" | "10Y" | "20Y" | "30Y";
export type RateCurveDirection = "UP" | "DOWN" | "FLAT" | "UNRESOLVED";
export type RateCurveShape = "INVERTED" | "FLAT" | "POSITIVE" | "UNRESOLVED";
export type RateCurveMoveClass =
  | "BULL_STEEPENER"
  | "BULL_FLATTENER"
  | "BEAR_STEEPENER"
  | "BEAR_FLATTENER"
  | "DIVERGENT_STEEPENING"
  | "DIVERGENT_FLATTENING"
  | "PARALLEL_EASING"
  | "PARALLEL_TIGHTENING"
  | "MIXED"
  | "UNRESOLVED";

export type RateCurveSeparationState =
  | "ALIGNED_EASING"
  | "ALIGNED_TIGHTENING"
  | "FRONT_END_EASING_LONG_END_STICKY"
  | "FRONT_END_TIGHTENING_LONG_END_RELIEF"
  | "MIXED"
  | "UNRESOLVED";

export type RateCurvePoint = {
  maturity: RateCurveMaturity;
  yieldPct: number | null;
  change5dBp: number | null;
  direction5d: RateCurveDirection;
  levelEvidenceRef: string | null;
  changeEvidenceRef: string | null;
};

export type RateCurveSpread = {
  key: "2s5s" | "2s10s" | "2s20s" | "2s30s" | "5s10s" | "5s30s" | "10s30s";
  bps: number | null;
  change5dBp: number | null;
};

export type RateCurveDiagnostic = {
  contractVersion: typeof RATE_CURVE_DIAGNOSTIC_VERSION;
  asOf: string;
  points: RateCurvePoint[];
  spreads: RateCurveSpread[];
  shape: RateCurveShape;
  moveClass: RateCurveMoveClass;
  separationState: RateCurveSeparationState;
  frontEndDirection: RateCurveDirection;
  longEndDirection: RateCurveDirection;
  frontEndChange5dBp: number | null;
  longEndAverageChange5dBp: number | null;
  detail: string;
  evidenceRefs: string[];
  coverage: {
    present: number;
    total: 5;
    missing: RateCurveMaturity[];
  };
};

function metricNumber(item: ObservedEvidence | null | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricString(item: ObservedEvidence | null | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function monitorEvidence(evidence: ObservedEvidence[], id: string) {
  return evidence
    .filter((item) => item.evidence_id.startsWith(`market-monitor:${id}:`))
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;
}

function signalContextEvidence(evidence: ObservedEvidence[], context: string) {
  return evidence
    .filter((item) => metricString(item, "signal_context")?.toLowerCase() === context.toLowerCase())
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;
}

function bpChange(item: ObservedEvidence | null | undefined) {
  const last = metricNumber(item, "last");
  const pct = metricNumber(item, "change_5d_pct");
  if (last === null || pct === null || pct <= -99.99) return null;
  const prior = last / (1 + pct / 100);
  return (last - prior) * 100;
}

function round(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function direction(changeBp: number | null, threshold = 3): RateCurveDirection {
  if (changeBp === null) return "UNRESOLVED";
  if (changeBp >= threshold) return "UP";
  if (changeBp <= -threshold) return "DOWN";
  return "FLAT";
}

function average(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function shape(spread2s10s: number | null): RateCurveShape {
  if (spread2s10s === null) return "UNRESOLVED";
  if (spread2s10s < -10) return "INVERTED";
  if (spread2s10s > 10) return "POSITIVE";
  return "FLAT";
}

function separation(
  front: number | null,
  long: number | null,
): RateCurveSeparationState {
  if (front === null || long === null) return "UNRESOLVED";
  if (front <= -5 && long <= -5) return "ALIGNED_EASING";
  if (front >= 5 && long >= 5) return "ALIGNED_TIGHTENING";
  if (front <= -5 && long > -3) return "FRONT_END_EASING_LONG_END_STICKY";
  if (front >= 5 && long < 3) return "FRONT_END_TIGHTENING_LONG_END_RELIEF";
  return "MIXED";
}

function moveClass(front: number | null, long: number | null): RateCurveMoveClass {
  if (front === null || long === null) return "UNRESOLVED";
  const spreadChange = long - front;
  const frontDirection = direction(front);
  const longDirection = direction(long);

  if (frontDirection === "DOWN" && longDirection === "UP") return "DIVERGENT_STEEPENING";
  if (frontDirection === "UP" && longDirection === "DOWN") return "DIVERGENT_FLATTENING";

  if (spreadChange >= 5) {
    if (frontDirection === "DOWN" && (longDirection === "DOWN" || longDirection === "FLAT")) return "BULL_STEEPENER";
    if (longDirection === "UP" && (frontDirection === "UP" || frontDirection === "FLAT")) return "BEAR_STEEPENER";
  }

  if (spreadChange <= -5) {
    if (longDirection === "DOWN" && (frontDirection === "DOWN" || frontDirection === "FLAT")) return "BULL_FLATTENER";
    if (frontDirection === "UP" && (longDirection === "UP" || longDirection === "FLAT")) return "BEAR_FLATTENER";
  }

  if (frontDirection === "DOWN" && longDirection === "DOWN") return "PARALLEL_EASING";
  if (frontDirection === "UP" && longDirection === "UP") return "PARALLEL_TIGHTENING";
  return "MIXED";
}

function formatPct(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function formatBp(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp`;
}

export function buildRateCurveDiagnostic(
  evidence: ObservedEvidence[],
  asOf: string,
): RateCurveDiagnostic {
  const us2y = monitorEvidence(evidence, "us2y");
  const us5y = monitorEvidence(evidence, "us5y-fred") ?? monitorEvidence(evidence, "us5y");
  const us10y = monitorEvidence(evidence, "us10y") ?? monitorEvidence(evidence, "us10y-fred");
  const us20y = monitorEvidence(evidence, "us20y-fred");
  const us30yDirect = signalContextEvidence(evidence, "us30y");
  const us30yFred = monitorEvidence(evidence, "us30y-fred");

  const point = (
    maturity: RateCurveMaturity,
    levelEvidence: ObservedEvidence | null,
    changeEvidence: ObservedEvidence | null = levelEvidence,
    observedMetric = false,
  ): RateCurvePoint => {
    const yieldPct = observedMetric
      ? metricNumber(levelEvidence, "observed_value") ?? metricNumber(levelEvidence, "last")
      : metricNumber(levelEvidence, "last");
    const change5dBp = bpChange(changeEvidence);
    return {
      maturity,
      yieldPct: round(yieldPct, 3),
      change5dBp: round(change5dBp),
      direction5d: direction(change5dBp),
      levelEvidenceRef: levelEvidence?.evidence_id ?? null,
      changeEvidenceRef: changeEvidence?.evidence_id ?? null,
    };
  };

  const points: RateCurvePoint[] = [
    point("2Y", us2y),
    point("5Y", us5y),
    point("10Y", us10y),
    point("20Y", us20y),
    point("30Y", us30yDirect ?? us30yFred, us30yDirect && bpChange(us30yDirect) !== null ? us30yDirect : us30yFred, Boolean(us30yDirect)),
  ];

  const byMaturity = new Map(points.map((item) => [item.maturity, item]));
  const spread = (
    key: RateCurveSpread["key"],
    shortMaturity: RateCurveMaturity,
    longMaturity: RateCurveMaturity,
  ): RateCurveSpread => {
    const short = byMaturity.get(shortMaturity)!;
    const long = byMaturity.get(longMaturity)!;
    return {
      key,
      bps: short.yieldPct !== null && long.yieldPct !== null
        ? round((long.yieldPct - short.yieldPct) * 100)
        : null,
      change5dBp: short.change5dBp !== null && long.change5dBp !== null
        ? round(long.change5dBp - short.change5dBp)
        : null,
    };
  };

  const spreads: RateCurveSpread[] = [
    spread("2s5s", "2Y", "5Y"),
    spread("2s10s", "2Y", "10Y"),
    spread("2s20s", "2Y", "20Y"),
    spread("2s30s", "2Y", "30Y"),
    spread("5s10s", "5Y", "10Y"),
    spread("5s30s", "5Y", "30Y"),
    spread("10s30s", "10Y", "30Y"),
  ];

  const frontEndChange = byMaturity.get("2Y")?.change5dBp ?? null;
  const longEndAverage = average([
    byMaturity.get("10Y")?.change5dBp ?? null,
    byMaturity.get("20Y")?.change5dBp ?? null,
    byMaturity.get("30Y")?.change5dBp ?? null,
  ]);
  const spread2s10s = spreads.find((item) => item.key === "2s10s")?.bps ?? null;
  const curveShape = shape(spread2s10s);
  const curveMove = moveClass(frontEndChange, longEndAverage);
  const separationState = separation(frontEndChange, longEndAverage);
  const missing = points.filter((item) => item.yieldPct === null).map((item) => item.maturity);
  const evidenceRefs = [...new Set(points.flatMap((item) => [
    item.levelEvidenceRef,
    item.changeEvidenceRef,
  ]).filter((value): value is string => Boolean(value)))];

  const pointDetail = points
    .filter((item) => item.yieldPct !== null)
    .map((item) => `${item.maturity} ${formatPct(item.yieldPct)} (${formatBp(item.change5dBp)} 5D)`)
    .join(" · ");
  const spreadDetail = spreads
    .filter((item) => item.key === "2s10s" || item.key === "2s30s")
    .map((item) => `${item.key} ${formatBp(item.bps)}${item.change5dBp === null ? "" : ` (${formatBp(item.change5dBp)} 5D)`}`)
    .join(" · ");

  return {
    contractVersion: RATE_CURVE_DIAGNOSTIC_VERSION,
    asOf,
    points,
    spreads,
    shape: curveShape,
    moveClass: curveMove,
    separationState,
    frontEndDirection: direction(frontEndChange),
    longEndDirection: direction(longEndAverage),
    frontEndChange5dBp: round(frontEndChange),
    longEndAverageChange5dBp: round(longEndAverage),
    detail: [
      pointDetail || "No current Treasury curve levels are available.",
      spreadDetail,
      `Curve: ${curveShape.replaceAll("_", " ").toLowerCase()} · move: ${curveMove.replaceAll("_", " ").toLowerCase()} · path: ${separationState.replaceAll("_", " ").toLowerCase()}.`,
    ].filter(Boolean).join(" "),
    evidenceRefs,
    coverage: {
      present: points.length - missing.length,
      total: 5,
      missing,
    },
  };
}
