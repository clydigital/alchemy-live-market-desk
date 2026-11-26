import {calculateEmaBand,EMA_PERIODS,EMA_WIDTHS,type Band} from "./ema-sd-levels.ts";
export const FOUR_H_SYMBOLS=["XAU/USD","USD/JPY","BTC/USD"] as const;
export type FourHSymbol=string;
export type FourHEvent={period:number;boundary:"lower"|"ema"|"upper";direction:"up"|"down";kind:"CROSS"|"HOLD"|"APPROACH";level:number;distancePct:number;asOf:string;closes:number};
export type FourHRead={symbol:string;status:"INDICATIVE"|"STALE"|"UNAVAILABLE"|"INVALID_HISTORY";reason:string;asOf:string|null;sampleCount:number;gapCount:number;close:number|null;bands:Band[];events:FourHEvent[]};
const fourHours=4*3600000;
export function emptyFourH(symbol:string,reason:string,status:FourHRead["status"]="UNAVAILABLE"):FourHRead{return {symbol,status,reason,asOf:null,sampleCount:0,gapCount:0,close:null,bands:[],events:[]};}
const obj=(v:unknown):Record<string,unknown>|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
/** Caller requests timezone=UTC. Provider timestamps identify bar opens.
 * A full four-hour elapsed window is necessary, not sufficient for session
 * completeness. Market closures and vendor gaps are not guessed. */
export function parseFourH(payload:unknown,symbol:FourHSymbol,now:Date):FourHRead{
 const p=obj(payload),meta=obj(p?.meta);
 const bad=(reason:string)=>emptyFourH(symbol,reason,"INVALID_HISTORY");
 if(!p||p.status==="error"||!meta||!Array.isArray(p.values))return emptyFourH(symbol,"Provider entitlement, quota or history unavailable");
 if(meta.symbol!==symbol||meta.interval!=="4h"||(symbol.includes("/")?((meta.currency_quote!==undefined&&meta.currency_quote!==symbol.split("/")[1])||(meta.currency_base!==undefined&&meta.currency_base!==symbol.split("/")[0])):meta.currency!=="USD"))return bad("Instrument or interval mismatch");
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
 const events:FourHEvent[]=[];
 if(!stale&&a.length>=2&&a.at(-1)![0]-a.at(-2)![0]===fourHours){
  for(const [i,period] of EMA_PERIODS.entries()){
   const current=calculateEmaBand(closes,period,EMA_WIDTHS[i]),previous=calculateEmaBand(closes.slice(0,-1),period,EMA_WIDTHS[i]);
   if(!current||!previous||current.status!=="READY"||previous.status!=="READY")continue;
   for(const boundary of ["lower","ema","upper"] as const){
    const level=current[boundary],before=closes.at(-2)!-previous[boundary],after=close-level;
    if(level<=0||previous[boundary]<=0)continue;
    const distancePct=100*after/level,asOf=new Date(t+fourHours).toISOString();
    if(before<=0&&after>0||before>=0&&after<0){events.push({period,boundary,direction:after>0?"up":"down",kind:"CROSS",level,distancePct,asOf,closes:1});continue;}
    // Inspect the last three completed windows after a crossing; never bridge a gap.
    if(a.length>=4&&a.slice(-4).every((r,i,v)=>i===0||r[0]-v[i-1][0]===fourHours)){
     const ds=closes.slice(-4).map((c,i)=>{const v=calculateEmaBand(closes.slice(0,closes.length-3+i),period,EMA_WIDTHS[EMA_PERIODS.indexOf(period)]);return v?.status==="READY"?c-v[boundary]:null;});
     if(ds.every(d=>d!==null)){const [d0,d1,d2,d3]=ds as number[];if(d0<=0&&d1>0&&d2>0&&d3>0||d0>=0&&d1<0&&d2<0&&d3<0){events.push({period,boundary,direction:d3>0?"up":"down",kind:"HOLD",level,distancePct,asOf,closes:3});continue;}}
    }
    const priorPct=100*before/previous[boundary],delta=close-closes.at(-2)!;
    if(Math.abs(distancePct)<=1&&Math.abs(distancePct)<Math.abs(priorPct)&&(before<0&&after<=0&&delta>0||before>0&&after>=0&&delta<0))events.push({period,boundary,direction:before<0?"up":"down",kind:"APPROACH",level,distancePct,asOf,closes:1});
   }
  }
 }
 return {symbol,status:stale?"STALE":"INDICATIVE",reason:stale?"Latest elapsed window is more than eight hours old; market closure not inferred":"UTC elapsed windows; exchange/session completeness, exact feed and chart alignment unverified. Indicative research events only.",asOf:new Date(t+fourHours).toISOString(),sampleCount:a.length,gapCount,close,bands,events};
}

/** Private request planning only; canonical identity allowlist supplied by caller.
 * Six symbols per user-triggered batch; holdings before saved ideas before BB universe.
 * Macro batch is independent and never repeated during equity batches. */
export const FOUR_H_BATCH_SIZE=6;
export const FOUR_H_CORE=["XAU/USD","USD/JPY","BTC/USD","SPY","QQQ","SMH"] as const;
export function planFourHWatch(priority:readonly string[],allowed:readonly string[],requested:string|undefined){
 const permitted=new Set(allowed),unique=[...new Set(priority.map(s=>s.trim().toUpperCase()).filter(Boolean))];
 const eligible=unique.filter(s=>permitted.has(s)&&!(FOUR_H_CORE as readonly string[]).includes(s));
 const excluded=unique.filter(s=>!permitted.has(s)&&!(FOUR_H_CORE as readonly string[]).includes(s));
 const batches=Math.ceil(eligible.length/FOUR_H_BATCH_SIZE);
 const index=requested&&/^\d{1,4}$/.test(requested)?Number(requested):null;
 const batch=index!==null&&index>=1&&index<=batches?index:null;
 return {eligible,excluded,batches,batch,symbols:requested==="scan"?[...FOUR_H_CORE]:batch!==null?eligible.slice((batch-1)*FOUR_H_BATCH_SIZE,batch*FOUR_H_BATCH_SIZE):[]};
}
