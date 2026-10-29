"use client";

import { useMemo, useState } from "react";

import { EntityRow } from "@/components/blue-desk/EntityIdentity";
import { entityForAsset } from "@/lib/bluebelly-entity-identity";
import {
  DEFAULT_PUBLIC_MARKET_FILTERS,
  filterPublicMarketObservations,
  publicMarketWindowChange,
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

  const visible = useMemo(() => filterPublicMarketObservations(observations, {
    query, window, unit, direction, minMove: minimum, sort,
  }), [observations, query, window, unit, direction, minimum, sort]);

  function reset() {
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
    setSort(nextDirection === "down" ? "losers" : "magnitude");
  }

  return <div data-market-change-screener="read-only">
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
          <select aria-label="Screen and sort period" value={window} onChange={event => setWindow(event.target.value as MarketChangeWindow)}>
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
          <select value={sort} onChange={event => setSort(event.target.value as MarketChangeSort)}>
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
        <thead><tr><th scope="col">Instrument</th><th scope="col">Last observed</th>
          {(["1D", "3D", "5D"] as const).map(period => <th scope="col" key={period} data-selected={period === window}>{period} change</th>)}
          <th scope="col">Source and vintage</th></tr></thead>
        <tbody>{visible.map(row => <tr key={row.id}>
          <th scope="row"><EntityRow identity={entityForAsset(row.symbol) || {kind: "asset", code: row.symbol}}
            title={row.label} subtitle={row.symbol + " · " + row.type} /></th>
          <td className={styles.publicMarketNumber}>{level(row)}</td>
          {(["1D", "3D", "5D"] as const).map(period => {
            const value = publicMarketWindowChange(row, period);
            return <td key={period} className={styles.publicMarketNumber} data-selected={period === window}
              data-direction={value === null ? "unknown" : value > 0 ? "up" : value < 0 ? "down" : "flat"}
              title={value === null ? `${period} source-session change unavailable` : `${period} change through ${row.asOf || "unknown source date"}`}>
              {change(value, row.changeUnit)}
            </td>;
          })}
          <td className={styles.publicMarketSource}>
            <span>{row.asOf ? `Observation: ${row.asOf}` : "Observation date unavailable"} · {row.frequency} observation</span>
            {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName} · original data ↗</a>
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
    <p className={styles.publicMarketNote}>Change periods: 1, 3 and 5 source sessions, measured through each instrument's observation date. Rates in bp; others in %. Monthly yields show levels only. Data may lag.</p>
  </div>;
}
