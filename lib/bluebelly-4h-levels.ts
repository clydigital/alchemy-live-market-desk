import {calculateEmaBand,EMA_PERIODS,EMA_WIDTHS,type Band} from "./ema-sd-levels.ts";
export const FOUR_H_SYMBOLS=["XAU/USD","USD/JPY","BTC/USD"] as const;
export type FourHSymbol=typeof FOUR_H_SYMBOLS[number];
export type FourHRead={symbol:string;status:"INDICATIVE"|"STALE"|"UNAVAILABLE"|"INVALID_HISTORY";reason:string;asOf:string|null;sampleCount:number;gapCount:number;close:number|null;bands:Band[]};
const fourHours=4*3600000;
export function emptyFourH(symbol:string,reason:string,status:FourHRead["status"]="UNAVAILABLE"):FourHRead{return {symbol,status,reason,asOf:null,sampleCount:0,gapCount:0,close:null,bands:[]};}
const obj=(v:unknown):Record<string,unknown>|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
/** Caller requests timezone=UTC. Provider timestamps identify bar opens.
 * A full four-hour elapsed window is necessary, not sufficient for session
 * completeness. Market closures and vendor gaps are not guessed. */
export function parseFourH(payload:unknown,symbol:FourHSymbol,now:Date):FourHRead{
 const p=obj(payload),meta=obj(p?.meta);
 const bad=(reason:string)=>emptyFourH(symbol,reason,"INVALID_HISTORY");
 if(!p||p.status==="error"||!meta||!Array.isArray(p.values))return emptyFourH(symbol,"Provider entitlement, quota or history unavailable");
 if(meta.symbol!==symbol||meta.interval!=="4h"||(meta.currency_quote!==undefined&&meta.currency_quote!==symbol.split("/")[1])||(meta.currency_base!==undefined&&meta.currency_base!==symbol.split("/")[0]))return bad("Instrument or interval mismatch");
 if(p.values.length>1200)return bad("History exceeds requested bound");
 const rows=new Map<number,number>(),seen=new Set<number>();
 for(const v of p.values){
  const x=obj(v),d=x?.datetime;
  if(typeof d!=="string"||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(d))return bad("Invalid UTC bar timestamp");
  const t=Date.parse(d.replace(" ","T")+"Z");
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,19).replace("T"," ")!==d||t>+now||t<0||seen.has(t))return bad("Future, duplicate or invalid bar");
  seen.add(t);
  if(t+fourHours>+now)continue;
  if(typeof x?.close!=="number"&&typeof x?.close!=="string")return bad("Invalid close");
  const c=Number(x.close);if(!Number.isFinite(c)||c<=0)return bad("Invalid close");
  rows.set(t,c);
 }
 const a=[...rows].sort(([t],[u])=>t-u);
 if(!a.length)return emptyFourH(symbol,"No elapsed four-hour bars");
 let gapCount=0;for(let i=1;i<a.length;i++){const gap=a[i][0]-a[i-1][0];if(gap<fourHours)return bad("Overlapping bar windows");if(gap!==fourHours)gapCount++;}
 const [t,close]=a.at(-1)!,closes=a.map(x=>x[1]),stale=+now-(t+fourHours)>8*3600000;
 const bands=EMA_PERIODS.map((period,i):Band=>{
  const multiplier=EMA_WIDTHS[i],v=calculateEmaBand(closes,period,multiplier);
  if(!v)return {period,multiplier,ema:null,sd:null,upper:null,lower:null,status:"INSUFFICIENT",distancePct:null,position:null};
  return {period,multiplier,...v,distancePct:(close/v.ema-1)*100,position:close>v.upper?"ABOVE":close<v.lower?"BELOW":"INSIDE"};
 });
 return {symbol,status:stale?"STALE":"INDICATIVE",reason:stale?"Latest elapsed window is more than eight hours old; market closure not inferred":"UTC elapsed windows; exchange/session completeness, exact feed and chart alignment unverified. No trade signals.",asOf:new Date(t+fourHours).toISOString(),sampleCount:a.length,gapCount,close,bands};
}
