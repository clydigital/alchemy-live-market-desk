import type { EconEvent, EconMetric } from "./bluebelly-us-econ-stat-watch.ts";

/**
 * Read-only event interpretation. The official BEA actual and a separately
 * timestamped, pre-release vendor consensus must BOTH be present. No
 * creator narrative, private chart, ETF proxy or press-reported FedWatch odds
 * can enter this calculation. No canonical Regime or Story writes occur here.
 */
export type PceDecisionStatus =
  | "PRE_RELEASE" | "AWAITING_VERIFIED_ACTUAL" | "SOURCE_CONFLICT"
  | "CONSENSUS_UNVERIFIED" | "AWAITING_MARKET_CONFIRMATION"
  | "MIXED" | "USD_BEAR_CONDITIONAL" | "USD_BULL_CONDITIONAL";

export type PceMetricKey =
  | "pce_headline_mom" | "pce_headline_yoy"
  | "pce_core_mom" | "pce_core_yoy";

export type PceSurprise = {
  key: PceMetricKey;
  actual: number;
  forecast: number;
  surprisePercentagePoints: number;
  forecastCapturedAt: string;
  forecastSource: string;
  forecastUrl: string;
};

/** Market windows must be directly observed. Daily Treasury/FRED series and
 * reported FedWatch snapshots are NOT valid event-time observations. */
export type PceMarketObservation = {
  instrument: "DXY" | "US02Y";
  startAt: string;
  endAt: string;
  change: number;
  unit: "%" | "bp";
  sourceUrl: string;
  provenance: "DIRECT_INTRADAY";
};
export type PceDecision = {
  eventId: string;
  referencePeriod: string | null;
  releaseAt: string;
  status: PceDecisionStatus;
  coreSurprisePp: number | null;
  metricSurprises: PceSurprise[];
  missing: string[];
  explanation: string;
  strongestCountercase: string;
  nextTest: string;
  researchOnly: true;
  policyRateFeed: "NOT_INTEGRATED";
};

const KEYS: readonly PceMetricKey[] = [
  "pce_headline_mom", "pce_headline_yoy", "pce_core_mom", "pce_core_yoy",
] as const;
const EPS = 0.00005;
const FIVE_MINUTES = 5 * 60_000;
const TWO_HOURS = 2 * 3_600_000;

function validUrl(input: string | null | undefined): boolean {
  if (!input) return false;
  try {
    const value = new URL(input);
    return value.protocol === "https:" && !!value.hostname &&
      !value.username && !value.password;
  } catch { return false; }
}
function actualMetric(metric: EconMetric | undefined): metric is EconMetric {
  return !!metric && metric.unit === "%" && metric.actual !== null &&
    Number.isFinite(metric.actual) && Math.abs(metric.actual) <= 20;
}
function forecastMetric(metric: EconMetric | undefined, releaseMs: number): metric is EconMetric {
  if (!actualMetric(metric) || metric.forecast === null ||
    !Number.isFinite(metric.forecast) || Math.abs(metric.forecast) > 20 ||
    !metric.forecastSource || !validUrl(metric.forecastUrl)) return false;
  const capture = Date.parse(metric.forecastCapturedAt ?? "");
  return Number.isFinite(capture) && capture <= releaseMs - FIVE_MINUTES;
}
function validMarketPair(
  rows: readonly PceMarketObservation[] | undefined,
  releaseMs: number, nowMs: number,
): { dxy: PceMarketObservation; us2y: PceMarketObservation } | null {
  if (!rows || rows.length !== 2) return null;
  const dxy = rows.find(row => row.instrument === "DXY");
  const us2y = rows.find(row => row.instrument === "US02Y");
  if (!dxy || !us2y || dxy.unit !== "%" || us2y.unit !== "bp") return null;
  for (const row of [dxy, us2y]) {
    const start = Date.parse(row.startAt), end = Date.parse(row.endAt);
    if (row.provenance !== "DIRECT_INTRADAY" || !validUrl(row.sourceUrl) ||
      !Number.isFinite(row.change) || !Number.isFinite(start) || !Number.isFinite(end) ||
      start < releaseMs - FIVE_MINUTES || start > releaseMs ||
      end <= releaseMs || end > releaseMs + TWO_HOURS || end > nowMs) return null;
  }
  // A 30-minute currency move must not be paired with a two-hour Treasury move.
  if (Math.abs(Date.parse(dxy.startAt) - Date.parse(us2y.startAt)) > FIVE_MINUTES ||
      Math.abs(Date.parse(dxy.endAt) - Date.parse(us2y.endAt)) > FIVE_MINUTES) return null;
  return { dxy, us2y };
}

