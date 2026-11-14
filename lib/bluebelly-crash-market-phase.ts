import type {MarketMonitorRow} from "./market-monitor.ts";

/**
 * Observational six-month drawdown lens. It measures price damage already
 * experienced; it is NOT a forecast and is deliberately independent of the
 * source-pressure seesaw. A 20% decline is a bear-market price definition,
 * not by itself proof of a systemic or financing-led crash.
 */
export type MarketPhaseState=
 "UNMEASURED"|"NEAR_HIGH"|"PULLBACK"|"SELLOFF"|"REBOUND"|"RECOVERY_TEST"|"RECLAIMED";
export type MarketPhaseAsset=Readonly<{
 id:"spx"|"nasdaq-comp"|"smh";
 label:string;basis:string;sourceUrl:string|null;
 state:MarketPhaseState;asOf:string|null;
 observedSessions:number;
 last:number|null;
 currentDrawdownPercent:number|null;
 worstDrawdownPercent:number|null;
 recoveryOfLossPercent:number|null;
 peakAt:string|null;troughAt:string|null;
 peakToTroughSessions:number|null;
 severity:"BEAR_DRAWDOWN"|"CORRECTION"|"NO_CORRECTION"|"UNKNOWN";
 explanation:string;
}>;
export type CrashMarketPhase=Readonly<{
 assets:readonly MarketPhaseAsset[];
 headline:string;
 subline:string;
 session:string|null;
 covered:number;
}>;

const WINDOW=126;
const MIN_HISTORY=90;
const DAY=86400000;
const ASSETS=[
 {id:"spx",label:"S&P 500 cash index",basis:"S&P 500 cash close · not an ETF"},
 {id:"nasdaq-comp",label:"Nasdaq Composite",basis:"Nasdaq cash index close"},
 {id:"smh",label:"SMH semiconductors",basis:"SMH ETF price close · not a semiconductor cash index"}
] as const;

