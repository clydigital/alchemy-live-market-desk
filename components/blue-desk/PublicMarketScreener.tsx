"use client";

import { useMemo, useState } from "react";

import { EntityRow } from "@/components/blue-desk/EntityIdentity";
import { entityForAsset } from "@/lib/bluebelly-entity-identity";
import {
  DEFAULT_PUBLIC_MARKET_FILTERS,
  filterPublicMarketObservations,
  publicMarketWindowChange,
  sortPublicMarketColumns,
  type MarketSortColumn,
  type MarketChangeWindow,
  type MarketChangeDirection,
  type MarketChangeSort,
  type MarketChangeUnit,
} from "@/lib/blue-desk-market-filters";
import type { PublicMarketGroup, PublicMarketObservation } from "@/lib/blue-desk-public-markets";
import styles from "@/app/blue-desk/blue-desk.module.css";
import ui from "./PublicMarketScreener.module.css";

type Props = { observations: PublicMarketObservation[]; group: PublicMarketGroup; dataAvailable: boolean };

function level(row: PublicMarketObservation) {
  if (row.last === null) return "Unavailable";
  const value = row.last.toLocaleString("en-GB", {
    maximumFractionDigits: Math.abs(row.last) >= 1000 ? 1 : 3,
  });
  return row.type === "Rates" ? `${value}%` : value;
}

