import type { MarketMonitorRow } from "./market-monitor.ts";

export type TrendWindow = "30D" | "90D" | "MAX";
export type TrendPoint = { time: number; close: number };
export type MarketTrend = {
  points: TrendPoint[];
  sourceDate: string | null;
  stale: boolean;
  missing: boolean;
  coverageStart: string | null;
  coverageEnd: string | null;
  min: number | null;
  max: number | null;
  netChange: number | null;
  netChangeUnit: "bp" | "%" | "points";
  segments: TrendPoint[][];
};

function yyyyMmDd(time: number) {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

/** Preserve the existing publisher grain. Never interpolate missing sessions,
 * mistake monthly readings for daily momentum, or show future-dated points. */
export function marketTrend(
  row: Pick<MarketMonitorRow, "points" | "frequency" | "type">,
  window: TrendWindow,
  now: Date = new Date(),
): MarketTrend {
  const nowSeconds = now.getTime() / 1000;
  const unique = new Map<number, number>();
  for (const point of row.points) {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.close)
      || point.time <= 0 || point.time > nowSeconds) continue;
    // A repeated observation date may be revised; retain the last occurrence.
    const day = Math.floor(point.time / 86400) * 86400;
    unique.set(day, point.close);
  }
  const all = [...unique].map(([time, close]) => ({ time, close }))
    .sort((a, b) => a.time - b.time).slice(-64);
  const limit = window === "30D" ? nowSeconds - 30 * 86400
    : window === "90D" ? nowSeconds - 90 * 86400 : -Infinity;
  const points = all.filter(item => item.time >= limit);
  const first = points[0], last = points.at(-1);
  const stale = !all.length || (nowSeconds - all[all.length - 1].time)
    > (row.frequency === "monthly" ? 70 : 8) * 86400;
  const segments: TrendPoint[][] = [];
  const maxGap = (row.frequency === "monthly" ? 70 : 8) * 86400;
  for (const point of points) {
    const previous = segments.at(-1)?.at(-1);
    if (!previous || point.time - previous.time > maxGap) segments.push([point]);
    else segments[segments.length - 1].push(point);
  }
  const netChange = first && last && points.length >= 2
    ? row.type === "Rates" || row.type === "Credit / Risk"
      ? (last.close - first.close) * 100
      : first.close !== 0 ? (last.close / first.close - 1) * 100 : null
    : null;
  return {
    points, sourceDate: all.length ? yyyyMmDd(all[all.length - 1].time) : null,
    stale, missing: points.length < 2,
    coverageStart: first ? yyyyMmDd(first.time) : null,
    coverageEnd: last ? yyyyMmDd(last.time) : null,
    min: points.length ? Math.min(...points.map(p => p.close)) : null,
    max: points.length ? Math.max(...points.map(p => p.close)) : null,
    netChange,
    netChangeUnit: row.type === "Rates" || row.type === "Credit / Risk" ? "bp" : "%",
    segments,
  };
}
