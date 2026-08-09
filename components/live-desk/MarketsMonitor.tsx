"use client";

import { useMemo, useState } from "react";

import type { GlobalFlowMonitor } from "@/lib/global-flow-monitor";
import type { MarketMonitor, MarketMonitorRow, MarketMonitorType } from "@/lib/market-monitor";
import styles from "./markets-monitor.module.css";

type Props = {
  monitor: MarketMonitor;
  flows: GlobalFlowMonitor;
};

type Screen = "all" | "hot" | "gainers" | "losers" | "overbought" | "oversold" | "gap" | "highvol" | "relative" | "contradiction";
type SortKey = "attention" | "day" | "3d" | "5d" | "rsi" | "vol" | "type";

const TYPE_ORDER: MarketMonitorType[] = ["Major Index", "AI / Semis", "MAG7", "Sector", "Metal", "Energy", "FX", "Rates", "Credit / Risk", "IPO / New Issue", "Crypto"];

function formatPrice(value: number | null, type: MarketMonitorType) {
  if (value == null) return "—";
  if (type === "Rates") return `${value.toFixed(2)}%`;
  const digits = Math.abs(value) >= 1000 ? 1 : Math.abs(value) >= 100 ? 2 : Math.abs(value) >= 10 ? 2 : 3;
  return value.toLocaleString("en-GB", { maximumFractionDigits: digits });
}

