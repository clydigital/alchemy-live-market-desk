import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessPceEvent, type PceMarketObservation } from "../lib/bluebelly-pce-event-assessment.ts";
import { originalUsReleaseClock, type EconEvent } from "../lib/bluebelly-us-econ-stat-watch.ts";

const releaseAt = "2026-11-25T13:30:00.000Z";
const now = new Date("2026-11-25T15:00:00.000Z");
const source = "https://www.bea.gov/news/2026/personal-income-and-outlays-october-2026";
function fixture(
  values:[number,number,number,number]=[0.3,3.8,0.2,3.1],
  forecasts:[number,number,number,number]=[0.3,3.8,0.3,3.2],
):EconEvent{
 const keys=["pce_headline_mom","pce_headline_yoy","pce_core_mom","pce_core_yoy"];
 return {
  id:"us-bea-2026-11-25-personal-income-outlays-oct-2026",
  name:"Personal Income and Outlays",
  family:"PCE",
  referencePeriod:"October 2026",
  releaseAt,sourceUrl:source,agency:"U.S. Bureau of Economic Analysis",
  sourceClock:"2026-11-25T13:38:00.000Z",status:"VERIFIED_ACTUAL",
  actualText:"Headline PCE +0.3% m/m; +3.8% y/y; Core PCE +0.2% m/m; +3.1% y/y",
  metrics:keys.map((key,index)=>({
   key,label:key,unit:"%",actual:values[index],forecast:forecasts[index],
   previous:null,revisedPrevious:null,
   forecastSource:"Dated vendor snapshot",forecastUrl:"https://example.org/econ/pce",
   forecastCapturedAt:"2026-11-25T13:25:00.000Z",
   surprise:Number((values[index]-forecasts[index]).toFixed(4)),
  })),
 };
}
function market(dxy:number,us2y:number):PceMarketObservation[]{
 return [
  {instrument:"DXY",change:dxy,unit:"%",startAt:"2026-11-25T13:29:00.000Z",
   endAt:"2026-11-25T14:00:00.000Z",sourceUrl:"https://example.org/quote/dxy",provenance:"DIRECT_INTRADAY"},
  {instrument:"US02Y",change:us2y,unit:"bp",startAt:"2026-11-25T13:29:00.000Z",
   endAt:"2026-11-25T14:00:00.000Z",sourceUrl:"https://example.org/quote/2y",provenance:"DIRECT_INTRADAY"},
 ];
}
test("pre-release and post-time missing actual never produce a surprise",()=>{
 const event=fixture();
 assert.equal(assessPceEvent(event,new Date("2026-11-25T13:00:00Z"))?.status,"PRE_RELEASE");
 assert.equal(assessPceEvent({...event,status:"SCHEDULED"},now)?.status,"AWAITING_VERIFIED_ACTUAL");
 assert.equal(assessPceEvent({...event,status:"AWAITING_ACTUAL"},now)?.status,"AWAITING_VERIFIED_ACTUAL");
 assert.equal(assessPceEvent({...event,status:"SOURCE_CONFLICT"},now)?.status,"SOURCE_CONFLICT");
});
test("missing actual metric fails closed, including when a release says verified",()=>{
 const e=fixture();
 assert.deepEqual(assessPceEvent({...e,metrics:e.metrics.slice(0,3)},now)?.missing,["pce_core_yoy"]);
 assert.equal(assessPceEvent({...e,metrics:e.metrics.slice(0,3)},now)?.status,"AWAITING_VERIFIED_ACTUAL");
});
test("incomplete or after-the-fact consensus is not a surprise",()=>{
 const e=fixture();
 const noForecast={...e,metrics:e.metrics.map(m=>m.key==="pce_core_mom"?{...m,forecast:null}:m)};
 assert.equal(assessPceEvent(noForecast,now)?.status,"CONSENSUS_UNVERIFIED");
 const late={...e,metrics:e.metrics.map(m=>({...m,forecastCapturedAt:"2026-11-25T13:29:00Z"}))};
 assert.equal(assessPceEvent(late,now)?.status,"CONSENSUS_UNVERIFIED");
 assert.equal(assessPceEvent(late,now)?.coreSurprisePp,null);
});
test("cooler-than-previous but in-line headline does not count as a downside surprise",()=>{
 const result=assessPceEvent(fixture(),now)!;
 assert.equal(result.status,"AWAITING_MARKET_CONFIRMATION");
 assert.equal(result.metricSurprises.find(x=>x.key==="pce_headline_mom")?.surprisePercentagePoints,0);
 assert.equal(result.coreSurprisePp,-0.1);
 assert.equal(result.policyRateFeed,"NOT_INTEGRATED");
 assert.equal(result.researchOnly,true);
});
test("soft core with synchronized weaker DXY and lower 2Y is conditional, not a canonical flip",()=>{
 const result=assessPceEvent(fixture(),now,market(-0.4,-8));
 assert.equal(result?.status,"USD_BEAR_CONDITIONAL");
 assert.match(result!.nextTest,/4H\/Daily/);
});
test("soft core and rising DXY produces mixed interpretation",()=>{
 assert.equal(assessPceEvent(fixture(),now,market(0.4,-8))?.status,"MIXED");
 assert.equal(assessPceEvent(fixture(),now,market(-0.4,8))?.status,"MIXED");
});
test("hotter core with higher DXY and 2Y stays conditional",()=>{
 assert.equal(assessPceEvent(fixture([0.4,3.9,0.4,3.3]),now,market(0.35,7))?.status,"USD_BULL_CONDITIONAL");
});
test("a daily Treasury quote cannot certify a 30-minute market reaction",()=>{
 const daily=market(-0.3,-5).map(r=>({...r,provenance:"DIRECT_INTRADAY" as const}));
 daily[1]={...daily[1],provenance:"DIRECT_INTRADAY",startAt:"2026-11-24T12:00:00.000Z"};
 assert.equal(assessPceEvent(fixture(),now,daily)?.status,"AWAITING_MARKET_CONFIRMATION");
 const mismatched=market(-0.3,-5);
 mismatched[1]={...mismatched[1],endAt:"2026-11-25T14:35:00Z"};
 assert.equal(assessPceEvent(fixture(),now,mismatched)?.status,"AWAITING_MARKET_CONFIRMATION");
});
test("EST and EDT official schedule use their actual UTC release clocks",()=>{
 const row={id:"us-bea",event:"Personal Income and Outlays",date:"2026-11-25",
  timeLabel:"08:30 ET",country:"United States",referencePeriod:"October 2026",
  sourceName:"U.S. Bureau of Economic Analysis",sourceUrl:"https://www.bea.gov/news/schedule",
  sourceKind:"official-live"};
 assert.equal(originalUsReleaseClock(row),"2026-11-25T13:30:00.000Z");
 assert.equal(originalUsReleaseClock({...row,date:"2026-07-24"}),"2026-07-24T12:30:00.000Z");
 assert.equal(originalUsReleaseClock({...row,timeLabel:"time unknown"}),null);
});
test("read-only public reader has no authority to write canon, private creator or holdings",()=>{
 const source=readFileSync("lib/bluebelly-pce-event-assessment.ts","utf8");
 assert.doesNotMatch(source,/createSupabaseAdminClient|service_role|portfolio_positions|story_thesis_versions|market_regime_current|upsert\(|insert\(/);
});
