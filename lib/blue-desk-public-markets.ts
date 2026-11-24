import type { MarketMonitorRow, MarketMonitorType } from "./market-monitor.ts";
import { scheduledUsEquityCloseHourET } from "./bluebelly-us-equity-trading-calendar.ts";
import type { MarketSignalSnapshot } from "./bluebelly-signal-scan";

/**
 * A deliberately narrow public projection of the existing market monitor.
 * No provider history, research triggers, scoring, or private reconciliation
 * are serialized to the public reader. No fresh market inference is generated.
 */
export const PUBLIC_MARKET_GROUPS = [
  { id: "all", label: "All markets" },
  { id: "ai", label: "AI & semiconductors" },
  { id: "breadth", label: "Market breadth" },
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
  type: MarketMonitorType | "Breadth";
  /** Generic public market research grouping, never private portfolio membership. */
  researchRole?: "research";
  researchAsOf?: string | null;
  last: number | null;
  /** Change over the latest 1, 3 and 5 available daily trading sessions. */
  change: number | null;
  change3d: number | null;
  change5d: number | null;
  changeUnit: "%" | "bp" | "pp";
  dataStatus?: "SOURCE_DATED_SECONDARY" | "UNAVAILABLE_OR_STALE";
  asOf: string | null;
  frequency: "daily" | "monthly";
  sourceName: string;
  sourceUrl: string | null;
  currency?: string | null;
  screening?: MarketSignalSnapshot | null;
};


export function publicMarketGroup(value: string | string[] | undefined): PublicMarketGroup {
  return typeof value === "string" && PUBLIC_MARKET_GROUPS.some(group => group.id === value)
    ? value as PublicMarketGroup : "all";
}

function includedType(type: MarketMonitorType, group: PublicMarketGroup): boolean {
  switch (group) {
    case "ai": return type === "AI / Semis";
    case "breadth": return false; // Breadth is externally linked, not a measured price type.
    case "rates": return type === "Rates" || type === "Bond ETF";
    case "energy": return type === "Energy";
    case "fx": return type === "FX";
    case "credit": return type === "Credit / Risk";
    case "equities": return ["Major Index", "MAG7", "Sector", "IPO / New Issue", "US Stock", "Europe Stock"].includes(type);
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

/** Yield levels are percentages; differences between source sessions are basis points.
 * Calculate only the aggregate change. Never send private provider history to the browser. */
function rateSessionChangeBp(row: MarketMonitorRow, sessions: 3 | 5): number | null {
  if (row.frequency !== "daily" || row.last === null || !Number.isFinite(row.last)) return null;
  const points = row.points.filter(point => Number.isFinite(point.time) && Number.isFinite(point.close))
    .sort((a, b) => a.time - b.time);
  if (points.length <= sessions) return null;
  const last = points.at(-1)!;
  const prior = points.at(-(sessions + 1))!;
  if (Math.abs(last.close - row.last) > 0.000001 || last.time <= prior.time) return null;
  const bp = (last.close - prior.close) * 100;
  return Number.isFinite(bp) ? Number(bp.toFixed(2)) : null;
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
    change3d: daily ? row.type === "Rates" ? rateSessionChangeBp(row, 3) : finite(row.change3d) : null,
    change5d: daily ? row.type === "Rates" ? rateSessionChangeBp(row, 5) : finite(row.change5d) : null,
    changeUnit: row.type === "Rates" ? "bp" : "%",
    asOf: row.asOf,
    frequency: row.frequency,
    ...(row.sourceName==="Yahoo Finance public daily chart (secondary; delayed)"
      ?{dataStatus:"SOURCE_DATED_SECONDARY" as const}:{}),
    sourceName: row.sourceName,
    sourceUrl: originalSourceUrl(row.sourceUrl),
    currency: row.currency ?? null,
    screening: daily && row.type !== "Rates" ? row.screening ?? null : null,
  };
}

export function publicMarketObservations(
  rows: readonly MarketMonitorRow[],
  group: PublicMarketGroup,
): PublicMarketObservation[] {
  return rows.filter(row => includedType(row.type, group)).map(publicRow);
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

/** Server-side bounded aggregate-only sector session candidates; no raw candles exported. */
export function publicSectorSessionObservations(rows:readonly MarketMonitorRow[],expected:string|null):PublicMarketObservation[]{
 if(!expected)return [];
 const symbols=new Set(["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"]);
 const result:PublicMarketObservation[]=[];
 for(const row of rows){
  if(row.type!=="Sector"||row.frequency!=="daily"||!symbols.has(row.symbol))continue;
  const projected=publicRow(row);
  if(!projected.sourceUrl)continue;
  const byDay=new Map<string,number>();
  for(const p of row.points){
   if(!Number.isFinite(p.time)||p.time<=0||!Number.isFinite(p.close)||p.close<=0)continue;
   const day=new Date(p.time*1000).toISOString().slice(0,10);
   if(day<=expected&&scheduledUsEquityCloseHourET(day)!==null)byDay.set(day,p.close);
  }
  const priorDay=(day:string)=>{
   let t=Date.parse(day+"T00:00:00Z");
   for(let j=0;j<10;j++){t-=86400000;const d=new Date(t).toISOString().slice(0,10);if(scheduledUsEquityCloseHourET(d)!==null)return d;}
   return null;
  };
  for(const day of [...byDay.keys()].sort().slice(-15)){
   const prior=priorDay(day),prev=prior?byDay.get(prior):undefined,last=byDay.get(day)!;
   if(prev===undefined)continue;
   result.push({...projected,asOf:day,last,change:(last/prev-1)*100,change3d:null,change5d:null,screening:null});
  }
 }
 return result;
}
