import {lastBandExit,type LastBandExit} from "./ema-last-band-exit.ts";
import {calculateEmaBand,EMA_PERIODS,EMA_WIDTHS,type Band} from "./ema-sd-levels.ts";
import {scheduledUsEquityCloseHourET,usEquitySessionCalendarBasis} from "./bluebelly-us-equity-trading-calendar.ts";
const NY_FORMAT=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
function ny(t:number){const z=Object.fromEntries(NY_FORMAT.formatToParts(t).map(x=>[x.type,x.value]));return {day:z.year+"-"+z.month+"-"+z.day,hour:Number(z.hour),minute:Number(z.minute)};}
function equityWindows(day:string){
 const hour=scheduledUsEquityCloseHourET(day);if(hour===null)return [];
 const utc=Date.parse(day+"T13:30:00Z"),start=ny(utc).hour===9?utc:utc+3600000;
 const end=start+(hour-9.5)*3600000;
 return [{open:start,end:Math.min(start+4*3600000,end)},...(end>start+4*3600000?[{open:start+4*3600000,end}]:[])];
}
function recentEquityWindows(now:Date,days=15){
 const local=ny(+now).day,mid=Date.parse(local+"T00:00:00Z");
 return Array.from({length:days},(_,i)=>new Date(mid-(days-1-i)*86400000).toISOString().slice(0,10)).flatMap(d=>usEquitySessionCalendarBasis(d)==="OFFICIAL_NYSE_2026_2028"?equityWindows(d):[]).filter(w=>w.end<=+now);
}
/** Refresh on a completed exchange window rather than an arbitrary UTC bucket.
 * Retry during the first hour after a close to allow for vendor publication lag.
 * Macro sessions use hourly buckets because their UTC phase is venue-dependent. */
