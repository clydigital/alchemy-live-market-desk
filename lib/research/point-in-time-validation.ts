/** Offline research diagnostic. No acquisition, database writes, or promotion of a signal. */
export type Timed<T>={value:T;observedAt:string;availableAt:string;sourceId:string};
export type Session={date:string;closeAt:string;price:number|null;benchmark:number|null;
 signal:Timed<boolean>|null;modifier:Timed<boolean>|null;trend:Timed<boolean>|null;
 regime:Timed<string>|null;var95:Timed<number>|null;var99:Timed<number>|null};
export type Input={instrument:string;benchmarkInstrument:string;signalDefinition:string;modifierDefinition:string;trendDefinition:string;regimeDefinition:string;priceBasis:string;sourceManifest:string;calendarAttestation:string;frozenAt:string;trainEnd:string;minSample:number;sessions:Session[]};
const time=(s:string)=>typeof s==="string"&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)?Date.parse(s):NaN;
const day=(s:string)=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const positive=(n:number|null)=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function known<T>(x:Timed<T>|null,cutoff:number,valid:(v:T)=>boolean):T|null{
 if(!x||typeof x.sourceId!=="string"||!x.sourceId.trim()||!valid(x.value))return null;
 const o=time(x.observedAt),a=time(x.availableAt);
 return Number.isFinite(o)&&Number.isFinite(a)&&o<=a&&a<=cutoff?x.value:null;
}
const bool=(x:unknown):x is boolean=>typeof x==="boolean";
const nonempty=(x:unknown):x is string=>typeof x==="string"&&!!x.trim();
const risk=(x:unknown):x is number=>typeof x==="number"&&Number.isFinite(x)&&x>0&&x<100;
type Outcome={date:string;end:string;signal:boolean;modifier:boolean;trend:boolean;regime:string;ret:number;excess:number;drawdown:number;rv:number};
function summary(rows:Outcome[],min:number){
 const n=rows.length;
 return {n,status:n<min?"INSUFFICIENT_SAMPLE":"DESCRIPTIVE_ONLY",meanReturnPct:mean(rows.map(r=>r.ret)),meanExcessPct:mean(rows.map(r=>r.excess)),positiveRate:n?rows.filter(r=>r.ret>0).length/n:null,meanDrawdownPct:mean(rows.map(r=>r.drawdown)),meanRealizedVolPct:mean(rows.map(r=>r.rv))};
}
export function evaluatePointInTime(input:Input){
 if(!input||!Array.isArray(input.sessions)||input.sessions.length<3||!day(input.trainEnd)||!Number.isInteger(input.minSample)||input.minSample<20||!Number.isFinite(time(input.frozenAt)))throw Error("Invalid frozen evaluation contract");
 for(const name of ["instrument","benchmarkInstrument","signalDefinition","modifierDefinition","trendDefinition","regimeDefinition","priceBasis","sourceManifest","calendarAttestation"] as const)if(!nonempty(input[name]))throw Error("Missing "+name);
 const x=input.sessions;
 for(let i=0;i<x.length;i++){
  const r=x[i],t=time(r.closeAt);
  if(!day(r.date)||!Number.isFinite(t)||t>time(input.frozenAt)||(i&&(r.date<=x[i-1].date||t<=time(x[i-1].closeAt)))||!(r.price===null||positive(r.price))||!(r.benchmark===null||positive(r.benchmark)))throw Error("Invalid ordered completed session "+i);
 }
 const horizons=[1,5,20,60].map(h=>{
  const training:Outcome[]=[],holdout:Outcome[]=[];
  let unavailable=0,purged=0,censored=0;
  // Fixed, non-overlapping grid anchored before observing any signal. Entry at next close.
  for(let i=0;i<x.length;i+=h+1){
   const s=x[i],entry=i+1,end=entry+h;
   if(end>=x.length){censored++;continue;}
   const e=x[end],isTraining=s.date<=input.trainEnd;
   if(isTraining&&e.date>input.trainEnd){purged++;continue;}
   const cutoff=time(s.closeAt);
   const sig=known(s.signal,cutoff,bool),mod=known(s.modifier,cutoff,bool),trend=known(s.trend,cutoff,bool),regime=known(s.regime,cutoff,nonempty);
   const window=x.slice(entry,end+1);
   if(sig===null||mod===null||trend===null||regime===null||window.some(r=>!positive(r.price)||!positive(r.benchmark))){unavailable++;continue;}
   const p=window.map(r=>r.price!),b=window.map(r=>r.benchmark!);
   const ret=100*(p.at(-1)!/p[0]-1),excess=ret-100*(b.at(-1)!/b[0]-1);
   let peak=p[0],dd=0;const logReturns:number[]=[];
   for(let j=1;j<p.length;j++){peak=Math.max(peak,p[j]);dd=Math.min(dd,100*(p[j]/peak-1));logReturns.push(Math.log(p[j]/p[j-1]));}
   const rv=100*Math.sqrt(logReturns.reduce((a,r)=>a+r*r,0)/h*252);
   (isTraining?training:holdout).push({date:s.date,end:e.date,signal:sig,modifier:mod,trend,regime,ret,excess,drawdown:dd,rv});
  }
  const summarize=(rows:Outcome[])=>{
   const group=(subset:Outcome[])=>({all:summary(subset,input.minSample),signal:summary(subset.filter(r=>r.signal),input.minSample),noSignal:summary(subset.filter(r=>!r.signal),input.minSample),signalAndModifier:summary(subset.filter(r=>r.signal&&r.modifier),input.minSample),signalWithoutModifier:summary(subset.filter(r=>r.signal&&!r.modifier),input.minSample),trendOnly:summary(subset.filter(r=>r.trend),input.minSample),signalWithinTrend:summary(subset.filter(r=>r.trend&&r.signal),input.minSample)});
   const regimes=[...new Set(rows.map(r=>r.regime))].sort();
   return {overall:group(rows),byRegime:regimes.map(regime=>({regime,...group(rows.filter(r=>r.regime===regime))}))};
  };
  return {horizonSessions:h,coverage:{unavailable,purged,censored,training:training.length,holdout:holdout.length},training:summarize(training),holdout:summarize(holdout)};
 });
 // VaR model exception frequency is not a directional prediction. Both quantiles
 // use the same available cohort and next-session log loss in percentage points.
 const outcomes:{date:string;index:number;loss:number;v95:number;v99:number}[]=[];
 let riskUnavailable=0;
 for(let i=0;i<x.length-1;i++){
  const s=x[i],n=x[i+1];if(s.date<=input.trainEnd)continue;
  const a=known(s.var95,time(s.closeAt),risk),b=known(s.var99,time(s.closeAt),risk);
  if(a===null||b===null||b<a||!positive(s.price)||!positive(n.price)){riskUnavailable++;continue;}
  outcomes.push({date:s.date,index:i,loss:-100*Math.log(n.price!/s.price!),v95:a,v99:b});
 }
 const exceptions=(k:"v95"|"v99",expected:number)=>{
  let consecutive=0,longest=0,count=0,lastIndex=-2;
  for(const r of outcomes){if(r.index!==lastIndex+1)consecutive=0;lastIndex=r.index;if(r.loss>r[k]){count++;consecutive++;longest=Math.max(longest,consecutive);}else consecutive=0;}
  return {n:outcomes.length,exceptions:count,observedRate:outcomes.length?count/outcomes.length:null,expectedRate:expected,longestConsecutiveSessionExceptions:longest,status:outcomes.length<input.minSample?"INSUFFICIENT_SAMPLE":"DESCRIPTIVE_ONLY"};
 };
 return {contract:"bluebelly/point-in-time-validation/1",metadata:{instrument:input.instrument,benchmarkInstrument:input.benchmarkInstrument,signalDefinition:input.signalDefinition,modifierDefinition:input.modifierDefinition,trendDefinition:input.trendDefinition,regimeDefinition:input.regimeDefinition,priceBasis:input.priceBasis,sourceManifest:input.sourceManifest,calendarAttestation:input.calendarAttestation,frozenAt:input.frozenAt,trainEnd:input.trainEnd,minSample:input.minSample},horizons,riskCalibration:{unavailable:riskUnavailable,var95:exceptions("v95",.05),var99:exceptions("v99",.01)},limitations:["Manual supplied frozen observations; source availability and calendar completeness require independent review.","Fixed chronological holdout, not a walk-forward significance test. No confidence intervals, causal attribution, trading costs or multiple-test correction.","Common coverage cohort and fixed non-overlapping grid; results may be sensitive to grid anchor and missingness.","VaR exceptions are measured on the supplied instrument; verify that it matches the model exposure and units.","No signal is promoted or assigned a probability."]};
}
