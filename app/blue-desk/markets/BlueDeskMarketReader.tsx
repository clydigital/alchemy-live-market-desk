"use client";

import { useMemo, useState } from "react";

import type { PublicMarketObservation } from "@/lib/blue-desk-public-markets";
import ui from "./markets-reader.module.css";
import { displayedMarketChange, marketMovementDirection } from "./market-direction";

type Direction = "all" | "up" | "down" | "quiet";
type Frequency = "all" | "daily" | "monthly";
type Order = "source" | "name" | "newest";

function level(row: PublicMarketObservation): string {
  if (row.last === null) return "Unavailable";
  const value = row.last.toLocaleString("en-GB", {
    maximumFractionDigits: Math.abs(row.last) >= 1000 ? 1 : 3,
  });
  // The existing monitor reports government rates as percentage yields.
  return row.type === "Rates" ? value + "%" : value;
}

function movement(row: PublicMarketObservation) {
  const displayed = displayedMarketChange(row.change);
  if (displayed === null) return { label: "Not available", glyph: "–", className: ui.neutral };
  const unit = row.changeUnit === "bp" ? " bp" : "%";
  const value = (displayed > 0 ? "+" : "") + displayed.toFixed(2) + unit;
  const direction = marketMovementDirection(row.change);
  if (direction === "up") return { label: value, glyph: "↑", className: ui.up };
  if (direction === "down") return { label: value, glyph: "↓", className: ui.down };
  return { label: value, glyph: "→", className: ui.neutral };
}

function dateValue(asOf: string | null) {
  if (!asOf) return -Infinity;
  const timestamp = Date.parse(asOf);
  return Number.isFinite(timestamp) ? timestamp : -Infinity;
}

/**
 * Presentation-only controls over the already bounded public server projection.
 * Never requests raw market monitor data, provider history, or owner research.
 */
export default function BlueDeskMarketReader({ observations }: {
  observations: readonly PublicMarketObservation[];
}) {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<Direction>("all");
  const [frequency, setFrequency] = useState<Frequency>("all");
  const [order, setOrder] = useState<Order>("source");

  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("en-GB");
    const filtered = observations.filter(row => {
      if (needle && ![row.label, row.symbol, row.type, row.sourceName]
        .join(" ").toLocaleLowerCase("en-GB").includes(needle)) return false;
      if (frequency !== "all" && row.frequency !== frequency) return false;
      if (direction !== "all" && marketMovementDirection(row.change) !== direction) return false;
      return true;
    });
    if (order === "name") filtered.sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
    if (order === "newest") filtered.sort((a, b) => dateValue(b.asOf) - dateValue(a.asOf));
    return filtered;
  }, [observations, search, direction, frequency, order]);

  const reset = () => {
    setSearch("");
    setDirection("all");
    setFrequency("all");
    setOrder("source");
  };

  return (
    <div className={ui.reader}>
      <fieldset className={ui.toolbar}>
        <legend className={ui.visuallyHidden}>Filter public market observations</legend>
        <label className={ui.searchField}>
          <span>Find an instrument</span>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Name, ticker, source…"
            autoComplete="off"
          />
        </label>
        <label>
          <span>Observed direction</span>
          <select value={direction} onChange={event => setDirection(event.target.value as Direction)}>
            <option value="all">All directions</option>
            <option value="up">Up ↑</option>
            <option value="down">Down ↓</option>
            <option value="quiet">Flat / not reported</option>
          </select>
        </label>
        <label>
          <span>Frequency</span>
          <select value={frequency} onChange={event => setFrequency(event.target.value as Frequency)}>
            <option value="all">All frequencies</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>
          <span>Order by</span>
          <select value={order} onChange={event => setOrder(event.target.value as Order)}>
            <option value="source">Source order</option>
            <option value="name">Instrument A–Z</option>
            <option value="newest">Newest observation</option>
          </select>
        </label>
      </fieldset>

      <div className={ui.resultLine}>
        <p role="status" aria-live="polite">
          <strong>{rows.length}</strong> of {observations.length} source records shown
        </p>
        <button className={ui.reset} type="button" onClick={reset}>Clear filters</button>
      </div>

      {rows.length ? (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <caption className={ui.visuallyHidden}>
              Source-dated public market observations. Up and down denote the measured change,
              not a bullish or bearish verdict.
            </caption>
            <thead>
              <tr>
                <th scope="col">Instrument</th>
                <th scope="col">Last observed</th>
                <th scope="col">Session change</th>
                <th scope="col">Source and vintage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const change = movement(row);
                return (
                  <tr key={row.id}>
                    <th scope="row" className={ui.instrument}>
                      <strong>{row.label}</strong>
                      <span>{row.symbol} · {row.type}</span>
                    </th>
                    <td className={ui.number}>{level(row)}</td>
                    <td className={ui.number}>
                      <span className={change.className}>
                        <span aria-hidden="true">{change.glyph}</span>
                        <span>{change.label}</span>
                      </span>
                    </td>
                    <td className={ui.source}>
                      <span>{row.asOf ? "Observation: " + row.asOf : "Observation date unavailable"} · {row.frequency} observation</span>
                      {row.sourceUrl ? (
                        <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                          {row.sourceName} · original data ↗
                        </a>
                      ) : <span>Original-source link unavailable</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={ui.noMatches} role="status">
          No observations match these filters. The underlying source data has not changed.
        </div>
      )}
      <p className={ui.meaning}>
        Arrows describe an observed price or yield direction only. Monthly and missing daily
        changes are not inferred. Sorting does not rank unlike basis-point and percentage moves.
      </p>
    </div>
  );
}
