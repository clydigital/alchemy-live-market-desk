import {calculateEmaBand,EMA_PERIODS,EMA_WIDTHS} from "./ema-sd-levels.ts";
import {expectedHomeEtfSession} from "./bluebelly-home-etf-history.ts";
import {scheduledUsEquityCloseHourET,usEquitySessionCalendarBasis} from "./bluebelly-us-equity-trading-calendar.ts";
import {replayRespectedBand,type RespectedBandTrend} from "./bluebelly-ema-trend-replay.ts";
/** Canonical BB calculations: completed daily closes, no forecast or trade signal.
 * First-close seeded EMA; rolling population SD of closing prices around their SMA,
 * envelope centred on EMA. Confirm chart convention before execution.
 * Higher timeframes use only prior completed calendar periods (conservative).
 */
export type EmaPoint={time:number;close:number};
type Frame="D"|"W"|"M";
type State="above"|"below"|"at";
type Band="above_upper"|"below_lower"|"inside";
type Cross="up"|"down"|"none";
export type CloseHold={boundary:"ema"|"upper"|"lower";direction:"up"|"down";crossedOn:string;consecutiveCloses:number;status:"BREAK_ONLY"|"HOLD_CONFIRMED"};
export type EmaObservation={frame:Frame;period:number;multiplier:number;asOf:string;anchorDay:string;sampleCount?:number;requiredReadySamples?:number;closeHolds?:CloseHold[];respectedBandTrend?:RespectedBandTrend|null;warmup:"READY"|"SHORT_WARMUP";ema:number;upper:number;lower:number;distancePct:number;side:State;band:Band;windows:Record<"1"|"3"|"5",{returnPct:number;approach:"down_to"|"up_to"|"away"|"none";emaCross:Cross;upperCross:Cross;lowerCross:Cross;events:{session:string;boundary:"ema"|"upper"|"lower";direction:"up"|"down"}[]}|null>};
export type EquityEmaScan={asOf:string;method:"FIRST_CLOSE_EMA_ROLLING_CLOSE_POPULATION_SD";observations:EmaObservation[];unavailable:string[]};
const periods=EMA_PERIODS.map((period,i)=>[period,EMA_WIDTHS[i]] as const);
const day=(t:number)=>new Date(t*1000).toISOString().slice(0,10);
const key=(t:number,frame:Frame)=>{const d=new Date(t*1000);if(frame==="M")return day(t).slice(0,7);if(frame==="W"){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return day(d.getTime()/1000);}return day(t);};
function localDay(now:Date,tz:string){const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(now).map(x=>[x.type,x.value]));return {date:[p.year,p.month,p.day].join("-"),hour:Number(p.hour),weekend:p.weekday==="Sat"||p.weekday==="Sun"};}
function anchors(bars:EmaPoint[],frame:Frame,at:number){const end=bars[at],prefix=bars.slice(0,at+1);if(frame==="D")return prefix;const current=key(end.time,frame),map=new Map<string,EmaPoint>();for(const b of prefix){const k=key(b.time,frame);if(k<current)map.set(k,b);}return [...map.values()];}
function bandAt(a:EmaPoint[],n:number,m:number){
 const b=calculateEmaBand(a.map(x=>x.close),n,m);
 return b?{ema:b.ema,upper:b.upper,lower:b.lower,warmup:b.status,anchorDay:day(a.at(-1)!.time),sampleCount:a.length,requiredReadySamples:5*n}:null;
}
const cross=(old:number,now:number):Cross=>old<=0&&now>0?"up":old>=0&&now<0?"down":"none";
const pct=(v:number,base:number)=>(v/base-1)*100;
export function scanEquityEma(input:readonly EmaPoint[],timeZone:string,now=new Date()):EquityEmaScan|null{
 const local=localDay(now,timeZone),usExpected=timeZone==="America/New_York"?expectedHomeEtfSession(now):null;const bars=[...new Map(input.filter(b=>Number.isFinite(b.time)&&b.time>0&&Number.isFinite(b.close)&&b.close>0&&day(b.time)<=local.date&&(timeZone==="America/New_York"?!!usExpected&&day(b.time)<=usExpected:day(b.time)<local.date||(!local.weekend&&local.hour>=18))).map(b=>[day(b.time),b])).values()].sort((a,b)=>a.time-b.time);
 if(!bars.length)return null;const at=bars.length-1,p=bars[at],asOf=day(p.time),observations:EmaObservation[]=[],unavailable:string[]=[];
 // Only the official US calendar can certify consecutiveness today.
 const recentDays=new Set(bars.slice(-6).map(b=>day(b.time)));
 let contiguous=timeZone==="America/New_York"&&asOf===usExpected&&bars.length>=6;
 if(contiguous){
  let t=p.time;
  for(let n=0;n<6;t-=86400){
   const d=day(t);
   if(usEquitySessionCalendarBasis(d)!=="OFFICIAL_NYSE_2026_2028"){contiguous=false;break;}
   if(scheduledUsEquityCloseHourET(d)===null)continue;
   if(!recentDays.has(d)){contiguous=false;break;}
   n++;
  }
 }
 const trendStart=Math.max(0,at-29);
 const trendBars=bars.slice(trendStart);
 const trendDays=new Set(trendBars.map(b=>day(b.time)));
 let trendContiguous=contiguous&&trendBars.length===30;
 if(trendContiguous){let t=p.time;for(let n=0;n<30;t-=86400){const d=day(t);if(usEquitySessionCalendarBasis(d)!=="OFFICIAL_NYSE_2026_2028"){trendContiguous=false;break;}if(scheduledUsEquityCloseHourET(d)===null)continue;if(!trendDays.has(d)){trendContiguous=false;break;}n++;}}
 for(const frame of ["D","W","M"] as const){
 const byIndex=new Map<number,EmaPoint[]>();for(let i=Math.max(0,at-5);i<=at;i++)byIndex.set(i,anchors(bars,frame,i));
 for(const [period,multiplier] of periods){
  const levels=new Map([...byIndex].map(([i,a])=>[i,bandAt(a,period,multiplier)]));
  const cur=levels.get(at);if(!cur){unavailable.push(frame+period);continue;}
  const side:State=p.close>cur.ema?"above":p.close<cur.ema?"below":"at";const band:Band=p.close>cur.upper?"above_upper":p.close<cur.lower?"below_lower":"inside";
  const windows={} as EmaObservation["windows"];
  for(const k of [1,3,5] as const){const old=levels.get(at-k);const prior=bars[at-k];const w=String(k) as "1"|"3"|"5";if(!old||!prior){windows[w]=null;continue;}
   const before=pct(prior.close,old.ema),after=pct(p.close,cur.ema),ret=pct(p.close,prior.close);
   const approach=before>0&&after>=0&&ret<0&&Math.abs(after)<Math.abs(before)?"down_to":before<0&&after<=0&&ret>0&&Math.abs(after)<Math.abs(before)?"up_to":Math.abs(after)>Math.abs(before)?"away":"none";
   const events:NonNullable<EmaObservation["windows"]["1"]>["events"]=[];
   for(let j=at-k+1;j<=at;j++){
    const a=levels.get(j-1),b=levels.get(j);if(!a||!b)continue;
    for(const boundary of ["ema","upper","lower"] as const){
     const direction=cross(bars[j-1].close-a[boundary],bars[j].close-b[boundary]);
     if(direction!=="none")events.push({session:day(bars[j].time),boundary,direction});
    }
   }
   // Endpoint state plus each observed completed-session crossing within the window.
   windows[w]={returnPct:ret,approach,emaCross:cross(prior.close-old.ema,p.close-cur.ema),upperCross:cross(prior.close-old.upper,p.close-cur.upper),lowerCross:cross(prior.close-old.lower,p.close-cur.lower),events};
  }
  const closeHolds:CloseHold[]=[];
  if(contiguous&&cur.warmup==="READY"&&windows["5"]){
   for(const boundary of ["ema","upper","lower"] as const){
    const event=windows["5"].events.filter(e=>e.boundary===boundary).at(-1);
    if(!event)continue;
    const start=bars.findIndex(b=>day(b.time)===event.session);
    if(start<1||levels.get(start-1)?.warmup!=="READY")continue;
    let valid=true;
    for(let j=start;j<=at;j++){
     const level=levels.get(j);
     if(!level||level.warmup!=="READY"||(event.direction==="up"?bars[j].close<=level[boundary]:bars[j].close>=level[boundary])){valid=false;break;}
    }
    if(valid)closeHolds.push({boundary,direction:event.direction,crossedOn:event.session,consecutiveCloses:at-start+1,status:at-start>=2?"HOLD_CONFIRMED":"BREAK_ONLY"});
   }
  }
  let respectedBandTrend:RespectedBandTrend|null=null;
  if(frame==="D"&&trendContiguous&&cur.warmup==="READY"){
   const trail=trendBars.map((b,i)=>{const j=trendStart+i;const level=levels.get(j)??bandAt(bars.slice(0,j+1),period,multiplier);return level?.warmup==="READY"?{day:day(b.time),close:b.close,upper:level.upper,lower:level.lower}:null;});
   if(trail.every((x):x is NonNullable<typeof x>=>x!==null))respectedBandTrend=replayRespectedBand(trail);
  }
  observations.push({frame,period,multiplier,asOf,...cur,distancePct:pct(p.close,cur.ema),side,band,windows,closeHolds,...(frame==="D"?{respectedBandTrend}:{})});
 }}
 return {asOf,method:"FIRST_CLOSE_EMA_ROLLING_CLOSE_POPULATION_SD",observations,unavailable};
}
