import type {StockIdentity} from "./bluebelly-equity-universe.ts";

/** Exchange-aware secondary EU history.
 * A public quote provider outage is absence, never 0% or an ETF proxy.
 * Yahoo Finance chart is an unofficial delayed source; do not claim exchange-official quotes.
 */
export type EuDailyBar={
 time:number;close:number;open:number|null;high:number|null;low:number|null;
 volume:number|null;
};
export type EuStockHistory={
 id:string;symbol:string;label:string;currency:"EUR"|"DKK";
 type:"Europe Stock";benchmark:null;points:EuDailyBar[];
 sourceName:string;sourceUrl:string;frequency:"daily";
};
const dayParts=(date:Date,timeZone:string)=>Object.fromEntries(
 new Intl.DateTimeFormat("en-US",{
  timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23",
  weekday:"short",
 }).formatToParts(date).map(x=>[x.type,x.value])
);
const localDay=(p:Record<string,string>)=>[p.year,p.month,p.day].join("-");
const number=(x:unknown)=>typeof x==="number"&&Number.isFinite(x)&&x>0?x:null;
/** Eligible only after that venue's *completed* close. The 18:00 local
 * gate is intentionally conservative for Xetra/Euronext/Copenhagen.
 */
export function euroSessionIsCompleted(day:string,spec:StockIdentity,now:Date):boolean{
 if(spec.region!=="EU"||!/^20\d{2}-\d{2}-\d{2}$/.test(day))return false;
 const p=dayParts(now,spec.timeZone),today=localDay(p);
 if(day>today)return false;
 if(day<today)return true;
 return p.weekday!=="Sat"&&p.weekday!=="Sun"&&Number(p.hour)>=18;
}
export function parseEuropeanStockChart(payload:unknown,spec:StockIdentity,now:Date):EuDailyBar[]{
 if(spec.region!=="EU")throw Error("Only curated EU listings allowed");
 const root=payload as {chart?:{error?:unknown;result?:Array<{meta?:{symbol?:string;currency?:string};
  timestamp?:unknown;indicators?:{quote?:Array<Record<string,unknown>>}}>}}|null;
 const chart=root?.chart;
 if(chart?.error||!Array.isArray(chart?.result)||chart.result.length!==1)throw Error("EU chart unavailable");
 const record=chart.result[0];
 if(String(record?.meta?.symbol||"").toUpperCase()!==spec.providerSymbol||
  String(record?.meta?.currency||"").toUpperCase()!==spec.currency)
  throw Error("EU ticker or currency mismatch");
 const stamps=record.timestamp,source=record.indicators?.quote?.[0];
 if(!Array.isArray(stamps)||!source||stamps.length<2||stamps.length>500)throw Error("EU price history incomplete");
 const closes=source.close,opens=source.open,highs=source.high,lows=source.low,volumes=source.volume;
 if(!Array.isArray(closes)||closes.length!==stamps.length)throw Error("EU close series invalid");
 const byDay=new Map<string,EuDailyBar>();
 for(let i=0;i<stamps.length;i++){
  const ts=Number(stamps[i]),close=number(closes[i]);
  if(!Number.isFinite(ts)||ts<=0||ts>now.getTime()/1000+3600||close===null)continue;
  const day=localDay(dayParts(new Date(ts*1000),spec.timeZone));
  if(!euroSessionIsCompleted(day,spec,now))continue;
  const a=Array.isArray(opens)?number(opens[i]):null,b=Array.isArray(highs)?number(highs[i]):null,
   c=Array.isArray(lows)?number(lows[i]):null,v=Array.isArray(volumes)?Number(volumes[i]):null;
  if(a!==null&&b!==null&&c!==null&&(c>a||a>b||c>close||close>b))continue;
  byDay.set(day,{time:Date.parse(day+"T00:00:00Z")/1000,close,open:a,high:b,low:c,
   volume:v!==null&&Number.isFinite(v)&&v>=0?v:null});
 }
 const bars=[...byDay.values()].sort((a,b)=>a.time-b.time).slice(-280);
 if(bars.length<3)throw Error("EU history too sparse");
 const last=new Date(bars.at(-1)!.time*1000),days=(now.getTime()-last.getTime())/86400000;
 if(days>7||days<0)throw Error("EU last completed session too stale");
 return bars;
}
export async function fetchEuropeanStockHistory(
 spec:StockIdentity,now=new Date(),fetcher:typeof fetch=fetch,
):Promise<EuStockHistory>{
 if(spec.region!=="EU")throw Error("Cannot request non-EU stock on EU connector");
 if(spec.currency!=="EUR"&&spec.currency!=="DKK")throw Error("EU quote currency cannot be USD");
 // Exactly curated symbols, never request-supplied URL parameters.
 if(!/^[A-Z0-9-]{1,12}\.(AS|DE|PA|CO)$/.test(spec.providerSymbol))throw Error("Unexpected EU chart symbol");
 const sourceUrl="https://query1.finance.yahoo.com/v8/finance/chart/"+
  encodeURIComponent(spec.providerSymbol)+"?range=1y&interval=1d";
 const response=await fetcher(sourceUrl,{headers:{"accept":"application/json","user-agent":"Mozilla/5.0 Bluebelly Markets Monitor"},
  next:{revalidate:60*60*6},signal:AbortSignal.timeout(8500)});
 if(!response.ok)throw Error("EU chart source "+response.status);
 const payload=await response.json();
 const points=parseEuropeanStockChart(payload,spec,now);
 return {id:spec.monitorId,symbol:spec.ticker,label:spec.company,currency:spec.currency as "EUR"|"DKK",
  type:"Europe Stock",benchmark:null,points,
  sourceName:"Yahoo Finance public daily chart (secondary; delayed)",
  sourceUrl:"https://finance.yahoo.com/quote/"+encodeURIComponent(spec.providerSymbol)+"/history/",
  frequency:"daily"};
}
