import test from "node:test";import assert from "node:assert/strict";
import {decodeNasdaqQqqShortInterest,positioningRead,qqqReleaseClock,qqqTapeState,type TapeWindow} from "../lib/bluebelly-qqq-positioning-core.ts";
const now=new Date("2026-11-16T05:00:00Z");
test("strict numeric observations and ordered settlement dates",()=>{
 const r=decodeNasdaqQqqShortInterest({data:{symbol:"QQQ",shortInterestTable:{rows:[
 {settlementDate:"10/15/2026",interest:"82,001,618",daysToCover:"1.90"},
 {settlementDate:"10/30/2026",interest:"82,794,708",daysToCover:"1.91"},
 {settlementDate:"11/30/2026",interest:"100",daysToCover:"1"},
 {settlementDate:"10/31/2026",interest:"",daysToCover:"1"},
 {settlementDate:"10/30/2026",interest:"1"}
 ]}}},now);
 assert.equal(r.length,2);assert.equal(r[0].shares,82794708);
 assert.equal(positioningRead(r,now).state,"SHORT INTEREST RISING");
 assert.equal(positioningRead([],now).fresh,false);
 assert.equal(positioningRead(r,new Date("2027-01-01")).fresh,false);
 assert.equal(decodeNasdaqQqqShortInterest({data:{symbol:"SPY",shortInterestTable:{rows:[]}}},now).length,0);
});

test("release clock distinguishes scheduled delay from overdue report",()=>{
 assert.equal(qqqReleaseClock("2026-10-30",new Date("2026-11-24T21:39:00Z")).state,"ON SCHEDULE");
 const due=qqqReleaseClock("2026-10-30",new Date("2026-11-24T21:40:00Z"));
 assert.equal(due.state,"NEW REPORT DUE");assert.equal(due.expected,"2026-11-13");
 assert.equal(due.nextRelease,"2026-12-09");
 assert.equal(qqqReleaseClock("2026-11-13",new Date("2026-11-25T12:00:00Z")).state,"ON SCHEDULE");
});
test("daily bounce alone is not multi-session confirmation and mismatched dates do not qualify",()=>{
 const good:TapeWindow={session:"2026-11-16",qqq:1,smh:2,rsp:0.5,spy:0.7};
 const missing:TapeWindow={session:null,qqq:null,smh:null,rsp:null,spy:null};
 assert.equal(qqqTapeState(good,missing,missing),"BOUNCE / COVERING UNCONFIRMED");
 assert.equal(qqqTapeState(good,{...good,session:"2026-11-13"},good),"BOUNCE / COVERING UNCONFIRMED");
 assert.equal(qqqTapeState(good,good,missing),"REVERSAL CANDIDATE");
 assert.equal(qqqTapeState(good,good,good),"MULTI-SESSION RECOVERY CANDIDATE");
 assert.equal(qqqTapeState({...good,qqq:-1,smh:-2},good,good),"TECH ROTATION / NO COVERING CONFIRMATION");
 assert.equal(qqqTapeState(missing,good,good),"INCOMPLETE MATCHED SESSIONS");
});
