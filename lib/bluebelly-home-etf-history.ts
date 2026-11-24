import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session.ts";
import {scheduledUsEquityCloseHourET} from "./bluebelly-us-equity-trading-calendar.ts";

/** Bounded delayed secondary fallback for the existing homepage ETF tape only.
 * Replace a whole history; never splice providers or infer a missing close. */
export const XL_FALLBACK_ETFS = ["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"] as const;
export const HOME_ETFS = ["SPY","RSP","QQQ","SMH","SOXX",...XL_FALLBACK_ETFS] as const;
export type HomeEtf = typeof HOME_ETFS[number];
export type EtfBar = {time:number;close:number};
export function expectedHomeEtfSession(now:Date):string|null{
 // Allow 15 minutes after the scheduled close for daily-history publication.
 return expectedCompletedUsWeekdaySessionDay(new Date(now.getTime()-15*60000));
}
export function parseHomeEtfChart(payload:unknown,symbol:HomeEtf,now:Date):EtfBar[]{
 const root=payload as {chart?:{error?:unknown;result?:Array<{
  meta?:{symbol?:string;currency?:string;instrumentType?:string;exchangeTimezoneName?:string};
  timestamp?:unknown;indicators?:{quote?:Array<{close?:unknown}>};
 }>}}|null;
 const chart=root?.chart,record=chart?.result?.[0];
 if(chart?.error||chart?.result?.length!==1||!record||
  record.meta?.symbol!==symbol||record.meta.currency!=="USD"||
  record.meta.instrumentType!=="ETF"||record.meta.exchangeTimezoneName!=="America/New_York")
  throw Error("ETF identity mismatch");
 const stamps=record.timestamp,closes=record.indicators?.quote?.[0]?.close;
 if(!Array.isArray(stamps)||!Array.isArray(closes)||stamps.length!==closes.length||
  stamps.length>400)throw Error("Invalid ETF daily history");
 const expected=expectedHomeEtfSession(now);
 if(!expected)throw Error("US session unavailable");
 const dayFormat=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",
  year:"numeric",month:"2-digit",day:"2-digit"});
 const byDay=new Map<string,EtfBar>();
 for(let i=0;i<stamps.length;i++){
  const stamp=stamps[i],close=closes[i];
  if(typeof stamp!=="number"||!Number.isFinite(stamp)||stamp<=0||stamp>+now/1000||
   typeof close!=="number"||!Number.isFinite(close)||close<=0)continue;
  const parts=dayFormat.formatToParts(new Date(stamp*1000));
  const p=(key:string)=>parts.find(x=>x.type===key)?.value??"";
  const day=p("year")+"-"+p("month")+"-"+p("day");
  if(day>expected||scheduledUsEquityCloseHourET(day)===null)continue;
  if(byDay.has(day))throw Error("Duplicate ETF daily session");
  byDay.set(day,{time:Date.parse(day+"T00:00:00Z")/1000,close});
 }
 const bars=[...byDay.values()].sort((a,b)=>a.time-b.time);
 if(bars.length<6||(!(XL_FALLBACK_ETFS as readonly string[]).includes(symbol)&&new Date(bars.at(-1)!.time*1000).toISOString().slice(0,10)!==expected))
  throw Error("Secondary ETF history is behind expected session");
 return bars;
}
export async function fetchHomeEtfHistory(symbol:HomeEtf,now=new Date(),fetcher:typeof fetch=fetch){
 if(!HOME_ETFS.includes(symbol))throw Error("ETF not allowlisted");
 const response=await fetcher("https://query1.finance.yahoo.com/v8/finance/chart/"+symbol+"?range=1y&interval=1d",{
  headers:{accept:"application/json","user-agent":"Mozilla/5.0 Bluebelly Markets Monitor"},
  next:{revalidate:900},signal:AbortSignal.timeout(8500)});
 if(!response.ok)throw Error("Secondary ETF history unavailable");
 return {points:parseHomeEtfChart(await response.json(),symbol,now),
  sourceName:"Yahoo Finance public daily chart (secondary; delayed)",
  sourceUrl:"https://finance.yahoo.com/quote/"+symbol+"/history/"};
}
