import type { MarketMonitorRow, MarketMonitorType } from "./market-monitor.ts";

/**
 * A deliberately narrow public projection of the existing market monitor.
 * No provider history, research triggers, scoring, or private reconciliation
 * are serialized to the public reader. No fresh market inference is generated.
 */
export const PUBLIC_MARKET_GROUPS = [
  { id: "all", label: "All markets" },
  { id: "ai", label: "AI & semiconductors" },
  { id: "rates", label: "Rates & bond ETFs" },
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
  levelUnit: "%" | "native";
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
    case "rates": return type === "Rates" || type === "Bond ETF";
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
  // MOVE is an index, not a yield; HYG/LQD are ETF prices, not credit OAS.
  const percentLevel = (row.type === "Rates" && row.id !== "move")
    || row.id === "hy-oas" || row.id === "ig-oas";
  const diff = percentLevel
    ? daily && last !== null && prev !== null ? (last - prev) * 100 : null
    : daily ? finite(row.dayChange) : null;
  return {
    id: row.id,
    label: row.label,
    symbol: row.symbol,
    type: row.type,
    last,
    change: diff !== null && Number.isFinite(diff) ? diff : null,
    changeUnit: percentLevel ? "bp" : "%",
    levelUnit: percentLevel ? "%" : "native",
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
  /** Plain-language classification; the underlying series remains source-dated. */
  kind?: "Nominal Treasury yield" | "Real Treasury yield" | "Inflation breakeven" | "Credit OAS" | "Treasury curve spread";
  displayUnit?: "%" | "bp";
  secondSourceUrl?: string;
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

/**
 * Public chart history is restricted to an exact allowlist of official US
 * rates/credit series. It never includes Nasdaq equity, ETF or FX price history.
 * A curve is calculated only from two official observations on the SAME date.
 */
const PUBLIC_OFFICIAL_MACRO_SERIES = {
  "us5y-real": { symbol:"DFII5", type:"Rates", kind:"Real Treasury yield" },
  "us10y-real": { symbol:"DFII10", type:"Rates", kind:"Real Treasury yield" },
  "us5y-breakeven": { symbol:"T5YIE", type:"Rates", kind:"Inflation breakeven" },
  "us10y-breakeven": { symbol:"T10YIE", type:"Rates", kind:"Inflation breakeven" },
  "hy-oas": { symbol:"BAMLH0A0HYM2", type:"Credit / Risk", kind:"Credit OAS" },
  "ig-oas": { symbol:"BAMLC0A0CM", type:"Credit / Risk", kind:"Credit OAS" },
} as const;

type OfficialKind = NonNullable<PublicGovernmentRateTrend["kind"]>;
function officialObservations(row:MarketMonitorRow) {
  const seen=new Set<number>();
  return row.points.filter(point=>Number.isFinite(point.time) && point.time>0
    && Number.isFinite(point.close))
    .sort((a,b)=>b.time-a.time).filter(point=>{
      if(seen.has(point.time))return false;
      seen.add(point.time);return true;
    }).slice(0,64).reverse().map(point=>({time:point.time,close:point.close}));
}

function additionalOfficialSeries(rows:readonly MarketMonitorRow[]):PublicGovernmentRateTrend[] {
  return rows.flatMap(row=>{
    const match=PUBLIC_OFFICIAL_MACRO_SERIES[row.id as keyof typeof PUBLIC_OFFICIAL_MACRO_SERIES];
    if(!match || row.type!==match.type || row.symbol!==match.symbol
      || row.frequency!=="daily" || row.sourceName!=="Federal Reserve Economic Data"
      || row.sourceUrl!=="https://fred.stlouisfed.org/series/"+match.symbol)return [];
    const points=officialObservations(row).filter(point=>match.kind!=="Credit OAS" || point.close>=0);
    if(points.length<2)return [];
    return [{
      id:row.id,label:row.label,symbol:row.symbol,sourceName:row.sourceName,
      sourceUrl:row.sourceUrl,asOf:new Date(points.at(-1)!.time*1000).toISOString().slice(0,10),
      frequency:"daily" as const,points,kind:match.kind as OfficialKind,displayUnit:"%" as const,
    }];
  });
}

function officialCurveSpread(
  nominal:readonly PublicGovernmentRateTrend[], longerId:string,
  id:string, label:string,
):PublicGovernmentRateTrend|null {
  const shorter=nominal.find(row=>row.id==="us2y");
  const longer=nominal.find(row=>row.id===longerId);
  if(!shorter || !longer)return null;
  const shortByTime=new Map(shorter.points.map(point=>[point.time,point.close]));
  const points=longer.points.flatMap(point=>{
    const front=shortByTime.get(point.time);
    return front===undefined ? [] : [{time:point.time,close:Number((point.close-front).toFixed(5))}];
  }).slice(-64);
  if(points.length<2)return null;
  return {
    id,label,symbol:id.toUpperCase(),kind:"Treasury curve spread",
    displayUnit:"bp", sourceName:"Derived from official nominal Treasury observations",
    sourceUrl:longer.sourceUrl,secondSourceUrl:shorter.sourceUrl,
    frequency:"daily",points,
    asOf:new Date(points.at(-1)!.time*1000).toISOString().slice(0,10),
  };
}

export function publicOfficialMacroTrends(
  rows:readonly MarketMonitorRow[],group:PublicMarketGroup="all",
):PublicGovernmentRateTrend[] {
  if(!["all","rates","credit"].includes(group))return [];
  const nominal=publicGovernmentRateTrends(rows).map(row=>({
    ...row,kind:"Nominal Treasury yield" as const,displayUnit:"%" as const,
  }));
  const additional=additionalOfficialSeries(rows);
  const curve=[
    officialCurveSpread(nominal,"us10y-fred","us2s10s","US 2Y–10Y Treasury spread"),
    officialCurveSpread(nominal,"us30y-fred","us2s30s","US 2Y–30Y Treasury spread · GOLD IDEA"),
  ].filter((row):row is PublicGovernmentRateTrend=>row!==null);
  const rates=[...nominal,...curve,...additional.filter(row=>row.kind!=="Credit OAS")];
  const credit=additional.filter(row=>row.kind==="Credit OAS");
  return group==="rates"?rates:group==="credit"?credit:[...rates,...credit];
}