function calendarDay(s:string|null|undefined):string|null{
 if(!s||!/^20\d{2}-\d{2}-\d{2}$/.test(s))return null;
 const ms=Date.parse(s+"T00:00:00Z");
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===s?s:null;
}
function safeSource(s:string):boolean{
 try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&s.length<2048}
 catch{return false}
}
function missing(spec:typeof ASSETS[number],note:string):MarketPhaseAsset{
 return {id:spec.id,label:spec.label,basis:spec.basis,sourceUrl:null,
  state:"UNMEASURED",asOf:null,observedSessions:0,last:null,
  currentDrawdownPercent:null,worstDrawdownPercent:null,recoveryOfLossPercent:null,
  peakAt:null,troughAt:null,peakToTroughSessions:null,severity:"UNKNOWN",
  explanation:note};
}
function round(value:number):number{return Number(value.toFixed(2))}
function classify(row:MarketMonitorRow|undefined,spec:typeof ASSETS[number],now:Date):MarketPhaseAsset{
 if(!row||row.frequency!=="daily"||!calendarDay(row.asOf)||
   !Number.isFinite(row.last)||row.last===null||row.last<=0||
   !safeSource(row.sourceUrl)||!Number.isFinite(now.getTime()))
  return missing(spec,"A source-dated positive daily price history is unavailable.");
 const asOf=row.asOf!;
 const asOfMs=Date.parse(asOf+"T00:00:00Z");
 if(asOfMs>now.getTime()||now.getTime()-asOfMs>5*DAY)
  return missing(spec,"The latest daily close is stale or in the future.");
 const map=new Map<string,{date:string;close:number}>();
 for(const p of row.points){
  if(!Number.isFinite(p.time)||!Number.isFinite(p.close)||p.close<=0)continue;
  const time=p.time*1000;
  if(!Number.isFinite(time)||time>now.getTime()||time<now.getTime()-470*DAY)continue;
  const date=new Date(time).toISOString().slice(0,10);
  if(date>asOf)continue;
  map.set(date,{date,close:p.close});
 }
 const entries=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-WINDOW);
 const last=entries.at(-1);
 if(entries.length<MIN_HISTORY||!last||last.date!==asOf||
   Math.abs(last.close-row.last!)/row.last!>0.005)
  return missing(spec,"Too few matched, fresh daily price closes for a 126-session lookback.");
 let runningPeak=entries[0].close,runningPeakIndex=0;
 let maxDepth=0,drawPeakIndex=0,drawTroughIndex=0;
 let high=entries[0].close;
 for(let i=1;i<entries.length;i++){
  const close=entries[i].close;
  if(close>runningPeak){runningPeak=close;runningPeakIndex=i}
  if(close>high)high=close;
  const depth=(runningPeak-close)/runningPeak*100;
  if(depth>maxDepth){maxDepth=depth;drawPeakIndex=runningPeakIndex;drawTroughIndex=i}
 }
 const peak=entries[drawPeakIndex],trough=entries[drawTroughIndex];
 const currentDrawdown=(last.close/high-1)*100;
 const recoveredFraction=maxDepth>0?
  (last.close-trough.close)/(peak.close-trough.close)*100:0;
 const severity=maxDepth>=20?"BEAR_DRAWDOWN":maxDepth>=10?"CORRECTION":"NO_CORRECTION";
 const phase:MarketPhaseState=maxDepth>=10&&last.close>=peak.close*0.995?
  "RECLAIMED":maxDepth>=10&&recoveredFraction>=65?
  "RECOVERY_TEST":maxDepth>=10&&recoveredFraction>=15?
  "REBOUND":maxDepth>=10?"SELLOFF":
  currentDrawdown<=-5?"PULLBACK":"NEAR_HIGH";
 const explanation=severity==="BEAR_DRAWDOWN"?
  "A 20%+ peak-to-trough price drawdown occurred in this window; this alone does not prove systemic financial contagion.":
  severity==="CORRECTION"?
  "A 10%+ correction already occurred in this window; distinguish rebound from reclaimed highs.":
  "No 10% correction was observed within these 126 completed sessions.";
 return {id:spec.id,label:spec.label,basis:spec.basis,sourceUrl:row.sourceUrl,
  state:phase,asOf,observedSessions:entries.length,last:last.close,
  currentDrawdownPercent:round(currentDrawdown),
  worstDrawdownPercent:round(-maxDepth),
  recoveryOfLossPercent:round(Math.max(0,recoveredFraction)),
  peakAt:maxDepth>0?peak.date:null,troughAt:maxDepth>0?trough.date:null,
  peakToTroughSessions:maxDepth>0?drawTroughIndex-drawPeakIndex:null,
  severity,explanation};
}
export function buildCrashMarketPhase(
 rows:readonly MarketMonitorRow[]|null,now:Date
):CrashMarketPhase{
 const assets=ASSETS.map(spec=>classify(rows?.find(r=>r.id===spec.id),spec,now));
 const spx=assets[0],nasdaq=assets[1],smh=assets[2];
 const covered=assets.filter(a=>a.state!=="UNMEASURED").length;
 const session=assets.map(a=>a.asOf).filter((v):v is string=>v!==null).sort().at(-1)??null;
 const headline=spx.state==="UNMEASURED"?
  "Broad-market crash phase unmeasured":
  spx.severity==="BEAR_DRAWDOWN"?
  "A broad-market 20%+ drawdown already happened":
  spx.severity==="CORRECTION"?
  "A broad-market correction already happened":
  smh.severity==="BEAR_DRAWDOWN"?
  "Semiconductor bear-market drawdown; not an S&P-wide correction":
  nasdaq.severity==="CORRECTION"?
  "Nasdaq correction observed; S&P 500 below correction threshold":
  "No 10% S&P 500 correction observed in the measured window";
 const subline=spx.state==="UNMEASURED"?
  "No inference about a past crash or recovery without sufficient comparable price history.":
  "Six-month price-path classification only. A rebound after a drawdown may be short-covering; a reclaimed price high does not verify earnings, credit, funding or durable trend.";
 return {assets,headline,subline,session,covered};
}