export function assessPceEvent(
  event: EconEvent, now: Date,
  market?: readonly PceMarketObservation[],
): PceDecision | null {
  if (event.family !== "PCE") return null;
  const nowMs = now.getTime(), releaseMs = Date.parse(event.releaseAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(releaseMs)) return null;
  const base: Omit<PceDecision, "status" | "explanation" | "strongestCountercase" | "nextTest"> = {
    eventId: event.id,
    referencePeriod: event.referencePeriod,
    releaseAt: event.releaseAt,
    coreSurprisePp: null,
    metricSurprises: [],
    missing: [],
    researchOnly: true,
    policyRateFeed: "NOT_INTEGRATED",
  };
  const result = (
    status: PceDecisionStatus, explanation: string,
    strongestCountercase: string, nextTest: string,
    update: Partial<PceDecision> = {},
  ): PceDecision => ({ ...base, status, explanation, strongestCountercase, nextTest, ...update });

  if (nowMs < releaseMs || event.status === "SCHEDULED" && nowMs < releaseMs) {
    return result("PRE_RELEASE",
      "The publisher's release is scheduled; a forecast is not an actual.",
      "Forecasts can be revised before publication.",
      "Lock each metric's vendor consensus at least five minutes before the release.");
  }
  if (event.status === "SOURCE_CONFLICT") {
    return result("SOURCE_CONFLICT",
      "The government release and stored metric records disagree.",
      "A partial or misdated ingestion must not become a directional surprise.",
      "Reconcile the exact BEA reference period and source receipts.");
  }
  if (event.status !== "VERIFIED_ACTUAL") {
    return result("AWAITING_VERIFIED_ACTUAL",
      "The scheduled time has passed, but all four official BEA PCE actuals have not been verified.",
      "The previous month's release must not be substituted for this period.",
      "Wait for the original BEA release and complete source-matched metric ingestion.");
  }
  const perMetric = new Map(event.metrics.map(metric => [metric.key, metric]));
  const missingActual = KEYS.filter(key => !actualMetric(perMetric.get(key)));
  if (missingActual.length) {
    return result("AWAITING_VERIFIED_ACTUAL",
      "At least one official PCE component is missing.",
      "A partially populated release can give a misleading inflation picture.",
      "Complete and reconcile four original BEA metrics.",
      { missing: missingActual });
  }
  const missingForecast = KEYS.filter(key => !forecastMetric(perMetric.get(key), releaseMs));
  if (missingForecast.length) {
    return result("CONSENSUS_UNVERIFIED",
      "BEA actuals exist, but one or more independently sourced, frozen pre-release consensus values are missing.",
      "Lower inflation than the prior month is not necessarily a downside surprise.",
      "Capture four named-vendor consensus vintages with independent URLs; never backfill after release.",
      { missing: missingForecast });
  }
  const surprises: PceSurprise[] = KEYS.map(key => {
    const m = perMetric.get(key)!;
    return {
      key, actual: m.actual!, forecast: m.forecast!,
      surprisePercentagePoints: Number((m.actual! - m.forecast!).toFixed(4)),
      forecastCapturedAt: m.forecastCapturedAt!,
      forecastSource: m.forecastSource!, forecastUrl: m.forecastUrl!,
    };
  });
  const core = surprises.find(row => row.key === "pce_core_mom")!;
  const shared = { metricSurprises: surprises, coreSurprisePp: core.surprisePercentagePoints };
  const pair = validMarketPair(market, releaseMs, nowMs);
  if (!pair) {
    return result("AWAITING_MARKET_CONFIRMATION",
      "Official PCE surprises can be calculated; a comparable, direct intraday DXY and US 2Y reaction is unavailable.",
      "Soft inflation may still coincide with dollar strength from safe-haven demand or relative rate advantages.",
      "Observe directly sourced matched DXY/US02Y windows, then 4H/Daily technical acceptance and credit/breadth.",
      shared);
  }
  const soft = core.surprisePercentagePoints < -EPS;
  const hot = core.surprisePercentagePoints > EPS;
  if (soft && pair.dxy.change < 0 && pair.us2y.change < 0) {
    return result("USD_BEAR_CONDITIONAL",
      "Core PCE missed consensus and matched DXY / 2Y observations declined.",
      "A brief downside reaction does not establish a sustained dollar downtrend or broad risk-on regime.",
      "Confirm an independently measured DXY 4H/Daily band failure, credit and multi-session breadth.",
      shared);
  }
  if (hot && pair.dxy.change > 0 && pair.us2y.change > 0) {
    return result("USD_BULL_CONDITIONAL",
      "Core PCE exceeded consensus and matched DXY / 2Y observations rose.",
      "Relative FX rates, positioning and revisions can still reverse the initial price move.",
      "Check price acceptance and subsequent comparable rate/FX sessions.",
      shared);
  }
  return result("MIXED",
    "PCE surprise and/or the matched USD/yield response do not jointly confirm a simple directional interpretation.",
    "Growth shocks, revisions, relative rate differentials and positioning can dominate the headline result.",
    "Investigate revisions, spending, relative rates, credit spreads and subsequent 4H/Daily confirmation.",
    shared);
}
