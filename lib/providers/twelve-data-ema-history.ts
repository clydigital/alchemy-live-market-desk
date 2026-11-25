import "server-only";
import {unstable_cache} from "next/cache";
import {BLUEBELLY_STOCK_UNIVERSE} from "../bluebelly-equity-universe.ts";
import {calculateTechnicalLevels,exchangeDay,unavailableLevels,type Frame,type TechnicalLevels,type Bar} from "../ema-sd-levels.ts";
export const TECHNICAL_UNIVERSE=[...BLUEBELLY_STOCK_UNIVERSE.filter(x=>x.region==="US").map(x=>({ticker:x.ticker,label:x.company,currency:"USD",timeZone:x.timeZone,kind:"stock"})),...["SPY","QQQ","IWM","SMH","SOXX","XLRE","ITB","XHB","XLK","XLP","XLY","XLE","XLF","XLI","XLV","XLU","XLB","XLC","TLT","HYG","LQD","GLD","SLV","USO","UUP"].map(ticker=>({ticker,label:ticker,currency:"USD",timeZone:"America/New_York",kind:"etf"}))];
export type TechnicalSnapshot={ticker:string;currency:string;provider:"Twelve Data";retrievedAt:string;adjustment:"splits";frames:TechnicalLevels[];discardedSentinels:number};
const frames=["1day","1week","1month"] as const;
type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:null;
export async function fetchTechnicalFrame(ticker:string,frame:Frame,now:Date,fetchImpl:typeof fetch=fetch):Promise<{levels:TechnicalLevels;discarded:number}>{
 const spec=TECHNICAL_UNIVERSE.find(x=>x.ticker===ticker);
 const key=process.env.TWELVEDATA_API_KEY?.trim();
 const bad=(reason:string)=>({levels:unavailableLevels(frame,reason),discarded:0});
 if(!spec||!key)return bad("Unsupported instrument or server credential missing");
 const url=new URL("https://api.twelvedata.com/time_series");
 for(const [k,v] of Object.entries({symbol:spec.ticker,interval:frame,outputsize:frame==="1month"?"1000":"1200",adjust:"splits",format:"JSON",order:"ASC",apikey:key}))url.searchParams.set(k,v);
 try{
  const response=await fetchImpl(url,{cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok)return bad("Provider HTTP "+response.status);
  const payload=obj(await response.json()),meta=obj(payload?.meta);
  if(!payload||payload.status==="error"||!meta||!Array.isArray(payload.values))return bad("Provider entitlement, quota or payload unavailable");
  if(meta.symbol!==ticker||meta.currency!=="USD"||meta.interval!==frame||!["America/New_York","US/Eastern"].includes(String(meta.exchange_timezone)))return bad("Instrument, interval or currency identity mismatch");
  const points:Bar[]=[];let discarded=0;
  for(const value of payload.values){
   const r=obj(value);if(!r||typeof r.datetime!=="string"||typeof r.close!=="string"&&!Number.isFinite(r.close))return bad("Malformed candle");
   if(r.datetime==="1970-01-01"){discarded++;continue;}
   points.push({day:r.datetime,close:Number(r.close)});
  }
  const levels=calculateTechnicalLevels(points,frame,exchangeDay(now,spec.timeZone));
  return {levels,discarded};
 }catch{return bad("Provider request or response unavailable");}
}
const cachedFrame=unstable_cache(async(ticker:string,frame:Frame,sessionKey:string)=>{void sessionKey;return fetchTechnicalFrame(ticker,frame,new Date());},["bb-owner-ema-sd-v1"],{revalidate:3600});
export async function readTechnicalSnapshot(ticker:string,now=new Date()):Promise<TechnicalSnapshot|null>{
 const spec=TECHNICAL_UNIVERSE.find(x=>x.ticker===ticker);if(!spec)return null;
 const today=exchangeDay(now,spec.timeZone);
 const results=[];for(const frame of frames)results.push(await cachedFrame(ticker,frame,today));
 return {ticker,currency:spec.currency,provider:"Twelve Data",retrievedAt:now.toISOString(),adjustment:"splits",frames:results.map(x=>x.levels),discardedSentinels:results.reduce((n,x)=>n+x.discarded,0)};
}
