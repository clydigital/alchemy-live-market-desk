/** Pure EMA-centred Bollinger levels. No network, account data or trading verdicts.
 * Close-based population SD around the simple mean; EMA seeded with first close.
 * Closed bars only; caller supplies exchange-local calendar day and source identity.
 */
import {scheduledUsEquityCloseHourET,usEquitySessionCalendarBasis} from "./bluebelly-us-equity-trading-calendar.ts";
export type Frame="1day"|"1week"|"1month";
export type Bar={day:string;close:number};
export const EMA_PERIODS=[20,50,100,200] as const;
export const EMA_WIDTHS=[1,1,.5,.25] as const;
export type Band={period:number;multiplier:number;ema:number|null;sd:number|null;lower:number|null;upper:number|null;status:"READY"|"SHORT_WARMUP"|"INSUFFICIENT";distancePct:number|null;position:"ABOVE"|"INSIDE"|"BELOW"|null};
export type BoundaryEvent={period:number;boundary:"lower"|"ema"|"upper";direction:"up"|"down";kind:"CROSS"|"HOLD"|"APPROACH";level:number;distancePct:number;asOf:string;closes:number};
export type TechnicalLevels={frame:Frame;asOf:string|null;sampleCount:number;close:number|null;status:"OK"|"INVALID_HISTORY"|"UNAVAILABLE"|"STALE";reason:string|null;bands:Band[];events?:BoundaryEvent[]};
const dayMs=86400000;
function date(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const n=Date.parse(s+"T00:00:00Z");return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:null;}
function monday(n:number){const d=new Date(n).getUTCDay();return n-((d+6)%7)*dayMs;}
function month(s:string){return Number(s.slice(0,4))*12+Number(s.slice(5,7));}
const round=(n:number)=>Number(n.toFixed(8));
/** Common numerical kernel, used by both the owner provider pilot and BB's
 * completed-session scanner. Inputs must already be chronological, validated
 * completed closes. First-close seed matches the existing technical pilot. */
export function calculateEmaBand(closes:readonly number[],period:number,multiplier:number){
 if(closes.length<period||period<1||!Number.isInteger(period)||!Number.isFinite(multiplier)||multiplier<0)return null;
 const alpha=2/(period+1);let ema=closes[0];
 for(let i=1;i<closes.length;i++)ema+=alpha*(closes[i]-ema);
 const tail=closes.slice(-period),mean=tail.reduce((s,v)=>s+v,0)/period;
 const sd=Math.sqrt(tail.reduce((s,v)=>s+(v-mean)**2,0)/period);
 if(!Number.isFinite(ema)||ema<=0||!Number.isFinite(sd))return null;
 return {ema,sd,lower:ema-multiplier*sd,upper:ema+multiplier*sd,
  status:closes.length>=5*period?"READY" as const:"SHORT_WARMUP" as const};
}
export function unavailableLevels(frame:Frame,reason:string,status:TechnicalLevels["status"]="UNAVAILABLE"):TechnicalLevels{
 return {frame,asOf:null,sampleCount:0,close:null,status,reason,bands:EMA_PERIODS.map((period,i)=>({period,multiplier:EMA_WIDTHS[i],ema:null,sd:null,lower:null,upper:null,status:"INSUFFICIENT",distancePct:null,position:null}))};
}
export function calculateTechnicalLevels(input:readonly Bar[],frame:Frame,today:string):TechnicalLevels{
 const now=date(today);if(now===null)return unavailableLevels(frame,"Invalid exchange date","INVALID_HISTORY");
 const accepted=new Map<string,number>();
 for(const p of input){
  const t=date(p.day);if(t===null||p.day<"1900-01-01"||!Number.isFinite(p.close)||p.close<=0)return unavailableLevels(frame,"Invalid date or price","INVALID_HISTORY");
  if(p.day>today)return unavailableLevels(frame,"Future bar","INVALID_HISTORY");
  if(frame==="1day"?t>=now:frame==="1week"?monday(t)>=monday(now):month(p.day)>=month(today))continue;
  const key=frame==="1day"?p.day:frame==="1week"?new Date(monday(t)).toISOString().slice(0,10):p.day.slice(0,7);
  const old=accepted.get(key);if(old!==undefined&&old!==p.close)return unavailableLevels(frame,"Conflicting period","INVALID_HISTORY");
  accepted.set(key,p.close);
 }
 const rows=[...accepted].sort(([a],[b])=>a.localeCompare(b)).map(([key,close])=>({day:frame==="1month"?key+"-01":key,close}));
 if(!rows.length)return unavailableLevels(frame,"No completed bars");
 for(let i=1;i<rows.length;i++){
  const gap=(date(rows[i].day)!-date(rows[i-1].day)!)/dayMs;
  if(frame==="1month"?month(rows[i].day)-month(rows[i-1].day)!==1:frame==="1week"?gap!==7:gap>7||gap<1)
   return unavailableLevels(frame,"Missing history periods","INVALID_HISTORY");
 }
 const last=rows.at(-1)!,age=(now-date(last.day)!)/dayMs;
 const stale=frame==="1month"?month(today)-month(last.day)!==1:frame==="1week"?monday(now)-date(last.day)!>7*dayMs:age>6;
 const bands=EMA_PERIODS.map((period,i):Band=>{
  const multiplier=EMA_WIDTHS[i],empty:Band={period,multiplier,ema:null,sd:null,lower:null,upper:null,status:"INSUFFICIENT",distancePct:null,position:null};
  const result=calculateEmaBand(rows.map(p=>p.close),period,multiplier);
  if(!result)return empty;
  const {ema,sd,lower,upper,status}=result;
  return {...empty,ema:round(ema),sd:round(sd),lower:round(lower),upper:round(upper),status,distancePct:round((last.close/ema-1)*100),position:last.close>upper?"ABOVE":last.close<lower?"BELOW":"INSIDE"};
 });
 // Daily events require the latest four scheduled prior NYSE sessions;
 // the current exchange date is intentionally excluded by the existing reader.
 const expected:string[]=[];
 if(frame==="1day")for(let d=now-dayMs;d>=now-15*dayMs&&expected.length<4;d-=dayMs){
  const day=new Date(d).toISOString().slice(0,10);
  if(usEquitySessionCalendarBasis(day)!=="OFFICIAL_NYSE_2026_2028")break;
  if(scheduledUsEquityCloseHourET(day)!==null)expected.unshift(day);
 }
 const dailyReady=expected.length===4&&rows.slice(-4).every((r,i)=>r.day===expected[i]);
 const events=stale||frame==="1day"&&!dailyReady?[]:completedBoundaryEvents(rows.map(r=>r.close),last.day);
 return {frame,asOf:last.day,sampleCount:rows.length,close:last.close,status:stale?"STALE":"OK",reason:stale?"Latest completed period not present":null,bands,events};
}
export function exchangeDay(now:Date,timeZone:string){return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}