function change(value: number | null, unit: "%" | "bp") {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${unit === "bp" ? " bp" : "%"}`;
}

export default function PublicMarketScreener({ observations, group, dataAvailable }: Props) {
  const initialUnit: MarketChangeUnit = group === "rates" ? "bp" : "all";
  const [query, setQuery] = useState("");
  const [window, setWindow] = useState<MarketChangeWindow>("1D");
  const [unit, setUnit] = useState<MarketChangeUnit>(initialUnit);
  const [direction, setDirection] = useState<MarketChangeDirection>("all");
  const [minimum, setMinimum] = useState(0);
  const [sort, setSort] = useState<MarketChangeSort>("source");
  const [columnSort, setColumnSort] = useState<MarketSortColumn | null>(null);
  const [ascending, setAscending] = useState(true);
  const [compareSymbols, setCompareSymbols] = useState<string[]>(["RSP", "XLK", "XLF", "XLE"]);

  function sortColumn(column: MarketSortColumn) {
    setAscending(columnSort===column ? !ascending : column==="instrument" || column==="source");
    setColumnSort(column);
    if(column==="1D"||column==="3D"||column==="5D")setWindow(column);
  }

  const visible = useMemo(() => {
    const filtered = filterPublicMarketObservations(observations, {
      query, window, unit, direction, minMove: minimum, sort,
    });
    return columnSort ? sortPublicMarketColumns(filtered, columnSort, ascending) : filtered;
  }, [observations, query, window, unit, direction, minimum, sort, columnSort, ascending]);

  const comparisonUniverse = useMemo(() => observations.filter(row =>
    row.type === "Sector" || ["RSP", "SMH", "SOXX", "QQQ", "SPY"].includes(row.symbol)
  ), [observations]);
  const comparisonRows = comparisonUniverse.filter(row => compareSymbols.includes(row.symbol));
  const equalWeight = comparisonUniverse.find(row => row.symbol === "RSP");

  function toggleComparison(symbol: string, checked: boolean) {
    setCompareSymbols(current => checked
      ? [...new Set([...current, symbol])].slice(0, 20)
      : current.filter(item => item !== symbol));
  }

  function reset() {
    setColumnSort(null);
    setQuery(DEFAULT_PUBLIC_MARKET_FILTERS.query);
    setWindow("1D");
    setUnit(initialUnit);
    setDirection("all");
    setMinimum(0);
    setSort("source");
  }

  function preset(nextUnit: MarketChangeUnit, nextDirection: MarketChangeDirection, nextMinimum: number) {
    setUnit(nextUnit);
    setDirection(nextDirection);
    setMinimum(nextMinimum);
    setColumnSort(null);
    setSort(nextDirection === "down" ? "losers" : "magnitude");
  }

  return <div data-market-change-screener="read-only">
    {group === "all" && comparisonUniverse.length ? <details className={ui.comparePanel} open>
      <summary>Compare sector ETFs, equal weight and semiconductors</summary>
      <p>Choose ETFs to compare 1D, 3D and 5D percentage returns from their source-dated sessions. This is not a live chart or a total-return series.</p>
      <div className={ui.comparePresets}>
        <button type="button" onClick={() => setCompareSymbols(comparisonUniverse.filter(row => row.type === "Sector").map(row => row.symbol))}>All XL sectors</button>
        <button type="button" onClick={() => setCompareSymbols(["RSP", "XLK", "XLF", "XLE"])}>RSP vs XL sectors</button>
        <button type="button" onClick={() => setCompareSymbols(["RSP", "SMH", "SOXX", "XLK"])}>Semis vs market</button>
        <button type="button" onClick={() => setCompareSymbols([])}>Clear</button>
      </div>
      <div className={ui.compareChoices}>
        {comparisonUniverse.map(row => <label key={row.id}>
          <input type="checkbox" checked={compareSymbols.includes(row.symbol)} onChange={event => toggleComparison(row.symbol, event.target.checked)} />
          <span>{row.symbol}</span><small>{row.label}</small>
        </label>)}
      </div>
      {comparisonRows.length ? <div className={styles.publicMarketTableScroll}>
        <table className={`${styles.publicMarketTable} ${ui.compareTable}`}>
          <thead><tr><th>Instrument</th><th>Source session</th><th>1D</th><th>3D</th><th>5D</th><th>5D vs RSP</th></tr></thead>
          <tbody>{comparisonRows.map(row => {
            const matched = Boolean(equalWeight && row.asOf && row.asOf === equalWeight.asOf
              && row.change5d !== null && equalWeight.change5d !== null);
            const relative = matched ? row.change5d! - equalWeight!.change5d! : null;
            return <tr key={row.id}><th scope="row">{row.symbol} · {row.label}</th>
              <td>{row.asOf || "Unavailable"}</td>
              {(["1D","3D","5D"] as const).map(period => <td key={period} data-direction={(publicMarketWindowChange(row,period) ?? 0) > 0 ? "up" : "flat"}>{change(publicMarketWindowChange(row,period), "%")}</td>)}
              <td>{relative === null ? "—" : `${relative > 0 ? "+" : ""}${relative.toFixed(2)} pp`}</td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <p>Select at least one ETF to compare.</p>}
      <p className={ui.comparisonNote}>Relative comparisons are percentage-point differences against RSP over the same five source sessions and matching observation date. Missing values are not filled in.</p>
    </details> : null}
    <div className={ui.screener} aria-label="Market change filters">
      <div className={ui.quick}>
        <span>Quick screens</span>
        <button type="button" onClick={reset}>All</button>
        <button type="button" onClick={() => preset("%", "up", 1)}>Up ≥1%</button>
        <button type="button" onClick={() => preset("%", "down", 1)}>Down ≥1%</button>
        <button type="button" onClick={() => preset("%", "all", 2)}>Move ≥2%</button>
        <button type="button" onClick={() => preset("bp", "all", 10)}>Rates ≥10 bp</button>
      </div>
      <div className={ui.controls}>
        <label>Screen / sort period
          <select aria-label="Screen and sort period" value={window} onChange={event => { setWindow(event.target.value as MarketChangeWindow); setColumnSort(null); }}>
            <option value="1D">1D · one session</option>
            <option value="3D">3D · three sessions</option>
            <option value="5D">5D · five sessions</option>
          </select>
        </label>
        <label>Search instrument
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="NVDA, DXY, Brent…" />
        </label>
        <label>Measure
          <select value={unit} onChange={event => setUnit(event.target.value as MarketChangeUnit)}>
            <option value="all">All units</option>
            <option value="%">Percentage (%)</option>
            <option value="bp">Rate changes (bp)</option>
          </select>
        </label>
        <label>Direction
          <select value={direction} onChange={event => {
            const next = event.target.value as MarketChangeDirection;
            if (unit === "all" && next !== "all") setUnit("%");
            setDirection(next);
          }}>
            <option value="all">Either direction</option>
            <option value="up">Rising only</option>
            <option value="down">Falling only</option>
          </select>
        </label>
        <label>Minimum absolute change
          <input type="number" min="0" max="1000" step="0.1" inputMode="decimal" value={minimum}
            onChange={event => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              if (unit === "all" && next > 0) setUnit("%");
              setMinimum(Math.min(1000, Math.max(0, next)));
            }} />
        </label>
        <label>Sort
          <select value={sort} onChange={event => { setSort(event.target.value as MarketChangeSort); setColumnSort(null); }}>
            <option value="source">Source order</option>
            <option value="magnitude">Largest changes</option>
            <option value="gainers">Biggest rises</option>
            <option value="losers">Biggest falls</option>
            <option value="name">Instrument A–Z</option>
          </select>
        </label>
        <button type="button" className={ui.reset} onClick={reset}>Reset filters</button>
      </div>
      <p className={ui.disclaimer}>1D, 3D and 5D count completed source sessions, not calendar days. All three appear below; filters and sorting use the selected period ({window}). Percentage moves and yield changes in bp remain separate. Missing history is unavailable, not zero.</p>
      <p className={ui.count} role="status" aria-live="polite">
        <strong>{visible.length}</strong> of {observations.length} instruments shown
        {` · Screening ${window}`}{unit === "all" ? " · All units" : ` · ${unit === "%" ? "Percentage moves" : "Rate changes in bp"}`}
      </p>
    </div>

    {visible.length ? <div className={styles.publicMarketTableScroll}>
      <table className={styles.publicMarketTable}>
        <thead><tr><th scope="col" aria-sort={columnSort==="instrument"?(ascending?"ascending":"descending"):undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn("instrument")}>Instrument {columnSort==="instrument"?(ascending?"▲":"▼"):"↕"}</button></th><th scope="col" aria-sort={columnSort==="last"?(ascending?"ascending":"descending"):undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn("last")}>Last observed {columnSort==="last"?(ascending?"▲":"▼"):"↕"}</button></th>
          {(["1D", "3D", "5D"] as const).map(period => <th scope="col" key={period} data-selected={period === window} aria-sort={columnSort===period?(ascending?"ascending":"descending"):undefined} className={period === window ? ui.selectedChange : undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn(period)}>{period} change {columnSort===period?(ascending?"▲":"▼"):"↕"}</button></th>)}
          <th scope="col" aria-sort={columnSort==="source"?(ascending?"ascending":"descending"):undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn("source")}>Source and vintage {columnSort==="source"?(ascending?"▲":"▼"):"↕"}</button></th></tr></thead>
        <tbody>{visible.map(row => <tr key={row.id}>
          <th scope="row"><EntityRow identity={entityForAsset(row.symbol) || {kind: "asset", code: row.symbol}}
            title={row.label} subtitle={row.symbol + " · " + (row.researchRole ? `Power Stack ${row.researchRole}` : row.type)} /></th>
          <td className={styles.publicMarketNumber}>{level(row)}</td>
          {(["1D", "3D", "5D"] as const).map(period => {
            const value = publicMarketWindowChange(row, period);
            return <td key={period} className={`${styles.publicMarketNumber} ${period === window ? ui.selectedChange : ""}`} data-selected={period === window}
              data-direction={value === null ? "unknown" : value > 0 ? "up" : value < 0 ? "down" : "flat"}
              title={value === null ? `${period} source-session change unavailable` : `${period} change through ${row.asOf || "unknown source date"}`}>
              {change(value, row.changeUnit)}
            </td>;
          })}
          <td className={styles.publicMarketSource}>
            <span>{row.type === "Breadth" ? "External breadth chart · no verified reading" : row.researchRole && row.last === null ? `Power Stack ${row.researchRole} registry · ${row.researchAsOf || "undated"}` : `${row.asOf ? `Observation: ${row.asOf}` : "Observation date unavailable"} · ${row.frequency} observation`}</span>
            {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName} · {row.type === "Breadth" ? "open chart ↗" : row.researchRole && row.last === null ? "research registry ↗" : "original data ↗"}</a>
              : <span>Original-source link unavailable</span>}
          </td>
        </tr>)}</tbody>
      </table>
    </div> : <div className={styles.secondaryPanel} role="status">
      <h3>{dataAvailable ? "No instruments match these filters" : "Observations unavailable"}</h3>
      <p className={styles.muted}>{dataAvailable
        ? "Try a smaller threshold, a different unit or Reset filters."
        : "Market data unavailable. Filtering cannot restore a missing feed."}</p>
      {dataAvailable ? <button type="button" className={ui.reset} onClick={reset}>Reset filters</button> : null}
    </div>}
    <p className={styles.publicMarketNote}>Power Stack-only tickers are searchable research records, not price observations. Holdings are labels only; no quantities, account values or broker data are shown. Change periods: 1, 3 and 5 source sessions, measured through each instrument's observation date. Rates in bp; others in %. Monthly yields show levels only. Data may lag.</p>
  </div>;
}
