import type { BreadthSnapshot, MarketData, MarketSeries, PricePoint } from "@/lib/market";

export type AccuracyCheckStatus = "pass" | "warning" | "fail";

export type AccuracyCheck = {
  id: string;
  category: "freshness" | "completeness" | "validity" | "consistency";
  label: string;
  status: AccuracyCheckStatus;
  detail: string;
  action: string;
};

export type AccuracyReport = {
  checkedAt: string;
  status: AccuracyCheckStatus;
  score: number;
  updateGate: "open" | "review" | "blocked";
  summary: string;
  checks: AccuracyCheck[];
  counts: Record<AccuracyCheckStatus, number>;
};

function check(
  id: string,
  category: AccuracyCheck["category"],
  label: string,
  status: AccuracyCheckStatus,
  detail: string,
  action: string,
): AccuracyCheck {
  return { id, category, label, status, detail, action };
}

function pctChange(points: PricePoint[], sessions: number) {
  if (points.length <= sessions) return null;
  const last = points.at(-1)?.close;
  const prior = points.at(-(sessions + 1))?.close;
  if (typeof last !== "number" || typeof prior !== "number" || prior === 0) return null;
  return ((last / prior) - 1) * 100;
}

function near(left: number | null, right: number | null, tolerance = 0.0001) {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= tolerance;
}

function pulseFor(series: MarketSeries[], breadth: BreadthSnapshot, sessions: 5 | 21) {
  const moves = ["^GSPC", "RSP", "SOXX"].map((symbol) => {
    const item = series.find((entry) => entry.symbol === symbol);
    return sessions === 5 ? item?.change5d : item?.change21d;
  }).filter((value): value is number => typeof value === "number");
  const averageMove = moves.length ? moves.reduce((sum, value) => sum + value, 0) / moves.length : 0;
  const prior = sessions === 5 ? breadth.weekAgo : breadth.monthAgo;
  const breadthDelta = breadth.current.above50 - prior.above50;
  const highLow = breadth.current.newHighs20 - breadth.current.newLows20;
  return Math.max(0, Math.min(100, Math.round(50 + averageMove * 3 + (breadth.current.above50 - 50) * 0.35 + breadthDelta * 0.7 + highLow * 0.15)));
}

function breadthChecks(breadth: BreadthSnapshot[]) {
  const checks: AccuracyCheck[] = [];
  const coverage = breadth.map((item) => item.targetSize ? item.sampleSize / item.targetSize : 0);
  const weakest = coverage.length ? Math.min(...coverage) : 0;
  const coverageStatus: AccuracyCheckStatus = weakest >= 0.9 ? "pass" : weakest >= 0.7 ? "warning" : "fail";
  checks.push(check(
    "breadth-coverage",
    "completeness",
    "Breadth universe coverage",
    coverageStatus,
    breadth.length ? breadth.map((item) => `${item.label}: ${item.sampleSize}/${item.targetSize}`).join("; ") : "No breadth snapshots were produced.",
    coverageStatus === "pass" ? "No action required." : "Repair missing Nasdaq histories before using breadth in story scoring.",
  ));

  const datesValid = breadth.length > 0 && breadth.every((item) => {
    const dates = [item.current.asOf, item.weekAgo.asOf, item.monthAgo.asOf];
    if (dates.some((date) => !date)) return false;
    return dates[0]! > dates[1]! && dates[1]! > dates[2]!;
  });
  checks.push(check(
    "breadth-session-alignment",
    "consistency",
    "Shared breadth sessions",
    datesValid ? "pass" : "fail",
    datesValid
      ? breadth.map((item) => `${item.label}: ${item.current.asOf} / ${item.weekAgo.asOf} / ${item.monthAgo.asOf}`).join("; ")
      : "Current, five-session and 21-session breadth dates are missing or not ordered.",
    datesValid ? "No action required." : "Block the update and rebuild all breadth frames on shared market dates.",
  ));

  const denominatorValid = breadth.length > 0 && breadth.every((item) => [item.current, item.weekAgo, item.monthAgo].every((frame) => frame.sampleSize === item.sampleSize));
  checks.push(check(
    "breadth-denominators",
    "consistency",
    "Stable breadth denominators",
    denominatorValid ? "pass" : "fail",
    denominatorValid ? "Current, weekly and monthly frames use the same eligible names." : "At least one comparison frame uses a different denominator.",
    denominatorValid ? "No action required." : "Do not compare the frames until the eligible universe is held constant.",
  ));

  const valuesValid = breadth.length > 0 && breadth.every((item) => [item.current, item.weekAgo, item.monthAgo].every((frame) => {
    const percentages = [frame.above20, frame.above50, frame.above200];
    return percentages.every((value) => Number.isInteger(value) && value >= 0 && value <= 100)
      && frame.newHighs20 >= 0 && frame.newHighs20 <= frame.sampleSize
      && frame.newLows20 >= 0 && frame.newLows20 <= frame.sampleSize;
  }));
  checks.push(check(
    "breadth-domain-rules",
    "validity",
    "Breadth value ranges",
    valuesValid ? "pass" : "fail",
    valuesValid ? "Percentages are within 0-100 and high/low counts fit the sample." : "A breadth percentage or count is outside its permitted range.",
    valuesValid ? "No action required." : "Block publication and inspect the affected frame calculation.",
  ));
  return checks;
}

