import test from "node:test";
import assert from "node:assert/strict";
import {buildMarketCompassSummary} from "../lib/bluebelly-market-compass.ts";
import type {MarketDivergenceRead} from "../lib/bluebelly-market-divergence-watch.ts";

const NOW=new Date("2026-11-14T12:00:00Z");
function pair(id:string,left:number,right:number,date="2026-11-13"):MarketDivergenceRead{
 return {id,title:id,left:id==="semis-vs-nasdaq"?"SMH":"RSP",
  right:id==="semis-vs-nasdaq"?"QQQ":"SPY",question:"",nextTest:"",
  status:left*right<0?"OPPOSITE_MOVE":"RELATIVE_MOVE",leftChange:left,
  rightChange:right,gapPp:Number((left-right).toFixed(2)),sourceSession:date,
  leftSourceUrl:"https://example.org/left",rightSourceUrl:"https://example.org/right",reason:null};
}
const inputs=(a:number,b:number,c:number,d:number)=>[
 pair("semis-vs-nasdaq",a,b),pair("equal-vs-cap",c,d)
];
test("market direction requires two matching same-session ETF pairs",()=>{
 assert.equal(buildMarketCompassSummary([],NOW).state,"UNMEASURED");
 assert.equal(buildMarketCompassSummary(inputs(1,2,3,4).slice(0,1),NOW).state,"UNMEASURED");
 const mismatched=inputs(1,2,3,4);mismatched[1].sourceSession="2026-11-12";
 assert.equal(buildMarketCompassSummary(mismatched,NOW).state,"UNMEASURED");
});
test("does not promote stale tape into a live directional read",()=>{
 assert.equal(buildMarketCompassSummary([
  pair("semis-vs-nasdaq",1,1,"2026-11-01"),
  pair("equal-vs-cap",1,1,"2026-11-01")
 ],NOW).state,"UNMEASURED");
});
test("direction is ordinal and observed, not a confidence probability",()=>{
 assert.equal(buildMarketCompassSummary(inputs(1,2,1,2),NOW).state,"RISK_ON");
 assert.equal(buildMarketCompassSummary(inputs(-1,-2,-1,-2),NOW).state,"RISK_OFF");
 const mixed=buildMarketCompassSummary(inputs(-1,2,0.8,1.5),NOW);
 assert.equal(mixed.state,"MIXED");
 assert.match(mixed.contradiction,/opposite directions/);
 assert.match(mixed.note,/no estimated 3D\/5D/);
});
test("missing or non-comparable evidence fails closed",()=>{
 const rows=inputs(1,2,3,4); rows[0].status="NOT_COMPARABLE";
 assert.equal(buildMarketCompassSummary(rows,NOW).state,"UNMEASURED");
 const rows2=inputs(1,2,3,4); rows2[1].leftChange=null;
 assert.equal(buildMarketCompassSummary(rows2,NOW).state,"UNMEASURED");
 const noReceipt=inputs(1,2,3,4);noReceipt[0].leftSourceUrl=null;
 assert.equal(buildMarketCompassSummary(noReceipt,NOW).state,"UNMEASURED");
 const future=inputs(1,2,3,4).map(r=>({...r,sourceSession:"2026-11-15"}));
 assert.equal(buildMarketCompassSummary(future,NOW).state,"UNMEASURED");
});
