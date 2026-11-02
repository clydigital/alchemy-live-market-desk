import type { PublicMarketObservation } from "./blue-desk-public-markets.ts";

/** Display-only market screener. All values retain their original source units. */
export type MarketChangeUnit = "all" | "%" | "bp" | "pp";
export type MarketChangeWindow = "1D" | "3D" | "5D";

export function publicMarketWindowChange(row: PublicMarketObservation, window: MarketChangeWindow): number | null {
  const value = window === "1D" ? row.change : window === "3D" ? row.change3d : row.change5d;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export type MarketChangeDirection = "all" | "up" | "down";
export type MarketChangeSort = "source" | "magnitude" | "gainers" | "losers" | "name";

export type PublicMarketFilters = {
  query: string;
  window: MarketChangeWindow;
  unit: MarketChangeUnit;
  direction: MarketChangeDirection;
  minMove: number;
  sort: MarketChangeSort;
};

export const DEFAULT_PUBLIC_MARKET_FILTERS: PublicMarketFilters = {
  query: "", window: "1D", unit: "all", direction: "all", minMove: 0, sort: "source",
};

export function filterPublicMarketObservations(
  rows: readonly PublicMarketObservation[],
  filters: PublicMarketFilters,
): PublicMarketObservation[] {
  const search = filters.query.trim().toLowerCase();
  // Invalid client inputs must not turn an unavailable observation into zero.
  const minimum = Number.isFinite(filters.minMove) && filters.minMove >= 0 ? filters.minMove : 0;
  const needsChange = minimum > 0 || filters.direction !== "all";

  const visible = rows.filter(row => {
    if (search && ![row.label, row.symbol, row.type].some(value => value.toLowerCase().includes(search))) return false;
    if (filters.unit !== "all" && row.changeUnit !== filters.unit) return false;
    if (!needsChange) return true;
    const change = publicMarketWindowChange(row, filters.window);
    if (change === null) return false;
    if (filters.direction === "up" && change <= 0) return false;
    if (filters.direction === "down" && change >= 0) return false;
    return Math.abs(change) >= minimum;
  });

  if (filters.sort === "source") return visible;
  const withUnitOrder = (a: PublicMarketObservation, b: PublicMarketObservation) => {
    const aChange = publicMarketWindowChange(a, filters.window);
    const bChange = publicMarketWindowChange(b, filters.window);
    if (aChange === null) return bChange === null ? a.label.localeCompare(b.label) : 1;
    if (bChange === null) return -1;
    // Never rank a 5 bp move against a 5% move as if the units were comparable.
    if (a.changeUnit !== b.changeUnit) return ({ "%":0, "pp":1, "bp":2 })[a.changeUnit] - ({ "%":0, "pp":1, "bp":2 })[b.changeUnit];
    const result = filters.sort === "magnitude" ? Math.abs(bChange) - Math.abs(aChange)
      : filters.sort === "gainers" ? bChange - aChange
      : aChange - bChange;
    return result || a.label.localeCompare(b.label);
  };
  if (filters.sort === "name") return [...visible].sort((a, b) => a.label.localeCompare(b.label));
  return [...visible].sort(withUnitOrder);
}


/** Read-only column sorting shared by the market table and regression tests.
 * Missing observations always trail real values. Percentage returns and yield
 * basis-point changes are never interleaved as directly comparable moves. */
export type MarketSortColumn = "instrument" | "last" | "1D" | "3D" | "5D" | "source";

export function sortPublicMarketColumns(
  rows: readonly PublicMarketObservation[],
  column: MarketSortColumn,
  ascending: boolean,
): PublicMarketObservation[] {
  const sign = ascending ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (column === "instrument" || column === "source") {
      const first = column === "instrument" ? a.label : a.sourceName;
      const second = column === "instrument" ? b.label : b.sourceName;
      return sign * first.localeCompare(second) || a.label.localeCompare(b.label);
    }
    const value = (row:PublicMarketObservation):number|null =>
      column === "last" ? row.last : publicMarketWindowChange(row, column);
    const av = value(a), bv = value(b);
    if (av === null || !Number.isFinite(av))
      return bv === null || !Number.isFinite(bv) ? a.label.localeCompare(b.label) : 1;
    if (bv === null || !Number.isFinite(bv)) return -1;
    if (column !== "last" && a.changeUnit !== b.changeUnit)
      return ({ "%":0, "pp":1, "bp":2 })[a.changeUnit] - ({ "%":0, "pp":1, "bp":2 })[b.changeUnit];
    return sign * (av - bv) || a.label.localeCompare(b.label);
  });
}

/** Sort the public ETF comparison independently from the advanced screener.
 * A missing observation or an unmatched RSP session stays last in either
 * direction; relative performance is only calculated for matching dates. */
export type EtfComparisonSortColumn = "instrument" | "sourceSession" | "1D" | "3D" | "5D" | "relative5D";

export function sortEtfComparisonRows(
  rows: readonly PublicMarketObservation[],
  column: EtfComparisonSortColumn,
  ascending: boolean,
  benchmark?: PublicMarketObservation,
): PublicMarketObservation[] {
  const sign = ascending ? 1 : -1;
  const benchmark5d = benchmark ? publicMarketWindowChange(benchmark, "5D") : null;
  const relative5d = (row: PublicMarketObservation): number | null => {
    const value = publicMarketWindowChange(row, "5D");
    return row.changeUnit === "%" && benchmark?.changeUnit === "%"
      && row.asOf && row.asOf === benchmark.asOf && value !== null && benchmark5d !== null
      ? value - benchmark5d : null;
  };
  return [...rows].sort((a, b) => {
    if (column === "instrument")
      return sign * a.symbol.localeCompare(b.symbol) || a.symbol.localeCompare(b.symbol);
    const av = column === "sourceSession" ? a.asOf || null
      : column === "relative5D" ? relative5d(a) : publicMarketWindowChange(a, column);
    const bv = column === "sourceSession" ? b.asOf || null
      : column === "relative5D" ? relative5d(b) : publicMarketWindowChange(b, column);
    if (av === null) return bv === null ? a.symbol.localeCompare(b.symbol) : 1;
    if (bv === null) return -1;
    const result = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sign * result || a.symbol.localeCompare(b.symbol);
  });
}
