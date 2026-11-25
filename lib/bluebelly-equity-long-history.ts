import type {StockIdentity} from "./bluebelly-equity-universe.ts";
import {scanEquityEma,type EmaPoint,type EquityEmaScan} from "./bluebelly-equity-ema.ts";

export type LongEquityRead={status:"SOURCE_DATED"|"UNAVAILABLE"|"SOURCE_MISMATCH";ticker:string;sourceUrl:string;asOf:string|null;historyStart:string|null;bars:number;scan:EquityEmaScan|null;reason:string};
const day=(t:number)=>new Date(t*1000).toISOString().slice(0,10);
function localParts(t:number,tz:string){
 return Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(new Date(t*1000)).map(p=>[p.type,p.value]));
}
function localDay(t:number,tz:string){const p=localParts(t,tz);return [p.year,p.month,p.day].join("-");}
export function parseLongEquityHistory(payload:unknown,spec:StockIdentity,now:Date):EmaPoint[]{
 const p=payload as {chart?:{error?:unknown;result?:{meta?:{symbol?:string;currency?:string};timestamp?:unknown[];indicators?:{quote?:{close?:unknown[]}[]}}[]}}|null;
 const chart=p?.chart;if(chart?.error||chart?.result?.length!==1)throw Error("No chart result");
 const row=chart.result[0];
 if(row.meta?.symbol?.toUpperCase()!==spec.providerSymbol||row.meta?.currency?.toUpperCase()!==spec.currency)throw Error("Listing/currency mismatch");
 const timestamps=row.timestamp,closes=row.indicators?.quote?.[0]?.close;
 if(!Array.isArray(timestamps)||!Array.isArray(closes)||timestamps.length!==closes.length||timestamps.length>30000)throw Error("Invalid bounded price history");
 const clock=localParts(now.getTime()/1000,spec.timeZone),today=[clock.year,clock.month,clock.day].join("-");
 const result=new Map<string,EmaPoint>();
 for(let i=0;i<timestamps.length;i++){
  const t=timestamps[i],v=closes[i];
  if(typeof t!=="number"||!Number.isFinite(t)||t<=0||t>now.getTime()/1000||typeof v!=="number"||!Number.isFinite(v)||v<=0)continue;
  const d=localDay(t,spec.timeZone);if(d>today||d===today&&(Number(clock.hour)<18||clock.weekday==="Sat"||clock.weekday==="Sun"))continue;
  result.set(d,{time:Date.parse(d+"T00:00:00Z")/1000,close:v});
 }
 const bars=[...result.values()].sort((a,b)=>a.time-b.time).slice(-12000);
 if(bars.length<3)throw Error("Insufficient completed history");
 return bars;
}
/** One explicitly requested listing only, through BB's existing secondary chart
 * provider. Never fetch the whole universe's maximum history on a page load.
 * Match the canonical BB session before using the alternative history basis.
 */
export async function readLongEquityHistory(spec:StockIdentity,reference:{price:number;asOf:string},now=new Date(),fetcher:typeof fetch=fetch):Promise<LongEquityRead>{
 const sourceUrl="https://finance.yahoo.com/quote/"+encodeURIComponent(spec.providerSymbol)+"/history/";
 const empty=(status:LongEquityRead["status"],reason:string):LongEquityRead=>({status,ticker:spec.ticker,sourceUrl,asOf:null,historyStart:null,bars:0,scan:null,reason});
 if(!/^[A-Z0-9][A-Z0-9.-]{0,17}$/.test(spec.providerSymbol)||!Number.isFinite(reference.price)||reference.price<=0||!/^\d{4}-\d{2}-\d{2}$/.test(reference.asOf))return empty("UNAVAILABLE","Canonical BB reference unavailable");
 try{
  const url="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(spec.providerSymbol)+"?range=max&interval=1d";
  const res=await fetcher(url,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 Bluebelly Markets Monitor"},next:{revalidate:21600},signal:AbortSignal.timeout(12000)});
  if(!res.ok)return empty("UNAVAILABLE","Secondary history provider unavailable");
  const bars=parseLongEquityHistory(await res.json(),spec,now).filter(b=>day(b.time)<=reference.asOf);
  const last=bars.at(-1);
  if(!last||day(last.time)!==reference.asOf||Math.abs(last.close/reference.price-1)>.005)return empty("SOURCE_MISMATCH","BB and secondary history do not match within 0.5% on the same completed session");
  const scan=scanEquityEma(bars,spec.timeZone,now);
  if(!scan)return empty("UNAVAILABLE","Technical history unavailable");
  return {status:"SOURCE_DATED",ticker:spec.ticker,sourceUrl,asOf:day(last.time),historyStart:day(bars[0].time),bars:bars.length,scan,reason:"Secondary daily chart history matched to BB session; provider split treatment may differ. Verify chart convention before execution."};
 }catch{return empty("UNAVAILABLE","Long history retrieval or validation failed");}
}
