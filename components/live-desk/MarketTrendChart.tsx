"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketMonitorRow } from "@/lib/market-monitor";
import { marketTrend, type TrendWindow } from "@/lib/market-trend-series";
import styles from "./market-trend-chart.module.css";

type Props = {
  rows: MarketMonitorRow[];
  selectedId: string | null;
  onSelect: (value: string) => void;
  nowIso: string;
};

const WIDTH = 840, HEIGHT = 284;
const LEFT = 64, RIGHT = 16, TOP = 16, BOTTOM = 42;
const horizontal = WIDTH - LEFT - RIGHT, vertical = HEIGHT - TOP - BOTTOM;
function displayDate(seconds: number) {
  return new Date(seconds * 1000).toLocaleDateString("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short", year: "2-digit",
  });
}
function displayValue(value: number, rate: boolean) {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: rate ? 2 : 0,
    maximumFractionDigits: rate ? 3 : Math.abs(value) >= 1000 ? 1 : 3,
  }) + (rate ? "%" : "");
}
function displayChange(value: number | null, unit: string) {
  return value === null ? "Insufficient history" : (value > 0 ? "+" : "") + value.toFixed(2) + " " + unit;
}

/** Display chart only for actual dated source points already admitted to
 * MarketMonitor. A disabled/no-history state is intentional, not zero data. */
export default function MarketTrendChart({ rows, selectedId, onSelect, nowIso }: Props) {
  const [window, setWindow] = useState<TrendWindow>("MAX");
  const router = useRouter();
  // Re-fetch current source observations automatically for an open market
  // terminal. The server remains the only data collector/cache owner.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = globalThis.setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { globalThis.clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  const selected = rows.find(row => row.id === selectedId)
    ?? rows.find(row => row.id === "spx" && row.points.length >= 2)
    ?? rows.find(row => row.points.length >= 2)
    ?? rows[0] ?? null;
  const trend = selected ? marketTrend(selected, window, new Date(nowIso)) : null;
  const points = trend?.points ?? [];
  const chartReady = Boolean(trend && !trend.missing);
  const low = trend?.min ?? 0, high = trend?.max ?? 0;
  const margin = Math.max(Math.abs(high - low) * .1, Math.abs(high) * .0005, .0001);
  const min = low - margin, max = high + margin;
  const firstTime = points[0]?.time ?? 0, lastTime = points.at(-1)?.time ?? 0;
  const x = (time: number) => LEFT + (time - firstTime) / Math.max(1, lastTime - firstTime) * horizontal;
  const y = (value: number) => TOP + vertical - (value - min) / Math.max(.000001, max - min) * vertical;
  const rate = selected?.type === "Rates" || selected?.type === "Credit / Risk";
  const linePaths = trend?.segments.filter(segment => segment.length >= 2)
    .map(segment => segment.map((p, i) => `${i ? "L" : "M"}${x(p.time).toFixed(2)} ${y(p.close).toFixed(2)}`).join(" ")) ?? [];
  const first = points[0], latest = points.at(-1);
  const delta = trend?.netChange ?? null;

  return <section className={styles.panel} aria-label="Market data historical trend chart" data-testid="market-trend-chart">
    <header className={styles.header}>
      <div>
        <span className={styles.kicker}>MARKET DATA · OBSERVED HISTORY</span>
        <h2>Trend chart</h2>
        <p>Actual source-dated closes or yields. Independent vertical scale; no modelled prices or forward extensions.</p>
      </div>
      <div className={styles.filters}>
        <label className={styles.selector}><span>Instrument</span>
          <select value={selected?.id ?? ""} onChange={event => onSelect(event.target.value)}
            aria-label="Choose market trend instrument">
            {!selected ? <option value="">Unavailable</option> : null}
            {rows.map(row => <option key={row.id} value={row.id}>{row.label} · {row.symbol}</option>)}
          </select>
        </label>
        <div className={styles.rangeGroup} role="group" aria-label="Time range">
          {(["30D", "90D", "MAX"] as TrendWindow[]).map(item =>
            <button key={item} type="button" aria-pressed={window === item}
              onClick={() => setWindow(item)}>{item}</button>)}
        </div>
      </div>
    </header>
    {selected && trend ? <>
      <div className={styles.summary}>
        <div><span>LATEST PLOTTED</span><strong>{latest ? displayValue(latest.close, rate) : "—"}</strong>
          <small>{trend.sourceDate ?? "Source date unavailable"}</small></div>
        <div><span>PERIOD CHANGE</span><strong data-tone={delta === null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
          {displayChange(delta, trend.netChangeUnit)}</strong><small>From the first plotted observation</small></div>
        <div><span>SERIES</span><strong>{selected.frequency.toUpperCase()}</strong>
          <small>{points.length} dated observation{points.length === 1 ? "" : "s"}</small></div>
      </div>

      {trend.stale ? <p className={styles.warning} role="status">
        HISTORICAL / STALE · Last recorded observation: {trend.sourceDate ?? "not available"}. The chart is not a live quote.
      </p> : null}
      {!chartReady ? <div className={styles.empty} role="status">
        No comparable historical trend for {selected.label} in {window}. At least two verified dated values are required.
        Select MAX or another instrument to inspect available observations.
      </div> : <div className={styles.plotWrap}>
        <svg className={styles.plot} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
          aria-label={`${selected.label}: ${points.length} source observations from ${displayDate(first!.time)} to ${displayDate(latest!.time)}. Start ${displayValue(first!.close, rate)}, end ${displayValue(latest!.close, rate)}.`}>
          {[0, 1, 2, 3, 4].map(i => {
            const at = TOP + i * vertical / 4;
            return <g key={i}>
              <line x1={LEFT} y1={at} x2={WIDTH - RIGHT} y2={at} className={styles.gridLine}/>
              <text x={LEFT - 9} y={at + 3} textAnchor="end">{displayValue(max - i * (max - min) / 4, rate)}</text>
            </g>;
          })}
          {linePaths.map((path, i) => <path key={i} d={path} className={styles.line}/>)}
          {trend.segments.filter(segment => segment.length === 1).map((segment, i) =>
            <circle key={i} cx={x(segment[0].time)} cy={y(segment[0].close)} r={3} className={styles.dot}/>)}
          <circle cx={x(latest!.time)} cy={y(latest!.close)} r={4.4} className={styles.dot}/>
          {[firstTime, firstTime + (lastTime - firstTime)/2, lastTime].map((time, i) =>
            <text key={i} x={x(time)} y={HEIGHT - 14} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>{displayDate(time)}</text>)}
        </svg>
      </div>}
      <footer className={styles.footer}>
        <span>{trend.coverageStart ?? "—"} → {trend.coverageEnd ?? "—"} · {selected.type === "Rates" ? "Yield in %" :
          selected.type === "Credit / Risk" ? "Spread in percentage points" : "Native source units"} · {selected.frequency}</span>
        <a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceName} · source ↗</a>
      </footer>
      {chartReady ? <details className={styles.detail}>
        <summary>Inspect the latest dated readings</summary>
        <table><thead><tr><th>Date</th><th>Recorded value</th></tr></thead>
          <tbody>{points.slice(-8).reverse().map(point =>
            <tr key={point.time}><td>{displayDate(point.time)}</td><td>{displayValue(point.close, rate)}</td></tr>)}</tbody>
        </table>
      </details> : null}
    </> : <div className={styles.empty} role="status">No source-qualified market series is available.</div>}
  </section>;
}
