import test from "node:test";
import assert from "node:assert/strict";
import {lane,fresh,myt,failureCategory,latest} from "../lib/my-desk-health-core.ts";
const at="2026-11-26T01:00:00Z";
const complete={success:at,fresh:true,coverageComplete:true};
test("all five states, coverage independent of successful execution",()=>{
 assert.equal(lane("x").state,"unknown");
 assert.equal(lane("x",{execution:"Completed"}).state,"unknown");
 assert.equal(lane("x",complete).state,"healthy");
 assert.equal(lane("x",{...complete,backupRecovered:true}).state,"recovered");
 assert.equal(lane("x",{...complete,coverageComplete:false}).state,"degraded");
 assert.equal(lane("x",{...complete,fresh:false}).state,"degraded");
 assert.equal(lane("x",{...complete,failed:true}).state,"failed");
 assert.equal(lane("x",{...complete,success:null}).state,"unknown");
});
test("freshness rejects future dates and handles absent receipts",()=>{
 assert.equal(fresh(at,new Date("2026-11-26T02:00:00Z"),2),true);
 assert.equal(fresh(at,new Date("2026-11-26T04:00:00Z"),2),false);
 assert.equal(fresh(at,new Date("2026-11-25T01:00:00Z"),2),null);
 assert.equal(fresh(null,new Date(),2),null);
 assert.equal(latest([null,"bad",at]),at);
 assert.match(myt(at),/09:00 MYT/);
 assert.equal(myt(null),"Unknown");
});
test("provider failures are classified without exposing raw secret strings",()=>{
 assert.equal(failureCategory("429 secret=abc"),"Rate limit/quota");
 assert.equal(failureCategory("budget_disabled"),"Budget/credits limited");
 assert.equal(failureCategory("https://secret.example/token"),"Provider error (details in source ledger)");
});
