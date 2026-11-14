import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCrashMarketPhase} from "../lib/bluebelly-crash-market-phase.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
import {scoreReviewedCrashTranscripts} from "../lib/bluebelly-crash-transcript-score.ts";
import type {PrivateCreatorReview} from "../lib/bluebelly-private-creator-reviews.ts";
import type {CrashWatchView} from "../lib/bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary} from "../lib/bluebelly-market-compass.ts";

const now=new Date("2026-11-14T09:00:00Z");
function dates(){
 const out:number[]=[];
 let d=Date.parse("2026-11-13T17:00:00Z");
 while(out.length<126){
  const weekDay=new Date(d).getUTCDay();
  if(weekDay!==0&&weekDay!==6)out.push(Math.trunc(d/1000));
  d-=86400000;
 }
 return out.reverse();
}
const sessionDates=dates();
function row(id:string,values:number[]):MarketMonitorRow{
 const points=sessionDates.map((time,i)=>({time,close:values[i]}));
 return {id,frequency:"daily",last:values.at(-1)!,asOf:"2026-11-13",
  sourceUrl:"https://fred.stlouisfed.org/series/SP500",sourceName:"Test dated closes",
  points} as MarketMonitorRow;
}
const base=()=>Array.from({length:126},()=>100);
const shock=()=>{const x=base();x[15]=120;x[60]=90;x[125]=110;return x};
test("price damage and rebound are separate from the present source-pressure tilt",()=>{
 const p=buildCrashMarketPhase([
  row("spx",shock()),row("nasdaq-comp",base()),row("smh",shock())
 ],now);
 assert.equal(p.covered,3);
 assert.equal(p.assets[0].severity,"BEAR_DRAWDOWN");
 assert.equal(p.assets[0].state,"RECOVERY_TEST");
 assert.equal(p.assets[0].worstDrawdownPercent,-25);
 assert.equal(p.assets[0].currentDrawdownPercent,-8.33);
 assert.equal(p.assets[0].recoveryOfLossPercent,66.67);
 assert.equal(p.assets[0].peakToTroughSessions,45);
 assert.equal(p.assets[0].asOf,"2026-11-13");
 assert.match(p.headline,/already happened/);
});
test("sector crash is not passed off as S&P-wide bear market",()=>{
 const p=buildCrashMarketPhase([
  row("spx",base()),row("nasdaq-comp",base()),row("smh",shock())
 ],now);
 assert.equal(p.assets[0].severity,"NO_CORRECTION");
 assert.equal(p.assets[2].severity,"BEAR_DRAWDOWN");
 assert.match(p.headline,/Semiconductor bear-market drawdown/);
});
test("reclaimed price level differs from a rebound and cannot erase prior 20% damage",()=>{
 const x=shock();x[125]=119.8;
 const p=buildCrashMarketPhase([row("spx",x)],now);
 assert.equal(p.assets[0].state,"RECLAIMED");
 assert.equal(p.assets[0].severity,"BEAR_DRAWDOWN");
 assert.equal(p.assets[0].worstDrawdownPercent,-25);
});
test("an older recovered crash cannot hide a newer selloff from a new high",()=>{
 const x=base();x[15]=120;x[50]=90;x[85]=135;x[125]=111;
 const p=buildCrashMarketPhase([row("spx",x)],now);
 assert.equal(p.assets[0].severity,"BEAR_DRAWDOWN");
 assert.equal(p.assets[0].state,"SELLOFF");
 assert.equal(p.assets[0].currentDrawdownPercent,-17.78);
 assert.equal(p.assets[0].worstDrawdownPercent,-25);
});
test("missing, stale, mismatched and short price histories fail closed",()=>{
 const short=row("spx",base());
 short.points=short.points.slice(-25);
 const q=buildCrashMarketPhase([short],now);
 assert.equal(q.covered,0);
 assert.equal(q.assets[0].state,"UNMEASURED");
 const stale=row("spx",base());stale.asOf="2026-11-06";
 assert.equal(buildCrashMarketPhase([stale],now).assets[0].state,"UNMEASURED");
 const fabricated=row("spx",base());fabricated.last=120;
 assert.equal(buildCrashMarketPhase([fabricated],now).assets[0].state,"UNMEASURED");
 const source=row("spx",base());source.sourceUrl="http://example.org";
 assert.equal(buildCrashMarketPhase([source],now).assets[0].state,"UNMEASURED");
});
function review(publisher:string,claims:{kind:string;claim:string}[],day:string,id:string):PrivateCreatorReview{
 return {publisher,videoId:id,title:"Private review",url:"https://www.youtube.com/watch?v="+id,
 publishedAt:day,summary:"Reviewed",logic:"Research",
 claimChecks:claims.map(c=>({...c,verificationTarget:null}))};
}
const datedView:CrashWatchView={position:"CONTESTED",confidence:"LOW",lastReviewed:"2026-11-14T09:00:00Z",
 confirmedSignals:0,measurementCoverage:2,sourceStatus:"PARTIAL",caveat:"Test",
 readings:[{id:"hy-oas",label:"HY",symbol:"HY",value:3.5,dayChange:null,fiveSessionChange:-12,
  unit:"spread-percent",asOf:"2026-11-12",sourceName:"FRED",sourceUrl:"https://fred.stlouisfed.org/series/BAMLH0A0HYM2",status:"DATED",note:"Test"}],
 pillars:[
 {id:"credit",name:"Credit",signal:"MIXED",basis:"-12bp",observedAt:"2026-11-12",nextTest:"Check",watchId:"bonds"},
 {id:"breadth",name:"Breadth",signal:"MIXED",basis:"-0.14pp",observedAt:"2026-11-13",nextTest:"Check",watchId:"breadth"}
 ]};
