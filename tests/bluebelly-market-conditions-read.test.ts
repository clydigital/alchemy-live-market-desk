import test from "node:test";
import assert from "node:assert/strict";
import {selectConditionRow,conditionIsCurrent,conditionHasLevel,conditionTreasuryRow} from "../lib/bluebelly-market-conditions-read.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
const now=new Date("2026-11-28T04:48:00Z");
const row=(id:string,type:PublicMarketObservation["type"],asOf:string,change:number|null=1):PublicMarketObservation=>({id,symbol:id.toUpperCase(),label:id,type,asOf,change,last:100,change3d:null,change5d:null,changeUnit:"%",frequency:"daily",sourceName:"test",sourceUrl:null});
test("uses completed Black Friday session and does not choose stale SMH or unrelated stocks",()=>{
 const stale=row("smh","AI / Semis","2026-11-25"),fresh=row("soxx","AI / Semis","2026-11-27");
 assert.equal(selectConditionRow([stale,fresh,row("amd","AI / Semis","2026-11-27")],"ai",now),fresh);
 assert.equal(conditionIsCurrent(stale,"ai",now),false);
 assert.equal(conditionHasLevel(stale,now),true);
 assert.equal(conditionIsCurrent(fresh,"ai",now),true);
 assert.equal(selectConditionRow([row("amd","AI / Semis","2026-11-27")],"ai",now),null);
});
test("oil and nominal yields never fall back to unrelated products or real yields",()=>{
 const wti=row("wti","Energy","2026-11-27");
 assert.equal(selectConditionRow([row("nlr","Energy","2026-11-27"),wti],"energy",now),wti);
 assert.equal(selectConditionRow([row("us10y-real","Rates","2026-11-27"),row("us2y","Rates","2026-11-27")],"bonds",now),null);
 assert.equal(selectConditionRow([row("brent","Energy","2026-11-30")],"energy",now),null);
});
test("existing Treasury ledger supplies a measured nominal yield even without the market monitor",()=>{
 const r=conditionTreasuryRow([{id:"us10y-fred",points:[{time:Date.parse("2026-11-25")/1000,close:4.1},{time:Date.parse("2026-11-27")/1000,close:4.12}],sourceUrl:"https://home.treasury.gov/",sourceUpdatedAt:null}]);
 assert.equal(r?.last,4.12);assert.ok(Math.abs(r!.change!-2)<1e-8);
 assert.equal(r?.asOf,"2026-11-27");assert.equal(r?.changeUnit,"bp");
 assert.equal(selectConditionRow([r!],"bonds",now),r);
 assert.equal(conditionTreasuryRow([]),null);
});
