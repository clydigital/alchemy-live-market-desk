import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session.ts";
import {scheduledUsEquityCloseHourET} from "./bluebelly-us-equity-trading-calendar.ts";
import {BLUEBELLY_STOCK_UNIVERSE,findStockIdentity} from "./bluebelly-equity-universe.ts";

/** Bounded delayed secondary fallback for the existing homepage ETF tape only.
 * Replace a whole history; never splice providers or infer a missing close. */
export const XL_FALLBACK_ETFS = ["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"] as const;
export const HOME_ETFS = ["SPY","RSP","QQQ","SMH","SOXX",...XL_FALLBACK_ETFS] as const;
export type HomeEtf = typeof HOME_ETFS[number];
// Fixed public instrument list: 13 bond ETFs, DIA/IWM, and two missing REITs.
export const US_REPAIR_SYMBOLS=["AVB","EQR","SGOV","USFR","SHY","IEF","TLH","TLT","TIP","AGG","GOVT","LQD","HYG","EDV","ZROZ","DIA","IWM"] as const;
const REPAIR_EQUITIES=new Set<string>(["AVB","EQR"]);
// These 15 ETFs recovered in production on 25 Nov. Route their existing
// primary request to that source, not a second polling lane.
export const PREFERRED_US_ETFS=US_REPAIR_SYMBOLS.filter(s=>!REPAIR_EQUITIES.has(s));
// Public, fixed research pilot. Never derive requests from owner holdings.
export const US_EQUITY_CANARY=["NVDA","AMD","AAPL","MSFT","TSLA","AVGO","MU","ORCL","CI","DELL","PWR","TTWO"] as const;
export const US_RECOVERY_BATCH_LIMIT=17;
export function planUsRecovery(behind:ReadonlySet<string>):string[]{
 // Preserve existing missing-instrument priority; only spend unused slots on the pilot.
 return [...US_REPAIR_SYMBOLS,...US_EQUITY_CANARY].filter(s=>behind.has(s)).slice(0,US_RECOVERY_BATCH_LIMIT);
}
const isEquityCanary=(symbol:string)=>(US_EQUITY_CANARY as readonly string[]).includes(symbol);
export type EtfBar = {time:number;close:number};
export function expectedHomeEtfSession(now:Date):string|null{
 // Allow 15 minutes after the scheduled close for daily-history publication.
 return expectedCompletedUsWeekdaySessionDay(new Date(now.getTime()-15*60000));
}
/** Ask through the next calendar date to accommodate an exclusive provider
 * end boundary; the admission ceiling stays the completed session. */
