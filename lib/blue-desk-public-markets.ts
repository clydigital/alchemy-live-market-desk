import type { MarketMonitorRow, MarketMonitorType } from "./market-monitor.ts";

/**
 * A deliberately narrow public projection of the existing market monitor.
 * No provider history, research triggers, scoring, or private reconciliation
 * are serialized to the public reader. No fresh market inference is generated.
 */
export const PUBLIC_MARKET_GROUPS = [
  { id: "all", label: "All markets" },
  { id: "ai", label: "AI & semiconductors" },
  { id: "rates", label: "Government rates" },
  { id: "energy", label: "Oil & energy" },
  { id: "fx", label: "Currencies" },
  { id: "credit", label: "Credit & risk" },
  { id: "equities", label: "Equities" },
  { id: "metals", label: "Metals" },
] as const;

export type PublicMarketGroup = typeof PUBLIC_MARKET_GROUPS[number]["id"];

export type PublicMarketObservation = {
  id: string;
  label: string;
  symbol: string;
  type: MarketMonitorType;
  last: number | null;
  change: number | null;
  changeUnit: "%" | "bp";
  asOf: string | null;
  frequency: "daily" | "monthly";
  sourceName: string;
  sourceUrl: string | null;
};

const MAX_PUBLIC_ROWS = 80;

export function publicMarketGroup(value: string | string[] | undefined): PublicMarketGroup {
  return typeof value === "string" && PUBLIC_MARKET_GROUPS.some(group => group.id === value)
    ? value as PublicMarketGroup : "all";
}

function includedType(type: MarketMonitorType, group: PublicMarketGroup): boolean {
  switch (group) {
    case "ai": return type === "AI / Semis";
    case "rates": return type === "Rates";
    case "energy": return type === "Energy";
    case "fx": return type === "FX";
    case "credit": return type === "Credit / Risk";
    case "equities": return ["Major Index", "MAG7", "Sector", "IPO / New Issue"].includes(type);
    case "metals": return type === "Metal";
    default: return true;
  }
}

function originalSourceUrl(value: string): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function finite(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function publicRow(row: MarketMonitorRow): PublicMarketObservation {
  const last = finite(row.last);
  const daily = row.frequency === "daily";
  const prev = finite(row.previousClose);
  const diff = row.type === "Rates"
    ? daily && last !== null && prev !== null ? (last - prev) * 100 : null
    : daily ? finite(row.dayChange) : null;
  return {
    id: row.id,
    label: row.label,
    symbol: row.symbol,
    type: row.type,
    last,
    change: diff !== null && Number.isFinite(diff) ? diff : null,
    changeUnit: row.type === "Rates" ? "bp" : "%",
    asOf: row.asOf,
    frequency: row.frequency,
    sourceName: row.sourceName,
    sourceUrl: originalSourceUrl(row.sourceUrl),
  };
}

export function publicMarketObservations(
  rows: readonly MarketMonitorRow[],
  group: PublicMarketGroup,
): PublicMarketObservation[] {
  return rows.filter(row => includedType(row.type, group))
    .slice(0, MAX_PUBLIC_ROWS).map(publicRow);
}

/**
 * Narrow public-history admission: only US Treasury nominal daily yields.
 * The broader public market projection still withholds Nasdaq/provider price
 * histories, raw monitor metrics and privately sourced time series.
 */
export type PublicGovernmentRateTrend = {
  id: string;
  label: string;
  symbol: string;
  sourceName: string;
  sourceUrl: string;
  asOf: string;
  frequency: "daily";
  points: Array<{ time: number; close: number }>;
};

const PUBLIC_NOMINAL_US_TREASURY = new Set(["us2y","us5y","us5y-fred","us10y","us10y-fred","us20y","us20y-fred","us30y","us30y-fred"]);
const FRED_NOMINAL_SERIES = new Set(["DGS2","DGS5","DGS10","DGS20","DGS30"]);

function publicNominalTreasurySource(row: MarketMonitorRow): boolean {
  if (row.frequency !== "daily" || row.type !== "Rates" || !PUBLIC_NOMINAL_US_TREASURY.has(row.id)) return false;
  if (row.sourceName === "U.S. Department of the Treasury") {
    return row.sourceUrl.startsWith("https://home.treasury.gov/");
  }
  if (row.sourceName === "Federal Reserve Economic Data"
    && FRED_NOMINAL_SERIES.has(row.symbol)) {
    return row.sourceUrl === "https://fred.stlouisfed.org/series/" + row.symbol;
  }
  return false;
}

export function publicGovernmentRateTrends(
  rows: readonly MarketMonitorRow[],
): PublicGovernmentRateTrend[] {
  return rows.filter(publicNominalTreasurySource)
    .map(row => {
      const cleanPoints = row.points.filter(point =>
        Number.isFinite(point.time) && Number.isFinite(point.close)
        && point.time > 0 && point.close >= 0,
      ).sort((a,b)=>a.time-b.time).slice(-64);
      if(cleanPoints.length<2)return null;
      return {
        id:row.id, label:row.label, symbol:row.symbol,
        sourceName:row.sourceName, sourceUrl:row.sourceUrl,
        asOf:new Date(cleanPoints[cleanPoints.length-1].time*1000).toISOString().slice(0,10),
        frequency:"daily" as const,points:cleanPoints.map(point=>({time:point.time,close:point.close})),
      };
    })
    .filter((row): row is PublicGovernmentRateTrend=>row!==null)
    .slice(0,7);
}
