"use client";

import { useMemo, useState } from "react";
import {projectEtfRotationVisual} from "@/lib/bluebelly-etf-rotation-visuals";

import { EntityRow } from "@/components/blue-desk/EntityIdentity";
import MarketObservationTakeaway from "./MarketObservationTakeaway";
import { entityForAsset } from "@/lib/bluebelly-entity-identity";
import {
  DEFAULT_PUBLIC_MARKET_FILTERS,
  filterPublicMarketObservations,
  publicMarketWindowChange,
  sortPublicMarketColumns,
  sortEtfComparisonRows,
  type EtfComparisonSortColumn,
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
  return row.type === "Rates" || row.type === "Breadth" ? `${value}%` : value;
}

function change(value: number | null, unit: "%" | "bp" | "pp") {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${unit === "bp" ? " bp" : unit === "pp" ? " pp" : "%"}`;
}

export default function PublicMarketScreener({ observations, group, dataAvailable }: Props) {
  const initialUnit: MarketChangeUnit = group === "rates" ? "bp" : group === "breadth" ? "pp" : "all";
  const [query, setQuery] = useState("");
  const [window, setWindow] = useState<MarketChangeWindow>("1D");
  const [unit, setUnit] = useState<MarketChangeUnit>(initialUnit);
  const [direction, setDirection] = useState<MarketChangeDirection>("all");
  const [minimum, setMinimum] = useState(0);
  const [sort, setSort] = useState<MarketChangeSort>("source");
  const [columnSort, setColumnSort] = useState<MarketSortColumn | null>(null);
  const [ascending, setAscending] = useState(true);
  const [compareSymbols, setCompareSymbols] = useState<string[]>(() => observations.filter(row => row.type === "Sector").map(row => row.symbol));
  const [comparisonSort, setComparisonSort] = useState<EtfComparisonSortColumn | null>("1D");
  const [graphicWindow, setGraphicWindow] = useState<MarketChangeWindow>("1D");
  const [comparisonAscending, setComparisonAscending] = useState(false);

  function sortComparisonColumn(column: EtfComparisonSortColumn) {
    setComparisonAscending(comparisonSort === column ? !comparisonAscending : column === "instrument");
    setComparisonSort(column);
    if(column==="1D"||column==="3D"||column==="5D")setGraphicWindow(column);
  }

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
  // Only compare sectors whose original observations belong to the same
  // completed source session. Insufficient coverage fails closed.
  const sectorSnapshot = useMemo(() => {
    const rows = observations.filter(row => row.type === "Sector"
      && row.changeUnit === "%" && row.asOf
      && row.change !== null && Number.isFinite(row.change));
    const dates = [...new Set(rows.map(row => row.asOf!))].sort().reverse();
    const matching = dates.map(date => rows.filter(row => row.asOf === date))
      .find(group => group.length >= 8);
    if (!matching) return null;
    const ranked = [...matching].sort((a,b) => b.change! - a.change!);
    return {
      asOf: ranked[0].asOf!,
      leader: ranked[0], laggard: ranked[ranked.length - 1],
      advancing: ranked.filter(row => row.change! > 0).length,
      coverage: ranked.length,
      spread: ranked[0].change! - ranked[ranked.length - 1].change!,
    };
  }, [observations]);
  const comparisonRows = comparisonUniverse.filter(row => compareSymbols.includes(row.symbol));
  const equalWeight = comparisonUniverse.find(row => row.symbol === "RSP");
  const orderedComparisonRows = comparisonSort
    ? sortEtfComparisonRows(comparisonRows, comparisonSort, comparisonAscending, equalWeight)
    : comparisonRows;
  const rotationVisual = useMemo(
    ()=>projectEtfRotationVisual(comparisonUniverse,compareSymbols,graphicWindow),
    [comparisonUniverse,compareSymbols,graphicWindow],
  );
  const comparisonHeader = (column: EtfComparisonSortColumn, label: string) =>
    <th scope="col" aria-sort={comparisonSort===column
      ? comparisonAscending ? "ascending" : "descending" : undefined}>
      <button type="button" className={ui.columnSort} onClick={() => sortComparisonColumn(column)}
        aria-label={`Sort ETF comparison by ${label}`}>
        {label} {comparisonSort===column ? comparisonAscending ? "▲" : "▼" : "↕"}
      </button>
    </th>;

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
      <details className={ui.comparePickDisclosure}>
        <summary>Customize ETF selection ({compareSymbols.length} chosen)</summary>
      <div className={ui.compareChoices}>
        {comparisonUniverse.map(row => <label key={row.id}>
          <input type="checkbox" checked={compareSymbols.includes(row.symbol)} onChange={event => toggleComparison(row.symbol, event.target.checked)} />
          <span>{row.symbol}</span><small>{row.label}</small>
        </label>)}
      </div>
      </details>
      {sectorSnapshot ? <div className={ui.rotationSummary} aria-label="Source-dated XL sector rotation">
        <div><span>1D LEADER</span><strong data-direction="up">{sectorSnapshot.leader.symbol} {change(sectorSnapshot.leader.change, "%")}</strong></div>
        <div><span>1D LAGGARD</span><strong data-direction="down">{sectorSnapshot.laggard.symbol} {change(sectorSnapshot.laggard.change, "%")}</strong></div>
        <div><span>SECTOR PARTICIPATION</span><strong>{sectorSnapshot.advancing} / {sectorSnapshot.coverage} advancing</strong></div>
        <p>Leader–laggard gap: {sectorSnapshot.spread.toFixed(2)} percentage points · source session {sectorSnapshot.asOf}.
          Source-matched ETF price rotation, not confirmed investment flows or a canonical regime verdict.</p>
      </div> : <p className={ui.rotationUnavailable}>Sector rotation summary unavailable: fewer than eight same-session, source-dated sector readings. Individual ETF rows remain accessible.</p>}
      <section className={ui.rotationGraphic} aria-label="Same-session ETF price-change comparison"
        data-v7-etf-rotation="source-matched">
        <div className={ui.graphicHeader}>
          <div><h3>Rotation map <span>· recorded price changes</span></h3>
          <p>Signed cumulative returns, same observation session only. This is not an ETF flow chart.</p></div>
          <div className={ui.graphicPeriods} role="group" aria-label="Graph comparison window">
            {(["1D","3D","5D"] as const).map(period=>
              <button key={period} type="button" aria-pressed={graphicWindow===period}
                onClick={()=>{setGraphicWindow(period);setComparisonSort(period);setComparisonAscending(false)}}>
                {period}
              </button>)}
          </div>
        </div>
        {rotationVisual?<div className={ui.graphicBody}>
          <div className={ui.graphicMetadata}>
            <span>SESSION {rotationVisual.asOf}</span>
            <span>{rotationVisual.bars.length} MATCHED / {compareSymbols.length} SELECTED</span>
          </div>
          <div className={ui.graphicRows}>
            {rotationVisual.bars.map(bar=><div key={bar.id} className={ui.graphicRow}
              data-direction={bar.direction} title={bar.label}>
              <strong>{bar.symbol}</strong>
              <div className={ui.graphicTrack} aria-hidden="true">
                {bar.widthPercent>0?<span className={ui.graphicBar}
                  style={{left:`${bar.leftPercent}%`,width:`${bar.widthPercent}%`}}/>:null}
              </div>
              <span className={ui.graphicValue}>{bar.display}</span>
            </div>)}
          </div>
          <p className={ui.graphicCaveat}>Bars share a zero midpoint and scale only within this matched session.
            {rotationVisual.omitted>0?` ${rotationVisual.omitted} selection(s) excluded for missing or mismatched observations.`:""}
            The sortable table below retains every selected instrument and its individual source date.</p>
        </div>:<p className={ui.rotationUnavailable}>No valid graphical comparison: select at least two ETFs with recorded {graphicWindow} percentage changes from the same source session. The full table below still shows all selected rows.</p>}
      </section>
      {comparisonRows.length ? <div className={styles.publicMarketTableScroll}>
        <table className={`${styles.publicMarketTable} ${ui.compareTable}`}>
          <thead><tr>
            {comparisonHeader("instrument", "Instrument")}
            {comparisonHeader("sourceSession", "Source session")}
            {(["1D", "3D", "5D"] as const).map(period =>
              <th key={period} scope="col" aria-sort={comparisonSort===period
                ? comparisonAscending ? "ascending" : "descending" : undefined}>
                <button type="button" className={ui.columnSort} onClick={()=>sortComparisonColumn(period)}>
                  {period} {comparisonSort===period ? comparisonAscending ? "▲" : "▼" : "↕"}
                </button>
              </th>)}
            {comparisonHeader("relative5D", "5D vs RSP")}
          </tr></thead>
          <tbody>{orderedComparisonRows.map(row => {
            const matched = Boolean(equalWeight && row.asOf && row.asOf === equalWeight.asOf
              && row.change5d !== null && equalWeight.change5d !== null);
            const relative = matched ? row.change5d! - equalWeight!.change5d! : null;
            return <tr key={row.id}><th scope="row">{row.symbol} · {row.label}</th>
              <td>{row.asOf || "Unavailable"}</td>
              {(["1D","3D","5D"] as const).map(period => <td key={period} data-direction={publicMarketWindowChange(row,period) === null ? "unknown" : publicMarketWindowChange(row,period)! > 0 ? "up" : publicMarketWindowChange(row,period)! < 0 ? "down" : "flat"}>{change(publicMarketWindowChange(row,period), "%")}</td>)}
              <td>{relative === null ? "—" : `${relative > 0 ? "+" : ""}${relative.toFixed(2)} pp`}</td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <p>Select at least one ETF to compare.</p>}
      <p className={ui.comparisonNote}>Relative comparisons are percentage-point differences against RSP over the same five source sessions and matching observation date. Missing values are not filled in.</p>
    </details> : null}
    <details className={ui.advancedPanel} open={group !== "all"} data-market-advanced="optional">
      <summary>All instruments · search and advanced filters</summary>
      <p>Need a specific market, source or date? Open the full instrument table here.
       The comparison above stays available without using any of these controls.</p>
    <div className={ui.screener} aria-label="Market change filters">
      <div className={ui.quick}>
        <span>Quick screens</span>
        <button type="button" onClick={reset}>All</button>
        <button type="button" onClick={() => preset("%", "up", 1)}>Up ≥1%</button>
        <button type="button" onClick={() => preset("%", "down", 1)}>Down ≥1%</button>
        <button type="button" onClick={() => preset("%", "all", 2)}>Move ≥2%</button>
        <button type="button" onClick={() => preset("bp", "all", 10)}>Rates ≥10 bp</button>
        <button type="button" onClick={() => preset("pp", "all", 2)}>Breadth ≥2 pp</button>
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
            <option value="pp">Breadth change (pp)</option>
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
      <p className={ui.disclaimer}>1D, 3D and 5D count completed source sessions, not calendar days. All three appear below; filters and sorting use the selected period ({window}). Price returns (%), yield moves (bp), and breadth participation moves (pp) are distinct units. Missing history is unavailable, not zero.</p>
      <p className={ui.count} role="status" aria-live="polite">
        <strong>{visible.length}</strong> of {observations.length} instruments shown
        {` · Screening ${window}`}{unit === "all" ? " · All units" : ` · ${unit === "%" ? "Price returns" : unit === "bp" ? "Rate changes in bp" : "Breadth percentage points"}`}
      </p>
    </div>

    {visible.length ? <div className={styles.publicMarketTableScroll}>
      <table className={styles.publicMarketTable}>
        <thead><tr><th scope="col" aria-sort={columnSort==="instrument"?(ascending?"ascending":"descending"):undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn("instrument")}>Instrument {columnSort==="instrument"?(ascending?"▲":"▼"):"↕"}</button></th><th scope="col" aria-sort={columnSort==="last"?(ascending?"ascending":"descending"):undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn("last")}>Last observed {columnSort==="last"?(ascending?"▲":"▼"):"↕"}</button></th>
          {(["1D", "3D", "5D"] as const).map(period => <th scope="col" key={period} data-selected={period === window} aria-sort={columnSort===period?(ascending?"ascending":"descending"):undefined} className={period === window ? ui.selectedChange : undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn(period)}>{period} change {columnSort===period?(ascending?"▲":"▼"):"↕"}</button></th>)}
          <th scope="col" aria-sort={columnSort==="source"?(ascending?"ascending":"descending"):undefined}><button type="button" className={ui.columnSort} onClick={()=>sortColumn("source")}>Source and vintage {columnSort==="source"?(ascending?"▲":"▼"):"↕"}</button></th></tr></thead>
        <tbody>{visible.map(row => <tr key={row.id}>
          <th scope="row"><EntityRow identity={entityForAsset(row.symbol) || {kind: "asset", code: row.symbol}}
            title={row.label} subtitle={row.symbol + " · " + (row.researchRole ? "Research instrument" : row.type)} /></th>
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
            <span>{row.type === "Breadth" ? "External breadth chart · no verified reading" : row.researchRole && row.last === null ? "Public symbol catalogue · price unavailable/stale" : `${row.asOf ? `Observation: ${row.asOf}` : "Observation date unavailable"} · ${row.frequency} observation`}</span>
            {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName} · {row.type === "Breadth" ? "open chart ↗" : row.researchRole && row.last === null ? "source ↗" : "original data ↗"}</a>
              : <span>Original-source link unavailable</span>}
            <MarketObservationTakeaway row={row} window={window}/>
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
    <p className={styles.publicMarketNote}>1D/3D/5D are completed source sessions.
      Breadth moves use percentage points (pp), ETFs use percentage returns (%),
      and yields use basis points (bp). Missing observations are never filled in.</p>
    </details>
  </div>;
}