function formatPct(value: number | null) {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDay(row: MarketMonitorRow) {
  if (row.dayChange == null) return "—";
  if (row.type === "Rates" && row.previousClose != null && row.last != null) {
    const bps = (row.last - row.previousClose) * 100;
    return `${bps >= 0 ? "+" : ""}${bps.toFixed(1)}bp`;
  }
  return formatPct(row.dayChange);
}

function tone(value: number | null) {
  if (value == null || Math.abs(value) < 0.005) return "flat";
  return value > 0 ? "up" : "down";
}

function Sparkline({ row }: { row: MarketMonitorRow }) {
  const points = row.points.slice(-42);
  if (points.length < 2) return <span className={styles.noChart}>NO CHART</span>;
  const width = 92;
  const height = 28;
  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points.map((point, index) => {
    const x = index * width / Math.max(1, points.length - 1);
    const y = height - ((point.close - min) / range) * (height - 4) - 2;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const rising = values.at(-1)! >= values[0];
  return <svg className={styles.spark} data-tone={rising ? "up" : "down"} viewBox={`0 0 ${width} ${height}`} aria-label={`${row.label} mini chart`}><path d={path} /></svg>;
}

function filterRow(row: MarketMonitorRow, screen: Screen, lower: number, upper: number) {
  if (screen === "hot") return row.hot;
  if (screen === "gainers") return (row.dayChange || 0) > 0;
  if (screen === "losers") return (row.dayChange || 0) < 0;
  if (screen === "overbought") return row.rsi != null && row.rsi > upper;
  if (screen === "oversold") return row.rsi != null && row.rsi < lower;
  if (screen === "gap") return row.gapChange != null && Math.abs(row.gapChange) >= 1;
  if (screen === "highvol") return row.volPercentile != null && row.volPercentile >= 80;
  if (screen === "relative") return row.relative5d != null && Math.abs(row.relative5d) >= 2;
  if (screen === "contradiction") return row.contradiction;
  return true;
}

function sortValue(row: MarketMonitorRow, key: SortKey) {
  if (key === "attention") return row.attentionScore;
  if (key === "day") return Math.abs(row.dayChange || 0);
  if (key === "3d") return Math.abs(row.change3d || 0);
  if (key === "5d") return Math.abs(row.change5d || 0);
  if (key === "rsi") return Math.abs((row.rsi ?? 50) - 50);
  if (key === "vol") return row.volPercentile || 0;
  return 0;
}

function FlowTable({ title, rows }: { title: string; rows: GlobalFlowMonitor["oil"] }) {
  return <section className={styles.flowPanel}>
    <header><span>FLOW MONITOR</span><h3>{title}</h3></header>
    <div className={styles.flowRows}>
      {rows.map((row) => <article key={row.id} data-state={row.state}>
        <div className={styles.flowTitle}><div><span>{row.geography} · {row.family}</span><strong>{row.label}</strong></div><b>{row.state === "coverage_gap" ? "DATA GAP" : row.state.toUpperCase()}</b></div>
        <div className={styles.flowReading}><strong>{row.current || "Not connected"}</strong>{row.delta ? <span data-tone={row.direction === "rising" ? "up" : row.direction === "falling" ? "down" : "flat"}>{row.delta}</span> : null}</div>
        <p>{row.interpretation}</p>
        <footer><span>{row.cadence}{row.asOf ? ` · ${row.asOf.slice(0, 10)}` : ""}</span><a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName} ↗</a></footer>
      </article>)}
    </div>
  </section>;
}

export default function MarketsMonitor({ monitor, flows }: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"All" | MarketMonitorType>("All");
  const [screen, setScreen] = useState<Screen>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [lower, setLower] = useState(30);
  const [upper, setUpper] = useState(70);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return monitor.rows
      .filter((row) => type === "All" || row.type === type)
      .filter((row) => filterRow(row, screen, lower, upper))
      .filter((row) => !needle || [row.label, row.symbol, row.type, ...row.tags].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => sort === "type"
        ? TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || b.attentionScore - a.attentionScore
        : sortValue(b, sort) - sortValue(a, sort));
  }, [monitor.rows, query, type, screen, lower, upper, sort]);

  const types = TYPE_ORDER.filter((candidate) => monitor.rows.some((row) => row.type === candidate));
  const hotCount = monitor.rows.filter((row) => row.hot).length;
  const gapCount = monitor.rows.filter((row) => row.rsi == null || row.dayChange == null).length;

  return <div className={styles.workspace}>
    <section className={styles.statStrip}>
      <div><span>ASSETS</span><strong>{monitor.rows.length}</strong></div>
      <div><span>HOT NOW</span><strong>{hotCount}</strong></div>
      <div><span>CONTRADICTIONS</span><strong>{monitor.contradictions.length}</strong></div>
      <div><span>PARTIAL DATA</span><strong>{gapCount}</strong></div>
    </section>

    <section className={styles.terminal}>
      <header className={styles.terminalHead}>
        <div><span>CROSS-ASSET TERMINAL</span><h2>Prices, momentum and anomalies</h2><p>Attention Score ranks what deserves a research look first. It is not a trading signal.</p></div>
        <small>LAST REFRESH · {new Date(monitor.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour12: false })} MYT</small>
      </header>

      <div className={styles.controls}>
        <label className={styles.search}><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="NVDA, oil, sector, oversold..." /></label>
        <label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as "All" | MarketMonitorType)}><option>All</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Screen</span><select value={screen} onChange={(event) => setScreen(event.target.value as Screen)}><option value="all">All</option><option value="hot">HOT</option><option value="gainers">Gainers</option><option value="losers">Losers</option><option value="overbought">Overbought</option><option value="oversold">Oversold</option><option value="gap">Gap ≥1%</option><option value="highvol">High volatility</option><option value="relative">Relative outlier</option><option value="contradiction">Contradictions</option></select></label>
        <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="attention">HOT score</option><option value="day">Daily move</option><option value="3d">3D move</option><option value="5d">5D move</option><option value="rsi">RSI extreme</option><option value="vol">Volatility</option><option value="type">Asset type</option></select></label>
        <div className={styles.rsiThreshold}><span>RSI limits</span><div><input type="number" min="0" max="50" value={lower} onChange={(event) => setLower(Number(event.target.value) || 30)} aria-label="Oversold RSI threshold" /><i>/</i><input type="number" min="50" max="100" value={upper} onChange={(event) => setUpper(Number(event.target.value) || 70)} aria-label="Overbought RSI threshold" /></div></div>
      </div>

      <div className={styles.screenButtons}>
        {(["all", "hot", "gainers", "losers", "overbought", "oversold", "highvol", "contradiction"] as Screen[]).map((item) => <button type="button" key={item} data-active={screen === item} onClick={() => setScreen(item)}>{item === "highvol" ? "HIGH VOL" : item.toUpperCase()}</button>)}
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>Asset</th><th>Chart</th><th>Type</th><th>Last</th><th>Day</th><th>Gap</th><th>3D</th><th>5D</th><th>RSI</th><th>Stoch RSI</th><th>Vol</th><th>HOT</th></tr></thead>
          <tbody>{rows.map((row) => <>
            <tr key={row.id} data-hot={row.hot} data-contradiction={row.contradiction} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
              <td><button className={styles.assetButton} type="button"><strong>{row.label}</strong><span>{row.symbol} · {row.asOf || "N/A"}</span>{row.tags.length ? <small>{row.tags.slice(0, 3).join(" · ")}</small> : null}</button></td>
              <td><Sparkline row={row} /></td>
              <td><span className={styles.typePill}>{row.type}</span></td>
              <td className={styles.number}><strong>{formatPrice(row.last, row.type)}</strong></td>
              <td className={styles.number} data-tone={tone(row.dayChange)}>{formatDay(row)}</td>
              <td className={styles.number} data-tone={tone(row.gapChange)}>{formatPct(row.gapChange)}</td>
              <td className={styles.number} data-tone={tone(row.change3d)}>{formatPct(row.change3d)}</td>
              <td className={styles.number} data-tone={tone(row.change5d)}>{formatPct(row.change5d)}</td>
              <td className={styles.number} data-extreme={row.rsi != null && (row.rsi < lower || row.rsi > upper)}>{row.rsi?.toFixed(1) || "—"}</td>
              <td className={styles.number}>{row.stochRsi?.toFixed(1) || "—"}</td>
              <td className={styles.number}>{row.volPercentile == null ? "—" : `P${row.volPercentile.toFixed(0)}`}</td>
              <td><span className={styles.hotScore} data-hot={row.hot}>{row.attentionScore}</span></td>
            </tr>
            {expanded === row.id ? <tr className={styles.expanded} key={`${row.id}-detail`}><td colSpan={12}><div className={styles.detailGrid}>
              <div><span>Previous close</span><strong>{formatPrice(row.previousClose, row.type)}</strong></div>
              <div><span>Session open</span><strong>{formatPrice(row.sessionOpen, row.type)}</strong></div>
              <div><span>Relative 5D</span><strong>{formatPct(row.relative5d)}</strong></div>
              <div><span>Frequency</span><strong>{row.frequency}</strong></div>
              <div className={styles.detailSource}><span>Source</span><a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName} ↗</a></div>
            </div></td></tr> : null}
          </>)}</tbody>
        </table>
      </div>
      <div className={styles.resultLine}>{rows.length} assets shown · RSI oversold &lt; {lower} · overbought &gt; {upper}</div>
    </section>

    {monitor.contradictions.length ? <section className={styles.contradictions}>
      <header><span>RESEARCH TRIGGERS</span><h2>Cross-asset contradictions</h2><p>These are relationships worth investigating, not automatic thesis changes.</p></header>
      <div>{monitor.contradictions.map((item) => <article key={item.id}><b>{item.priority}</b><section><span>{item.assets.join(" · ")}</span><h3>{item.title}</h3><p>{item.detail}</p><strong>{item.researchQuestion}</strong></section></article>)}</div>
    </section> : null}

    <div className={styles.flowGrid}>
      <FlowTable title="Central-bank gold watch" rows={flows.gold} />
      <FlowTable title="Global oil flow & demand" rows={flows.oil} />
    </div>

    {monitor.limitations.length ? <section className={styles.limitations}><strong>DATA NOTES</strong>{monitor.limitations.map((item) => <p key={item}>{item}</p>)}</section> : null}
  </div>;
}
