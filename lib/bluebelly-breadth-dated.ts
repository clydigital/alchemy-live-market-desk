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

// Current upstream layout publishes a cross-universe table rather than the
// previous individual chart headings. Read only the named columns and the
// source's stated close date. Russell 2000-style is a proxy, not R2FI/R2TH.
const PROXY_SOURCE="https://www.thetrading.tools/stocks-above-moving-average";
const PROXY_NAME="thetrading.tools · current-member moving-average breadth proxy";
function tableText(html:string):string{
 return html.replace(/<[^>]+>/g," ").replace(/&amp;/gi,"&").replace(/&nbsp;|&#160;/gi," ").replace(/\s+/g," ").trim();
}
function tableRows(html:string):string[][]{
 return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>tableText(c[1])));
}
export function parseCurrentBreadthTable(html:string,now=new Date()):BreadthSeries[]|null{
 if(!html||html.length>6000000)return null;
 const clean=tableText(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," "));
 const date=clean.match(/(?:Updated daily after close\s*[·|]?\s*as of|Data as of)\s*(20\d{2}-\d{2}-\d{2})/i)?.[1];
 if(!date||!sourceDateFresh(date,now))return null;
 for(const t of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const rows=tableRows(t[1]);const head=rows.find(r=>r.some(c=>/S&P 500 Members/i.test(c))&&r.some(c=>/Nasdaq-100 Members/i.test(c)));
  if(!head)continue;
  const columns=[{col:head.findIndex(c=>/S&P 500 Members/i.test(c)),symbols:{50:"S5FI",100:"S5OH",200:"S5TH"}},
   {col:head.findIndex(c=>/Nasdaq-100 Members/i.test(c)),symbols:{50:"NDFI",200:"NDTH"}},
   {col:head.findIndex(c=>/Russell 2000.Style Stocks/i.test(c)),symbols:{50:"R2FI",200:"R2TH"}}] as const;
  const out:BreadthSeries[]=[];
  for(const {col,symbols} of columns)for(const [horizon,symbol] of Object.entries(symbols)){
   const row=rows.find(r=>new RegExp("^"+horizon+"[ -]Day average","i").test(r[0]||""));
   const val=row?.[col]?.match(/^(\d{1,3}(?:\.\d+)?)\s*%$/);
   if(!val||Number(val[1])>100)continue;
   out.push({symbol,sourceUrl:PROXY_SOURCE,sourceName:symbol.startsWith("R2")?"thetrading.tools · Russell 2000-style stocks proxy (not the official index)":PROXY_NAME,points:[{date,value:Number(val[1])}]});
  }
  if(out.some(r=>r.symbol==="S5FI")&&out.some(r=>r.symbol==="S5TH"))return out;
 }
 return null;
}
// Independent secondary historical index closes. The first numeric cell after
// each date is the close/Price column, not the provider's percent return.
export function parseBreadthHistoricalTable(html:string,symbol:string,sourceUrl:string,now=new Date()):BreadthSeries|null{
 if(!html||html.length>6000000)return null;
 for(const t of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const rows=tableRows(t[1]);const header=rows.find(r=>/^Date$/i.test(r[0]||"")&&/^Price$/i.test(r[1]||""));
  if(!header)continue;
  const points:BreadthPoint[]=[];
  for(const r of rows){
   const m=r[0]?.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(20\d{2})$/i);
   if(!m||!/^\d{1,3}(?:\.\d+)?$/.test(r[1]||""))continue;
   const month=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[1].toLowerCase())+1;
   const date=m[3]+"-"+String(month).padStart(2,"0")+"-"+m[2].padStart(2,"0");
   const epoch=Date.parse(date+"T00:00:00Z"),value=Number(r[1]);
   if(!Number.isFinite(epoch)||new Date(epoch).toISOString().slice(0,10)!==date||epoch>+now||value>100)continue;
   points.push({date,value});
  }
  const unique=[...new Map(points.map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(unique.length>=2&&sourceDateFresh(unique.at(-1)!.date,now))return {symbol,sourceUrl,sourceName:"Investing.com historical index levels · secondary provider",points:unique.slice(-12)};
 }
 return null;
}
// Reviewed source snapshot, not a live quote. Freshness gate expires it.
export const REVIEWED_BREADTH_PROXY_SNAPSHOT:BreadthSeries[]=[
 ["S5FI",52.3],["S5OH",46.3],["S5TH",52.8],["NDFI",42.0],["NDTH",43.4],["R2FI",29.4],["R2TH",34.0],
].map(([symbol,value])=>({symbol:String(symbol),sourceUrl:PROXY_SOURCE,sourceName:String(symbol).startsWith("R2")?"thetrading.tools · Russell 2000-style stocks proxy (not the official index)":PROXY_NAME,points:[{date:"2026-11-23",value:Number(value)}]}));

/** Publicly documented daily research dataset. Read only its latest contiguous
 * sessions, without merging current-member proxies with official index closes.
 * Access to the resulting history is restricted by the server reader. */
export const BREADTH_HISTORY_URL="https://www.thetrading.tools/data/market_breadth/market_breadth.json";
const HISTORY_FIELDS=[
 ["S5FI","spx_pct_above_50d"],["S5OH","spx_pct_above_100d"],["S5TH","spx_pct_above_200d"],
 ["NDFI","ndx_pct_above_50d"],["NDTH","ndx_pct_above_200d"],
 ["R2FI","r2k_pct_above_50d"],["R2TH","r2k_pct_above_200d"],
] as const;
export function parseBreadthDailyDataset(json:unknown,now=new Date()):BreadthSeries[]{
 if(!json||typeof json!=="object"||!("data" in json)||!Array.isArray(json.data)||json.data.length>15000)return [];
 const records=new Map<string,Record<string,unknown>>();
 for(const record of json.data){
  if(!record||typeof record!=="object"||typeof record.date!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(record.date))continue;
  const stamp=Date.parse(record.date+"T00:00:00Z");
  if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==record.date||stamp>+now)continue;
  records.set(record.date,record);
 }
 const recent=[...records].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
 const latest=recent.at(-1)?.[0];
 if(!latest||!sourceDateFresh(latest,now))return [];
 return HISTORY_FIELDS.flatMap(([symbol,key])=>{
  const points:BreadthPoint[]=[];
  for(let i=recent.length-1;i>=0;i--){
   const [date,row]=recent[i],v=row[key];
   if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>100)break;
   points.unshift({date,value:v});
  }
  if(!points.length)return [];
  return [{symbol,sourceUrl:BREADTH_HISTORY_URL,sourceName:symbol.startsWith("R2")?"thetrading.tools · Russell 2000-style historical research proxy":PROXY_NAME,points}];
 });
}
