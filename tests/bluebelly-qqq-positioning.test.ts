import test from "node:test";import assert from "node:assert/strict";
import {decodeNasdaqQqqShortInterest,positioningRead} from "../lib/bluebelly-qqq-positioning-core.ts";
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
