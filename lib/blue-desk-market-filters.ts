import type { PublicMarketObservation } from "./blue-desk-public-markets.ts";

/** Display-only market screener. All values retain their original source units. */
export type MarketChangeUnit = "all" | "%" | "bp";
export type MarketChangeDirection = "all" | "up" | "down";
export type MarketChangeSort = "source" | "magnitude" | "gainers" | "losers" | "name";

export type PublicMarketFilters = {
  query: string;
  unit: MarketChangeUnit;
  direction: MarketChangeDirection;
  minMove: number;
  sort: MarketChangeSort;
};

export const DEFAULT_PUBLIC_MARKET_FILTERS: PublicMarketFilters = {
  query: "", unit: "all", direction: "all", minMove: 0, sort: "source",
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
    if (row.change === null || !Number.isFinite(row.change)) return false;
    if (filters.direction === "up" && row.change <= 0) return false;
    if (filters.direction === "down" && row.change >= 0) return false;
    return Math.abs(row.change) >= minimum;
  });

  if (filters.sort === "source") return visible;
  const withUnitOrder = (a: PublicMarketObservation, b: PublicMarketObservation) => {
    const aChange = a.change !== null && Number.isFinite(a.change) ? a.change : null;
    const bChange = b.change !== null && Number.isFinite(b.change) ? b.change : null;
    if (aChange === null) return bChange === null ? a.label.localeCompare(b.label) : 1;
    if (bChange === null) return -1;
    // Never rank a 5 bp move against a 5% move as if the units were comparable.
    if (a.changeUnit !== b.changeUnit) return a.changeUnit === "%" ? -1 : 1;
    const result = filters.sort === "magnitude" ? Math.abs(bChange) - Math.abs(aChange)
      : filters.sort === "gainers" ? bChange - aChange
      : aChange - bChange;
    return result || a.label.localeCompare(b.label);
  };
  if (filters.sort === "name") return [...visible].sort((a, b) => a.label.localeCompare(b.label));
  return [...visible].sort(withUnitOrder);
}
