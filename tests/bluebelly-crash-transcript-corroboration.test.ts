import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {scoreReviewedCrashTranscripts,emptyCrashTranscriptScore} from "../lib/bluebelly-crash-transcript-score.ts";
import {buildCrashEvidenceBalance} from "../lib/bluebelly-crash-evidence-balance.ts";
import type {PrivateCreatorReview} from "../lib/bluebelly-private-creator-reviews.ts";
import type {CrashSignal,CrashWatchView} from "../lib/bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary,CompassState} from "../lib/bluebelly-market-compass.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const now=new Date("2026-11-14T07:00:00Z");
function states(breadth:CrashSignal,credit:CrashSignal,tape:CompassState):[CrashWatchView,MarketCompassSummary]{
 return [
  {position:"CONTESTED",confidence:"LOW",lastReviewed:"2026-11-14T07:00:00Z",
   confirmedSignals:2,measurementCoverage:2,sourceStatus:"PARTIAL",caveat:"Source dated",
   readings:[{id:"hy-oas",label:"HY",symbol:"HY",value:3.4,dayChange:null,fiveSessionChange:34,
    unit:"spread-percent",asOf:"2026-11-12",sourceName:"FRED",
    sourceUrl:"https://fred.stlouisfed.org/series/BAMLH0A0HYM2",status:"DATED",note:"five observations"}],
   pillars:[
    {id:"breadth",name:"Breadth",signal:breadth,basis:"RSP/SPX five-session",
     nextTest:"Verify",watchId:"breadth",observedAt:"2026-11-12"},
    {id:"credit",name:"Credit",signal:credit,basis:"HY OAS source-dated move",
     nextTest:"Verify",watchId:"bonds",observedAt:"2026-11-12"}
   ]},
  {state:tape,title:tape==="RISK_OFF"?"Defensive tape":"Risk appetite improving",
   explanation:"Matched",contradiction:"Countercase",nextTest:"Verify",
   sourceSession:"2026-11-12",evidenceCount:4,note:"1D"}
 ];
}
function review(publisher:string,claims:string[],day="2026-11-13T02:00:00Z",id="abcdefghijk"):PrivateCreatorReview{
 return {publisher,videoId:id,title:"Public creator video",url:"https://www.youtube.com/watch?v="+id,
 publishedAt:day,logic:"A research hypothesis, not an independently verified fact",
 summary:"Market research review",
 claimChecks:claims.map(claim=>({kind:"market_observation",claim,
 verificationTarget:"Check dated original market data"}))};
}
test("source-checked transcript directions add a bounded separate counterweight",()=>{
 const [watch,compass]=states("BEAR","BEAR","RISK_OFF");
 const reviews=[
  review("FX Evolution",["Credit spreads are widening"],"2026-11-13T01:00:00Z","abcdefghijk"),
  review("StockedUp",["Credit spreads are widening"],"2026-11-12T12:00:00Z","lmnopqrstuv"),
  review("TraderNick",["RSP is underperforming"],"2026-11-12T18:00:00Z","12345678901"),
  review("Wall Street Truthbombs",["Market breadth is weakening"],"2026-11-12T21:00:00Z","22345678901"),
 ];
 const transcript=scoreReviewedCrashTranscripts(reviews,watch,compass,now);
 assert.equal(transcript.status,"AVAILABLE");
 assert.equal(transcript.corroboratedPublishers,4);
 assert.equal(transcript.crashUnits,1);
 assert.equal(transcript.opportunityUnits,0);
 assert.equal(transcript.topics.length,2);
 const balance=buildCrashEvidenceBalance(watch,compass,transcript);
 assert.equal(balance.marketCrashUnits,4.5);
 assert.equal(balance.crashUnits,5.5);
 assert.equal(balance.angle,13); // Saturation prevents excessive animation.
});
test("opposing creator videos carry simultaneous counterweights, not an artificial consensus",()=>{
 const [view,compass]=states("BULL","BEAR","RISK_ON");
 const transcript=scoreReviewedCrashTranscripts([
  review("StockedUp",["RSP is outperforming"],"2026-11-12T08:00:00Z"),
  review("FX Evolution",["High-yield credit spreads are widening"],"2026-11-13T08:00:00Z"),
 ],view,compass,now);
 assert.equal(transcript.opportunityUnits,.25);
 assert.equal(transcript.crashUnits,.25);
 const balance=buildCrashEvidenceBalance(view,compass,transcript);
 assert.equal(balance.marketOpportunityUnits,2.5);
 assert.equal(balance.marketCrashUnits,2);
 assert.equal(balance.opportunityUnits,2.75);
 assert.equal(balance.crashUnits,2.25);
 assert.ok(balance.angle<0);
});
test("transcript repetition cannot turn one publisher into multiple independent sources",()=>{
 const [view,compass]=states("BEAR","BEAR","RISK_OFF");
 const repeated=scoreReviewedCrashTranscripts([
  review("FX Evolution",["Credit spreads are widening"],"2026-11-13T08:00:00Z","abcdefghijk"),
  review("FX Evolution",["Credit spreads are widening"],"2026-11-12T08:00:00Z","12345678901"),
  review("TraderNick",["Credit spreads are widening","Credit spreads are widening"],
    "2026-11-12T09:00:00Z","22345678901"),
 ],view,compass,now);
 assert.equal(repeated.crashUnits,.5);
 assert.equal(repeated.corroboratedPublishers,2);
});
test("one creator covering three corroborated topics still counts at most 0.25",()=>{
 const [view,compass]=states("BEAR","BEAR","RISK_OFF");
 const digest=scoreReviewedCrashTranscripts([
  review("FX Evolution",[
   "Credit spreads are widening","RSP is underperforming","Stocks are falling"
  ])
 ],view,compass,now);
 assert.equal(digest.crashUnits,.25);
 assert.equal(digest.corroboratedPublishers,1);
 assert.equal(digest.topics.length,1);
 assert.equal(digest.topics[0].id,"credit");
});
test("uncorroborated, predicted, negated, mixed and non-admitted source claims score zero",()=>{
 const [watch,compass]=states("BEAR","MIXED","RISK_OFF");
 const reviews=[
  review("FX Evolution",["Credit spreads are widening"]), // actual credit mixed
  review("StockedUp",["Credit spreads could widen"]),
  review("TraderNick",["Market breadth is not weakening"]),
  review("Wall Street Truthbombs",[
   "Market breadth is improving","Market breadth is weakening"
  ],"2026-11-12T07:00:00Z")
 ];
 const transcript=scoreReviewedCrashTranscripts(reviews,watch,compass,now);
 assert.equal(transcript.crashUnits,0);
 assert.equal(transcript.opportunityUnits,0);
 assert.equal(transcript.corroboratedPublishers,0);
});
test("stale, future, non-curated, malformed, and mismatched FRED reading fail closed",()=>{
 const [watch,compass]=states("BEAR","BEAR","RISK_OFF");
 const rejects=[
  review("Random influencer",["Credit spreads are widening"]),
  review("FX Evolution",["Credit spreads are widening"],"2026-10-20T00:00:00Z"),
  review("TraderNick",["Credit spreads are widening"],"2026-11-20T00:00:00Z"),
  review("StockedUp",["Credit spreads are widening"],"2026-11-13T00:00:00Z","fake"),
 ];
 assert.equal(scoreReviewedCrashTranscripts(rejects,watch,compass,now).status,"EMPTY");
 const badWatch={...watch,readings:watch.readings.map(r=>({...r,status:"STALE" as const}))};
 assert.equal(scoreReviewedCrashTranscripts([
  review("StockedUp",["Credit spreads are widening"])
 ],badWatch,compass,now).crashUnits,0);
 const none=emptyCrashTranscriptScore("UNAVAILABLE");
 assert.equal(buildCrashEvidenceBalance(watch,compass,none).marketCrashUnits,4.5);
});
test("page uses existing server-only transcript reviews and exposes only aggregated research",()=>{
 const page=read("app/blue-desk/crash-opportunity/page.tsx");
 const server=read("lib/bluebelly-crash-transcript-score-server.ts");
 const component=read("components/blue-desk/CrashEvidenceSeesaw.tsx");
 const css=read("components/blue-desk/CrashEvidenceSeesaw.module.css");
 assert.match(page,/getCrashTranscriptScore\(watch,compass,now\)/);
 assert.match(page,/buildCrashEvidenceBalance\(watch,compass,transcriptScore\)/);
 assert.match(server,/import "server-only"/);
 assert.match(server,/getPrivateReviewedCreatorArguments\(now,10\)/);
 assert.match(component,/data-crash-transcript-score="reviewed-source-corroboration-v1"/);
 assert.match(component,/data-transcript-status=\{balance.transcript.status\}/);
 assert.match(component,/0.25 per creator/);
 assert.match(css,/\.transcriptPanel/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|transcript_text|claim_checks|creator_logic/);
 assert.doesNotMatch(component,/creator_logic|rawTranscript|transcriptText|claim_checks/);
});
