"use client";

import { useMemo, useState } from "react";

import type { ChartRequest } from "@/lib/data";
import type { MarketData, MarketSeries, PricePoint } from "@/lib/market";

type Range = "7D" | "30D" | "90D" | "1Y";

function rangePoints(points: PricePoint[], range: Range) {
  const sessions = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 280;
  return points.slice(-sessions);
}

function linePath(points: PricePoint[], width: number, height: number, padding: number) {
  if (points.length < 2) return "";
  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Math.abs(max) * 0.002, 0.0001);
  return points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.close - min) / span) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function formatPct(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatValue(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: value >= 100 ? 1 : 2 }).format(value);
}

function latestDate(series?: MarketSeries) {
  const timestamp = series?.points.at(-1)?.time;
  if (!timestamp) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp * 1000));
}

export default function LiveChartsWorkspace({ market, charts }: { market: MarketData; charts: ChartRequest[] }) {
  const [range, setRange] = useState<Range>("90D");
  const [selectedSymbol, setSelectedSymbol] = useState(market.series[0]?.symbol || "");
  const selectedSeries = market.series.find((series) => series.symbol === selectedSymbol) || market.series[0];
  const points = useMemo(() => rangePoints(selectedSeries?.points || [], range), [selectedSeries, range]);

  return (
    <div className="charts-page tab-page">
      <article className="panel primary-chart-panel">
        <div className="panel-title-row">
          <div>
            <span className="panel-kicker">LIVE MARKET CHART</span>
            <h2>{selectedSeries?.label || "Market series unavailable"}</h2>
            <p>{selectedSeries?.symbol || "—"} · last {formatValue(selectedSeries?.last)} · through {latestDate(selectedSeries)}</p>
          </div>
          <div className="range-tabs">
            {(["7D", "30D", "90D", "1Y"] as Range[]).map((item) => (
              <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>
            ))}
          </div>
        </div>

        <svg className="large-chart" viewBox="0 0 1000 430" preserveAspectRatio="none" aria-label={`Live ${selectedSeries?.label || "market"} chart`}>
          <path className="chart-grid" d="M0 80H1000 M0 160H1000 M0 240H1000 M0 320H1000 M180 0V400 M380 0V400 M580 0V400 M780 0V400" />
          {points.length > 1 ? <path className="large-line" d={linePath(points, 1000, 430, 18)} /> : null}
        </svg>

        <div className="chart-footer">
          <span>{range}</span>
          <span>5D {formatPct(selectedSeries?.change5d)}</span>
          <span>21D {formatPct(selectedSeries?.change21d)}</span>
          {selectedSeries?.sourceUrl ? <a href={selectedSeries.sourceUrl} target="_blank" rel="noreferrer">{selectedSeries.sourceName} ↗</a> : null}
        </div>
      </article>

      <aside className="chart-request-list panel">
        <div className="panel-title"><span>▥</span><h3>Live series</h3></div>
        {market.series.map((series, index) => (
          <button key={series.symbol} className={selectedSeries?.symbol === series.symbol ? "active" : ""} onClick={() => setSelectedSymbol(series.symbol)}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <span><b>{series.label}</b><small>{series.symbol} · 21D {formatPct(series.change21d)}</small></span>
            <em>{formatValue(series.last)}</em>
          </button>
        ))}

        <div className="request-divider"><span>RESEARCH REQUESTS</span></div>
        {charts.map((chart, index) => (
          <button key={chart.id}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <span><b>{chart.instrument}</b><small>{chart.question}</small></span>
            <em>{chart.status}</em>
          </button>
        ))}
      </aside>
    </div>
  );
}
