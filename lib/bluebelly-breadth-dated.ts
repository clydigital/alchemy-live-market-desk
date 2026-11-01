import type { PublicMarketObservation } from "./blue-desk-public-markets";

// Source-reviewed 30 October 2026 end-of-session baseline; never substitute
// these values for a newer session or present them without their source date.
// 1D/3D/5D are percentage-POINT moves in breadth participation.
const SERIES = [
  {
    symbol: "S5FI",
    sourceUrl: "https://www.investing.com/indices/s-p-500-stocks-above-50-day-average-historical-data",
    points: [
      ["2026-10-23", 58.05], ["2026-10-26", 59.44], ["2026-10-27", 60.23],
      ["2026-10-28", 58.44], ["2026-10-29", 65.00], ["2026-10-30", 60.23],
    ],
  },
  {
    symbol: "S5TH",
    sourceUrl: "https://www.investing.com/indices/sp-500-stocks-above-200-day-average-historical-data",
    points: [
      ["2026-10-23", 56.06], ["2026-10-26", 58.05], ["2026-10-27", 59.24],
      ["2026-10-28", 58.25], ["2026-10-29", 63.81], ["2026-10-30", 59.44],
    ],
  },
] as const;

export type BreadthPoint = {date: string; value: number};
export type BreadthSeries = {
  symbol: string; sourceUrl: string; sourceName: string; points: BreadthPoint[];
};

export const REVIEWED_BREADTH_SEED: BreadthSeries[] = SERIES.map(item => ({
  symbol:item.symbol, sourceUrl:item.sourceUrl,
  sourceName:"Investing.com historical index levels · secondary provider",
  points:item.points.map(([date,value])=>({date,value})),
}));

export function sourceDateFresh(date: string, now = new Date()): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return false;
  const stamp = Date.parse(date + "T00:00:00Z");
  const today = Date.parse(now.toISOString().slice(0,10) + "T00:00:00Z");
  if (!Number.isFinite(stamp) || stamp > today) return false;
  // Allow two completed weekdays of publication delay, not an indefinite carry.
  let weekdays = 0;
  for (let day = stamp + 86400000; day <= today; day += 86400000) {
    const weekday = new Date(day).getUTCDay();
    if (weekday !== 0 && weekday !== 6) weekdays++;
  }
  return weekdays <= 2;
}

export function calculateBreadthRow(
  symbol: string,
  label: string,
  source: BreadthSeries | undefined,
  now = new Date(),
): PublicMarketObservation {
  const pts = [...(source?.points ?? [])]
    .filter(p=>/^20\d{2}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value) && p.value>=0 && p.value<=100)
    .sort((a,b)=>a.date.localeCompare(b.date));
  const unique = pts.filter((p,i)=>i===0 || p.date!==pts[i-1].date);
  const last = unique.at(-1);
  const sourceEligible = Boolean(last && sourceDateFresh(last.date,now));
  const change = (sessions: number) => {
    const earlier = unique.at(-(sessions + 1));
    return sourceEligible && earlier && last ? Number((last.value - earlier.value).toFixed(2)) : null;
  };
  return {
    id:"breadth:"+symbol, symbol, label, type:"Breadth",
    last:sourceEligible ? last!.value : null,
    change:change(1), change3d:change(3), change5d:change(5),
    changeUnit:"pp", frequency:"daily",
    asOf:last?.date ?? null,
    sourceName:source?.sourceName || "Breadth provider unavailable",
    sourceUrl:source?.sourceUrl || "https://www.tradingview.com/chart/?symbol=INDEX%3A"+symbol,
    dataStatus:sourceEligible?"SOURCE_DATED_SECONDARY":"UNAVAILABLE_OR_STALE",
  };
}

export function marketParticipationResearch(
  rows: readonly PublicMarketObservation[],
): { status: "ready"|"insufficient"; headline: string; interpretation: string; nextTest: string; asOf: string | null } {
  const at = (symbol:string)=>rows.find(r=>r.symbol===symbol);
  const f=at("S5FI"), t=at("S5TH"), rsp=at("RSP"), smh=at("SMH");
  if (!f?.asOf || f.asOf!==t?.asOf || f.change5d===null || t.change5d===null
    || f.dataStatus!=="SOURCE_DATED_SECONDARY" || t.dataStatus!=="SOURCE_DATED_SECONDARY") {
    return {status:"insufficient",headline:"Breadth confirmation unavailable",
      interpretation:"Do not infer market participation from a chart link, an old snapshot, or a partial basket.",
      nextTest:"Obtain updated S5FI/S5TH source-dated closes and matched RSP, SPY, SMH observations.",asOf:null};
  }
  const short=f.change5d, long=t.change5d;
  const isWidening=short>0 && long>0;
  const isWeakening=short<0 && long<0;
  const headline=isWidening?"Participation broadening":isWeakening?"Participation contracting":"Mixed breadth across horizons";
  const peers = rsp?.asOf===f.asOf && smh?.asOf===f.asOf && rsp.change5d!==null && smh.change5d!==null
    ? ` Matched five-session RSP ${rsp.change5d! >= 0 ? "+" : ""}${rsp.change5d!.toFixed(2)}%; SMH ${smh.change5d! >= 0 ? "+" : ""}${smh.change5d!.toFixed(2)}%.`
    : " ETF 5D confirmation not on the same source date; do not claim alignment.";
  return {
    status:"ready", headline,
    interpretation:`S5FI ${short>=0?"+":""}${short.toFixed(2)} pp and S5TH ${long>=0?"+":""}${long.toFixed(2)} pp over five completed sessions.${peers} This is a research diagnostic, not an admitted Regime or trade trigger.`,
    nextTest:"Compare S5FI/S5TH direction with equal-weight RSP vs SPY and SMH/SOXX; validate the next completed session and credit spreads before promoting a market-wide claim.",
    asOf:f.asOf,
  };
}