const mixedTape:MarketCompassSummary={state:"MIXED",title:"Mixed",
 sourceSession:"2026-11-13",evidenceCount:4,explanation:"Test",contradiction:"Test",nextTest:"Test",note:"Test"};
test("all market gates mixed: show research coverage but no false creator corroboration",()=>{
 const reviews=[
  review("StockedUp",[
   {kind:"market_observation",claim:"Stocks are falling"},
   {kind:"cited_fact",claim:"AI CDS spreads moved higher"},
   {kind:"creator_claim",claim:"ETF flows rose into SPY"},
  ],"2026-11-12T04:00:00Z","abcdefghijk")
 ];
 const x=scoreReviewedCrashTranscripts(reviews,datedView,mixedTape,now);
 assert.equal(x.status,"AVAILABLE");
 assert.equal(x.confirmingMarketGates,0);
 assert.equal(x.reviewedPublishers,1);
 assert.equal(x.observationalClaims,2);
 assert.equal(x.eligibleClaims,1);
 assert.equal(x.crashUnits,0);
 assert.equal(x.opportunityUnits,0);
 assert.equal(x.corroboratedPublishers,0);
 assert.ok(x.researchThemes.some(t=>t.id==="AI_CREDIT"));
 assert.ok(x.researchThemes.some(t=>t.id==="FLOWS"));
});
test("earlier corroborated video is not silently suppressed by a newer one from the same publisher",()=>{
 const qualified:CrashWatchView={...datedView,pillars:datedView.pillars.map(p=>
  p.id==="credit"?{...p,signal:"BEAR" as const}:p)};
 const x=scoreReviewedCrashTranscripts([
  review("StockedUp",[{kind:"creator_claim",claim:"Nvidia outlook uncertain"}],
   "2026-11-13T00:00:00Z","abcdefghijk"),
  review("StockedUp",[{kind:"market_observation",claim:"Credit spreads are widening"}],
   "2026-11-12T00:00:00Z","12345678901"),
 ],qualified,mixedTape,now);
 assert.equal(x.reviewedVideos,2);
 assert.equal(x.reviewedPublishers,1);
 assert.equal(x.confirmingMarketGates,1);
 assert.equal(x.corroboratedPublishers,1);
 assert.equal(x.crashUnits,.25);
});
test("page contains both an independent damage phase and honest transcript gate diagnostics",()=>{
 const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const page=read("app/blue-desk/crash-opportunity/page.tsx");
 const component=read("components/blue-desk/CrashEvidenceSeesaw.tsx");
 const panel=read("components/blue-desk/CrashMarketPhasePanel.tsx");
 assert.match(page,/buildCrashMarketPhase\(monitor\?\.rows\?\?null,now\)/);
 assert.match(page,/<CrashMarketPhasePanel phase=\{marketPhase\}\/>/);
 assert.match(component,/MARKET CONFIRMATION GATES CLOSED/);
 assert.match(component,/data-transcript-market-gates/);
 assert.match(component,/UNVERIFIED RESEARCH LEADS/);
 assert.match(panel,/data-phase-severity/);
 assert.match(panel,/not automatic evidence of a rapid crash or systemic contagion/);
 assert.doesNotMatch(page,/creator_logic|claim_checks|createSupabaseAdminClient/);
});