function seriesChecks(market: MarketData) {
  const checks: AccuracyCheck[] = [];
  const populated = market.series.filter((item) => item.points.length >= 22);
  const populatedRatio = market.series.length ? populated.length / market.series.length : 0;
  const populationStatus: AccuracyCheckStatus = populatedRatio >= 0.9 ? "pass" : populatedRatio >= 0.75 ? "warning" : "fail";
  checks.push(check(
    "series-completeness",
    "completeness",
    "Market-series observations",
    populationStatus,
    `${populated.length}/${market.series.length} series contain at least 22 valid sessions.`,
    populationStatus === "pass" ? "No action required." : "Review failed upstream requests before refreshing analysis.",
  ));

  const malformed = market.series.filter((item) => {
    const times = item.points.map((point) => point.time);
    return item.points.some((point) => !Number.isFinite(point.time) || !Number.isFinite(point.close))
      || times.some((time, index) => index > 0 && time <= times[index - 1]);
  });
  checks.push(check(
    "series-ordering",
    "validity",
    "Observation ordering and uniqueness",
    malformed.length ? "fail" : "pass",
    malformed.length ? `Invalid or duplicate timestamps: ${malformed.map((item) => item.symbol).join(", ")}.` : "All populated series are finite, unique and strictly chronological.",
    malformed.length ? "Block the update and deduplicate or reorder the named histories." : "No action required.",
  ));

  const mismatched = market.series.filter((item) => {
    const last = item.points.at(-1)?.close ?? null;
    return !near(item.last, last) || !near(item.change5d, pctChange(item.points, 5)) || !near(item.change21d, pctChange(item.points, 21));
  });
  checks.push(check(
    "series-reconciliation",
    "consistency",
    "Displayed-market reconciliation",
    mismatched.length ? "fail" : "pass",
    mismatched.length ? `Last price or change does not reconcile for ${mismatched.map((item) => item.symbol).join(", ")}.` : "Last values and five/21-session changes reproduce from the source observations.",
    mismatched.length ? "Block the update and recompute the derived fields." : "No action required.",
  ));

  const official = market.series.filter((item) => item.sourceName.startsWith("Nasdaq") && item.points.length);
  const latest = official.length ? Math.max(...official.map((item) => item.points.at(-1)!.time)) : null;
  const checkedTime = Date.parse(market.updatedAt);
  const lagDays = latest === null || !Number.isFinite(checkedTime) ? null : Math.floor((checkedTime - latest * 1000) / 86_400_000);
  const freshnessStatus: AccuracyCheckStatus = lagDays === null || lagDays < 0 || lagDays > 5 ? "fail" : lagDays > 3 ? "warning" : "pass";
  checks.push(check(
    "market-freshness",
    "freshness",
    "Latest official market session",
    freshnessStatus,
    lagDays === null ? "A latest Nasdaq session could not be established." : `Latest Nasdaq observation is ${lagDays} calendar day${lagDays === 1 ? "" : "s"} behind the check time.`,
    freshnessStatus === "pass" ? "No action required." : freshnessStatus === "warning" ? "Confirm a weekend or market holiday before publishing." : "Block the update and restore the official market feed.",
  ));

  const invalidSources = market.series.filter((item) => !item.sourceName || !/^https:\/\//.test(item.sourceUrl));
  checks.push(check(
    "source-lineage",
    "validity",
    "Source lineage",
    invalidSources.length ? "fail" : "pass",
    invalidSources.length ? `Missing official source metadata: ${invalidSources.map((item) => item.symbol).join(", ")}.` : "Every market series names its source and provides an HTTPS source link.",
    invalidSources.length ? "Block publication until source lineage is restored." : "No action required.",
  ));
  return checks;
}

export function runAccuracyCheck(market: MarketData): AccuracyReport {
  const checks = [...breadthChecks(market.breadth), ...seriesChecks(market)];
  const mainBreadth = market.breadth[0];
  const pulseValid = Boolean(mainBreadth) && market.pulseWeek === pulseFor(market.series, mainBreadth, 5) && market.pulseMonth === pulseFor(market.series, mainBreadth, 21);
  checks.push(check(
    "pulse-reconciliation",
    "consistency",
    "Market-pulse reproduction",
    pulseValid ? "pass" : "fail",
    pulseValid ? `Weekly score ${market.pulseWeek}; monthly score ${market.pulseMonth}. Both reproduce from market moves and breadth.` : "One or both pulse scores do not reproduce from their inputs.",
    pulseValid ? "No action required." : "Block downstream story scoring until the pulse calculation reconciles.",
  ));

  const counts = checks.reduce<Record<AccuracyCheckStatus, number>>((result, item) => {
    result[item.status] += 1;
    return result;
  }, { pass: 0, warning: 0, fail: 0 });
  const status: AccuracyCheckStatus = counts.fail ? "fail" : counts.warning ? "warning" : "pass";
  const score = Math.round(checks.reduce((total, item) => total + (item.status === "pass" ? 100 : item.status === "warning" ? 60 : 0), 0) / checks.length);
  const updateGate = status === "fail" ? "blocked" : status === "warning" ? "review" : "open";
  const summary = status === "pass"
    ? "All deterministic checks passed. The data update may proceed to editorial logic."
    : status === "warning"
      ? "The update needs a human freshness or coverage review before story logic runs."
      : "The update is blocked. At least one source, calculation or reconciliation check failed.";
  return { checkedAt: new Date().toISOString(), status, score, updateGate, summary, checks, counts };
}