/** Last completed period events; caller must establish adjacency and freshness.
 * W/M use consecutive calendar periods; 4H and canonical daily retain their own
 * exchange-session guards. A 1% converging approach is not a cross. */
export function completedBoundaryEvents(closes:readonly number[],asOf:string):BoundaryEvent[]{
 const events:BoundaryEvent[]=[];
 if(closes.length<2)return events;
 for(const [i,period] of EMA_PERIODS.entries()){
  const current=calculateEmaBand(closes,period,EMA_WIDTHS[i]),previous=calculateEmaBand(closes.slice(0,-1),period,EMA_WIDTHS[i]);
  if(current?.status!=="READY"||previous?.status!=="READY")continue;
  for(const boundary of ["lower","ema","upper"] as const){
   const level=current[boundary],prior=previous[boundary],before=closes.at(-2)!-prior,after=closes.at(-1)!-level;
   if(level<=0||prior<=0)continue;
   const distancePct=after/level*100;
   if(before<=0&&after>0||before>=0&&after<0){events.push({period,boundary,direction:after>0?"up":"down",kind:"CROSS",level,distancePct,asOf,closes:1});continue;}
   if(closes.length>=4){
    const ds=closes.slice(-4).map((close,j)=>{const b=calculateEmaBand(closes.slice(0,closes.length-3+j),period,EMA_WIDTHS[i]);return b?.status==="READY"?close-b[boundary]:null;});
    if(ds.every(d=>d!==null)){const [a,b,c,d]=ds as number[];if(a<=0&&b>0&&c>0&&d>0||a>=0&&b<0&&c<0&&d<0){events.push({period,boundary,direction:d>0?"up":"down",kind:"HOLD",level,distancePct,asOf,closes:3});continue;}}
   }
   const delta=closes.at(-1)!-closes.at(-2)!;
   if(Math.abs(distancePct)<=1&&Math.abs(distancePct)<Math.abs(before/prior*100)&&(before<0&&after<=0&&delta>0||before>0&&after>=0&&delta<0))events.push({period,boundary,direction:before<0?"up":"down",kind:"APPROACH",level,distancePct,asOf,closes:1});
  }
 }
 return events;
}