export function fourHCacheKey(symbol:string,now:Date):string{
 if(symbol.includes("/"))return "macro:"+Math.floor(+now/3600000);
 const last=recentEquityWindows(now).at(-1);
 if(!last)return "unverified:"+Math.floor(+now/3600000);
 const age=+now-last.end;
 return "equity:"+last.end+":"+(age<3600000?Math.floor(age/900000):"settled");
}
export const FOUR_H_SYMBOLS=["XAU/USD","USD/JPY","BTC/USD"] as const;
export type FourHSymbol=string;
export type FourHEvent={period:number;boundary:"lower"|"ema"|"upper";direction:"up"|"down";kind:"CROSS"|"HOLD"|"APPROACH";level:number;distancePct:number;asOf:string;closes:number};
export type FourHRead={symbol:string;status:"INDICATIVE"|"STALE"|"UNAVAILABLE"|"INVALID_HISTORY";reason:string;asOf:string|null;sampleCount:number;gapCount:number;close:number|null;bands:Band[];events:FourHEvent[];priorPositions?:Record<number,Band["position"]>;lastExits?:Record<number,LastBandExit|null>};
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
 const equity=!symbol.includes("/"),expected=equity?recentEquityWindows(now):[],expectedIndex=new Map(expected.map((w,i)=>[w.open,i]));
 const rows=new Map<number,number>(),ends=new Map<number,number>(),seen=new Set<number>();
 for(const v of p.values){
  const x=obj(v),d=x?.datetime;
  if(typeof d!=="string"||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(d))return bad("Invalid UTC bar timestamp");
  const t=Date.parse(d.replace(" ","T")+"Z");
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,19).replace("T"," ")!==d||t>+now||t<0||seen.has(t))return bad("Future, duplicate or invalid bar");
  seen.add(t);
  let end=t+fourHours;
  if(equity){const day=ny(t).day,official=usEquitySessionCalendarBasis(day)==="OFFICIAL_NYSE_2026_2028";
   const session=equityWindows(day).find(w=>w.open===t);
   // For earlier years no official holiday calendar is available. Only the
   // historical seed is indicative; recent events require the official schedule.
   if(!session){if(official)return bad("Unexpected US regular-session bar open");const local=ny(t);if(local.minute!==30||![9,13].includes(local.hour))return bad("Unexpected historical US bar open");end=t+(local.hour===13?2.5:4)*3600000;}
   else end=session.end;
  }
  if(end>+now)continue;
  if(typeof x?.close!=="number"&&typeof x?.close!=="string")return bad("Invalid close");
  const c=Number(x.close);if(!Number.isFinite(c)||c<=0)return bad("Invalid close");
  rows.set(t,c);ends.set(t,end);
 }
 const a=[...rows].sort(([t],[u])=>t-u);
 if(!a.length)return emptyFourH(symbol,"No elapsed four-hour bars");
 const adjacent=(before:number,after:number)=>equity?expectedIndex.has(before)&&expectedIndex.get(after)===expectedIndex.get(before)!+1:after-before===fourHours;
 let gapCount=0;for(let i=1;i<a.length;i++){const prior=a[i-1][0],next=a[i][0];if(next<ends.get(prior)!)return bad("Overlapping bar windows");if(equity?expectedIndex.has(prior)&&expectedIndex.has(next)&&!adjacent(prior,next):!adjacent(prior,next))gapCount++;}
 const [t,close]=a.at(-1)!,closes=a.map(x=>x[1]),end=ends.get(t)!,stale=equity?expected.at(-1)?.open!==t:+now-end>8*3600000;
 const bands=EMA_PERIODS.map((period,i):Band=>{
  const multiplier=EMA_WIDTHS[i],v=calculateEmaBand(closes,period,multiplier);
  if(!v)return {period,multiplier,ema:null,sd:null,upper:null,lower:null,status:"INSUFFICIENT",distancePct:null,position:null};
  return {period,multiplier,...v,distancePct:(close/v.ema-1)*100,position:close>v.upper?"ABOVE":close<v.lower?"BELOW":"INSIDE"};
 });
 const priorPositions:Record<number,Band["position"]>={};
 if(!stale&&a.length>=2&&adjacent(a.at(-2)![0],a.at(-1)![0]))for(const [i,period] of EMA_PERIODS.entries()){
  const prev=calculateEmaBand(closes.slice(0,-1),period,EMA_WIDTHS[i]);const price=closes.at(-2)!;
  if(prev?.status==="READY")priorPositions[period]=price>prev.upper?"ABOVE":price<prev.lower?"BELOW":"INSIDE";
 }
 const lastExits:Record<number,LastBandExit|null>={};
 const exitIndex=new Map((equity?recentEquityWindows(now,90):[]).map((w,i)=>[w.open,i]));
 if(!stale)for(const [i,period] of EMA_PERIODS.entries()){
  lastExits[period]=lastBandExit(closes.length,j=>{
   const b=calculateEmaBand(closes.slice(0,j+1),period,EMA_WIDTHS[i]);
   const price=closes[j];return b?.status==="READY"?{position:price>b.upper?"above":price<b.lower?"below":"inside",asOf:new Date(ends.get(a[j][0])!).toISOString()}:null;
  },(before,after)=>equity?exitIndex.has(a[before][0])&&exitIndex.get(a[after][0])===exitIndex.get(a[before][0])!+1:a[after][0]-a[before][0]===fourHours);
 }
 const events:FourHEvent[]=[];
 if(!stale&&a.length>=2&&adjacent(a.at(-2)![0],a.at(-1)![0])){
  for(const [i,period] of EMA_PERIODS.entries()){
   const current=calculateEmaBand(closes,period,EMA_WIDTHS[i]),previous=calculateEmaBand(closes.slice(0,-1),period,EMA_WIDTHS[i]);
   if(!current||!previous||current.status!=="READY"||previous.status!=="READY")continue;
   for(const boundary of ["lower","ema","upper"] as const){
    const level=current[boundary],before=closes.at(-2)!-previous[boundary],after=close-level;
    if(level<=0||previous[boundary]<=0)continue;
    const distancePct=100*after/level,asOf=new Date(end).toISOString();
    if(before<=0&&after>0||before>=0&&after<0){events.push({period,boundary,direction:after>0?"up":"down",kind:"CROSS",level,distancePct,asOf,closes:1});continue;}
    // Inspect the last three completed windows after a crossing; never bridge a gap.
    if(a.length>=4&&a.slice(-4).every((r,i,v)=>i===0||adjacent(v[i-1][0],r[0]))){
     const ds=closes.slice(-4).map((c,i)=>{const v=calculateEmaBand(closes.slice(0,closes.length-3+i),period,EMA_WIDTHS[EMA_PERIODS.indexOf(period)]);return v?.status==="READY"?c-v[boundary]:null;});
     if(ds.every(d=>d!==null)){const [d0,d1,d2,d3]=ds as number[];if(d0<=0&&d1>0&&d2>0&&d3>0||d0>=0&&d1<0&&d2<0&&d3<0){events.push({period,boundary,direction:d3>0?"up":"down",kind:"HOLD",level,distancePct,asOf,closes:3});continue;}}
    }
    const priorPct=100*before/previous[boundary],delta=close-closes.at(-2)!;
    if(Math.abs(distancePct)<=1&&Math.abs(distancePct)<Math.abs(priorPct)&&(before<0&&after<=0&&delta>0||before>0&&after>=0&&delta<0))events.push({period,boundary,direction:before<0?"up":"down",kind:"APPROACH",level,distancePct,asOf,closes:1});
   }
  }
 }
 return {symbol,status:stale?"STALE":"INDICATIVE",reason:stale?(equity?"Latest scheduled completed US window missing or calendar unverified":"Latest elapsed window more than eight hours old; market closure not inferred"):(equity?"NYSE regular-session windows, including shortened close and scheduled holidays; vendor/chart parity unverified. Gap count covers recent official windows.":"UTC elapsed windows; exchange/session completeness, exact feed and chart alignment unverified. Indicative research events only."),asOf:new Date(end).toISOString(),sampleCount:a.length,gapCount,close,bands,events,priorPositions,lastExits};
}

/** Recheck cached observations against the current clock before display.
 * Never promote a stale cached result to a fresh observation. */
export function validateFourHReadFreshness(read:FourHRead,now:Date):FourHRead{
 if(read.status!=="INDICATIVE")return {...read,events:[],lastExits:{},priorPositions:{}};
 const end=read.asOf?Date.parse(read.asOf):NaN;
 const expected=read.symbol.includes("/")?null:recentEquityWindows(now).at(-1)?.end;
 const stale=!Number.isFinite(end)||end>+now||(read.symbol.includes("/")?+now-end>8*3600000:expected!==end);
 return stale?{...read,status:"STALE",events:[],lastExits:{},priorPositions:{},reason:"Cached observation no longer matches the latest completed window; refresh pending."}:read;
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
