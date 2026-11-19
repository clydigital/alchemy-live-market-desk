import { expectedHomeEtfSession } from "./bluebelly-home-etf-history.ts";
import { scheduledUsEquityCloseHourET } from "./bluebelly-us-equity-trading-calendar.ts";

type Point = { time: number; close: number };
type Series = { id: string; points: readonly Point[]; sourceName: string; sourceUrl: string; frequency: "daily" | "monthly" };
const Z95 = 1.6448536269514722;
const Z99 = 2.3263478740408408;
const TRADING_DAYS = 252;
export const impliedVar = (vol: number, z = Z95) => vol / Math.sqrt(TRADING_DAYS) * z;

function completedPoints(series: Series | null | undefined, expected: string | null) {
  if (!series || series.frequency !== "daily" || !expected) return [];
  const byDate = new Map<string, number>();
  for (const p of series.points) {
    if (!Number.isFinite(p.time) || !Number.isFinite(p.close) || p.close <= 0) continue;
    const date = new Date(p.time * 1000);
    if (!Number.isFinite(+date)) continue;
    const day = date.toISOString().slice(0, 10);
    if (day > expected || scheduledUsEquityCloseHourET(day) === null) continue;
    if (byDate.has(day) && byDate.get(day) !== p.close) return [];
    byDate.set(day, p.close);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
}

function consecutive(points: {day: string}[], count: number) {
  if (points.length < count) return false;
  const window = points.slice(-count);
  const days = new Set(window.map(p => p.day));
  for (let t = Date.parse(window[0].day); t <= Date.parse(window.at(-1)!.day); t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    if (scheduledUsEquityCloseHourET(day) !== null && !days.has(day)) return false;
  }
  return true;
}

function realised20(series: Series | null | undefined, expected: string | null, asOf: string | null) {
  const points = completedPoints(series, expected).filter(p => asOf && p.day <= asOf);
  const day = points.at(-1)?.day;
  if (!day || day !== asOf || !consecutive(points, 21)) return null;
  const closes = points.slice(-21).map(p => p.value);
  const returns = closes.slice(1).map((p, i) => Math.log(p / closes[i]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return { var95: Z95 * 100 * Math.sqrt(variance), sourceName: series!.sourceName, sourceUrl: series!.sourceUrl, day };
}

export type InstitutionalRiskRow = {
  label: string; symbol: string; asOf: string | null; expected: string | null;
  state: "current" | "behind" | "unavailable"; sourceUrl: string;
  volatility: number | null; volatilityChange1d: number | null;
  var95: number | null; var99: number | null; change1d: number | null; change5d: number | null;
  percentile: number | null; capacity5d: number | null;
  realised: ReturnType<typeof realised20>; realisedLabel: string;
};

// Editorial bands, not regulatory or institution-specific VaR limits.
export function interpretInstitutionalRisk(row: Pick<InstitutionalRiskRow, "state" | "percentile" | "change1d" | "change5d" | "capacity5d">) {
  const rank = row.percentile;
  const level = rank === null ? "unknown" : rank >= 90 ? "extreme" : rank >= 75 ? "high" : rank < 25 ? "low" : "normal";
  const levelLabel = {unknown: "Unranked", extreme: "Extreme", high: "High", low: "Low", normal: "Normal"}[level];
  const direction = row.state !== "current" || row.change5d === null ? "unknown" : row.change5d > 1 ? "pressure" : row.change5d < -1 ? "easing" : "flat";
  const elevated = level === "high" || level === "extreme";
  const action = direction === "unknown" ? "No current positioning inference" : direction === "pressure" ? "Reduce risk / hedge pressure" : direction === "easing" ? elevated ? "Cautious re-risking possible" : "Room to rebuild exposure" : elevated ? "Maintain defensive sizing" : "Little mechanical change";
  const explanation = direction === "unknown" ? "Wait for a current close and five matched sessions. Historical readings do not establish today's pressure." : direction === "pressure" ? elevated ? "Risk is elevated and still rising. Funds near fixed risk limits may cut positions or add hedges." : "Risk is rising. Fixed-risk funds may trim exposure or hedge, even if the market has not reached stressed levels." : direction === "easing" ? elevated ? "The squeeze is easing, but risk remains historically elevated. Some funds may reduce hedges or rebuild slowly; others may wait for calmer realised volatility." : "Lower implied risk frees up theoretical exposure capacity. Risk-targeting funds may rebuild positions if their own limits and other conditions permit." : elevated ? "Risk is still elevated. Little recent change in risk does not mean selling pressure has fully cleared." : "Implied risk has changed little over five sessions. There is little mechanical reason to resize on this proxy alone.";
  const divergence = direction === "pressure" && row.change1d !== null && row.change1d < -1 ? "Latest day eased, but the five-session risk increase remains." : direction === "easing" && row.change1d !== null && row.change1d > 1 ? "Latest day rose against the five-session easing trend." : null;
  return {level, levelLabel, direction, action, explanation, divergence};
}

export function buildInstitutionalRisk(volatility: readonly (Series | null)[], market: readonly Series[], now: Date): InstitutionalRiskRow[] {
  const expected = expectedHomeEtfSession(now);
  return ([{ id: "vix", symbol: "VIX", label: "S&P 500", asset: "spx", realisedLabel: "SPX cash" },
    { id: "vxn", symbol: "VXN", label: "Nasdaq-100", asset: "ndx", realisedLabel: "QQQ proxy" }]).map(spec => {
    const source = volatility.find(row => row?.id === spec.id);
    const points = completedPoints(source, expected);
    const current = points.at(-1);
    const asOf = current?.day ?? null;
    const sourceUrl = "https://fred.stlouisfed.org/series/" + (spec.id === "vix" ? "VIXCLS" : "VXNCLS");
    const eligible = current && expected && Date.parse(expected) - Date.parse(current.day) <= 7 * 86400000;
    const state = !eligible ? "unavailable" : asOf === expected ? "current" : "behind";
    const value = eligible ? current.value : null;
    const previous = consecutive(points, 2) ? points.at(-2)!.value : null;
    const week = consecutive(points, 6) ? points.at(-6)!.value : null;
    const history = points.slice(-252);
    const relative = (prior: number | null) => value !== null && prior !== null ? 100 * (value / prior - 1) : null;
    return {
      label: spec.label, symbol: spec.symbol, asOf, expected, state, sourceUrl,
      volatility: value, volatilityChange1d: value !== null && previous !== null ? value - previous : null,
      var95: value === null ? null : impliedVar(value), var99: value === null ? null : impliedVar(value, Z99),
      change1d: relative(previous), change5d: relative(week),
      // Exactly 252 genuine source observations. Older years may predate our
      // verified exchange holiday calendar; do not mistake holidays for gaps.
      percentile: value !== null && history.length === 252 ? 100 * history.filter(p => p.value <= value).length / history.length : null,
      capacity5d: value !== null && week !== null ? 100 * (week / value - 1) : null,
      realised: eligible ? realised20(market.find(row => row.id === spec.asset), expected, asOf) : null,
      realisedLabel: spec.realisedLabel,
    };
  });
}