export function nasdaqCompletedHistoryBounds(now:Date,historyDays:number){
 const expected=expectedHomeEtfSession(now);
 if(!expected)throw Error("US session unavailable");
 const through=Date.parse(expected+"T00:00:00Z")/1000;
 return {start:new Date((through-historyDays*86400)*1000),end:new Date((through+86400)*1000),through};
}
function sessionChartUrl(symbol:string,now:Date):string{
 const {through}=nasdaqCompletedHistoryBounds(now,365);
 // A stable per-session key replaces a rolling range URL that could reuse
 // pre-close cached data. End is exclusive and includes the US close.
 return "https://query1.finance.yahoo.com/v8/finance/chart/"+symbol+"?period1="+(through-365*86400)+"&period2="+(through+86400)+"&interval=1d";
}
export function usRepairChartUrl(symbol:string,now:Date):string{
 if(!(US_REPAIR_SYMBOLS as readonly string[]).includes(symbol))throw Error("Repair symbol not allowlisted");
 return sessionChartUrl(symbol,now);
}
export function repairFailureCode(error:unknown):string{
 const m=error instanceof Error?error.message:"";
 if(error instanceof Error&&(error.name==="TimeoutError"||error.name==="AbortError"))return "TIMEOUT_OR_ABORT";
 if(/^Secondary repair HTTP (400|401|403|404|429|500|502|503|504)$/.test(m))return "HTTP_"+m.split(" ").at(-1);
 if(m==="ETF identity mismatch")return "IDENTITY_MISMATCH";
 if(m==="Invalid ETF daily history"||m==="Duplicate ETF daily session")return "INVALID_HISTORY";
 if(m==="Secondary ETF history is behind expected session")return "SESSION_BEHIND_OR_SPARSE";
 return "UNAVAILABLE";
}
function parseUsListedChart(payload:unknown,symbol:string,kind:"ETF"|"EQUITY",now:Date,allowLag:boolean):EtfBar[]{
 const root=payload as {chart?:{error?:unknown;result?:Array<{
  meta?:{symbol?:string;currency?:string;instrumentType?:string;exchangeTimezoneName?:string};
  timestamp?:unknown;indicators?:{quote?:Array<{close?:unknown}>};
 }>}}|null;
 const chart=root?.chart,record=chart?.result?.[0];
 if(chart?.error||chart?.result?.length!==1||!record||
  record.meta?.symbol!==symbol||record.meta.currency!=="USD"||
  record.meta.instrumentType!==kind||record.meta.exchangeTimezoneName!=="America/New_York")
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
 if(bars.length<6||(!allowLag&&new Date(bars.at(-1)!.time*1000).toISOString().slice(0,10)!==expected))
  throw Error("Secondary ETF history is behind expected session");
 return bars;
}
export function parseHomeEtfChart(payload:unknown,symbol:HomeEtf,now:Date):EtfBar[]{
 return parseUsListedChart(payload,symbol,"ETF",now,(XL_FALLBACK_ETFS as readonly string[]).includes(symbol));
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

/** Exact listing and completed-session validation; never splice histories or
 * admit arbitrary request-supplied instruments. */
export function parseUsRepairChart(payload:unknown,symbol:string,now:Date):EtfBar[]{
 if(!(US_REPAIR_SYMBOLS as readonly string[]).includes(symbol))throw Error("Repair symbol not allowlisted");
 return parseUsListedChart(payload,symbol,REPAIR_EQUITIES.has(symbol)?"EQUITY":"ETF",now,false);
}
async function fetchSessionChart(symbol:string,kind:"ETF"|"EQUITY",now:Date,budget:AbortSignal,fetcher:typeof fetch,revalidate:number){
 const response=await fetcher(sessionChartUrl(symbol,now),{
  headers:{accept:"application/json","user-agent":"Mozilla/5.0 Bluebelly Markets Monitor"},
  next:{revalidate},signal:AbortSignal.any([budget,AbortSignal.timeout(8500)])});
 if(!response.ok)throw Error("Secondary repair HTTP "+response.status);
 const payload=await response.json();
 const points=parseUsListedChart(payload,symbol,kind,now,true);
 const lastDay=new Date(points.at(-1)!.time*1000).toISOString().slice(0,10);
 const expected=expectedHomeEtfSession(now)!;
 if(Date.parse(expected+"T00:00:00Z")-Date.parse(lastDay+"T00:00:00Z")>7*86400000)throw Error("Secondary ETF history is behind expected session");
 return {points,sourceName:"Yahoo Finance public daily chart (secondary; delayed)",sourceUrl:"https://finance.yahoo.com/quote/"+symbol+"/history/"};
}

export async function fetchUsRepairHistory(symbol:string,now:Date,budget:AbortSignal,fetcher:typeof fetch=fetch,revalidate=3600){
 if(!(US_REPAIR_SYMBOLS as readonly string[]).includes(symbol))throw Error("Repair symbol not allowlisted");
 return fetchSessionChart(symbol,REPAIR_EQUITIES.has(symbol)?"EQUITY":"ETF",now,budget,fetcher,revalidate);
}
export async function fetchUsEquityCanaryHistory(symbol:string,now:Date,budget:AbortSignal,fetcher:typeof fetch=fetch){
 if(!isEquityCanary(symbol))throw Error("Equity canary not allowlisted");
 return fetchSessionChart(symbol,"EQUITY",now,budget,fetcher,3600);
}

// Existing core index/breadth acquisition remains Nasdaq-based; eight displayed
// core equities receive the already-budgeted alternate recovery when necessary.
export const CORE_DISPLAY_US_EQUITIES=["NVDA","AMD","AAPL","MSFT","TSLA","AMZN","GOOGL","META"] as const;
export const ALL_US_EQUITY_SYMBOLS=BLUEBELLY_STOCK_UNIVERSE.filter(s=>s.region==="US").map(s=>s.ticker);
export function planFullUsRecovery(behind:ReadonlySet<string>):string[]{
 const priority=[...US_REPAIR_SYMBOLS,...CORE_DISPLAY_US_EQUITIES,...US_EQUITY_CANARY,...ALL_US_EQUITY_SYMBOLS];
 return [...new Set(priority)].filter(s=>behind.has(s)).slice(0,US_RECOVERY_BATCH_LIMIT);
}
export async function fetchCuratedUsEquityHistory(symbol:string,now:Date,budget:AbortSignal,fetcher:typeof fetch=fetch,revalidate=3600){
 const identity=findStockIdentity(symbol);
 if(!identity||identity.region!=="US"||identity.providerSymbol!==symbol||identity.currency!=="USD")throw Error("US equity not allowlisted");
 return fetchSessionChart(symbol,"EQUITY",now,budget,fetcher,revalidate);
}
