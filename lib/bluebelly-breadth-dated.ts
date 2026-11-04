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
  /** Source-reported 5-session pp change; never treated as 1D or 3D. */
  reportedChange5d?:number;
};

export const REVIEWED_BREADTH_SEED: BreadthSeries[] = SERIES.map(item => ({
  symbol:item.symbol, sourceUrl:item.sourceUrl,
  sourceName:"Investing.com historical index levels · secondary provider",
  points:item.points.map(([date,value])=>({date,value})),
}));


/** A separate provider's computed current-member S&P 500 breadth proxies.
 * These values are NOT the identically named Investing.com S5FI/S5TH index
 * closes. The provider reports 5D changes but not matching 1D/3D history. */
export function parsePublishedSp500Breadth(html:string,now=new Date()):BreadthSeries[]|null {
  if(!html || html.length>6000000)return null;
  const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&").replace(/\s+/g," ");
  const start=clean.indexOf("S&P 500 Members: % Above the 50 & 200-Day Averages vs SPY");
  if(start<0)return null;
  const end=clean.indexOf("Nasdaq-100 Members:",start+60);
  if(end<0 || end-start>2500)return null;
  const section=clean.slice(start,end);
  const stamp=section.match(/Latest\s*[·|]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(20\d{2})\s*[·|]\s*SPY/i);
  if(!stamp)return null;
  const month=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(stamp[1].toLowerCase())+1;
  const date=stamp[3]+"-"+String(month).padStart(2,"0")+"-"+String(Number(stamp[2])).padStart(2,"0");
  const epoch=Date.parse(date+"T00:00:00Z");
  if(!Number.isFinite(epoch) || new Date(epoch).toISOString().slice(0,10)!==date
    || !sourceDateFresh(date,now))return null;
  const read=(horizon:"50"|"200",kind:"Swing"|"Regime")=>{
    const rx=new RegExp("\\b"+horizon+"d\\s*[·|-]\\s*"+kind+"\\s*(\\d{1,3}(?:\\.\\d+)?)\\s*%\\s*([+-]\\d{1,3}(?:\\.\\d+)?)\\s*\\/\\s*5d","i");
    const found=section.match(rx);
    if(!found)return null;
    const level=Number(found[1]),delta=Number(found[2]);
    if(level<0||level>100||!Number.isFinite(level)||Math.abs(delta)>100
      ||!Number.isFinite(delta)||level-delta<0||level-delta>100)return null;
    return {level,delta};
  };
  const short=read("50","Swing"),long=read("200","Regime");
  if(!short||!long)return null;
  const sourceUrl="https://www.thetrading.tools/stocks-above-moving-average";
  const sourceName="thetrading.tools · computed current-member S&P 500 breadth proxy";
  return [
    {symbol:"S5FI",sourceUrl,sourceName,points:[{date,value:short.level}],reportedChange5d:short.delta},
    {symbol:"S5TH",sourceUrl,sourceName,points:[{date,value:long.level}],reportedChange5d:long.delta},
  ];
}

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
    change:change(1), change3d:change(3),
    change5d:change(5) ?? (sourceEligible && source?.reportedChange5d!==undefined
      && Number.isFinite(source.reportedChange5d) ? source.reportedChange5d : null),
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
