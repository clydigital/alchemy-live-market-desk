import test from "node:test";
import assert from "node:assert/strict";
import {extendedTest,type ExposureSession} from "../lib/research/sentiment-exposure-regime.mjs";
const fixture=():ExposureSession[]=>Array.from({length:550},(_,i)=>({date:new Date(Date.UTC(2000,0,1+i)).toISOString().slice(0,10),price:i===400?90:i===401?80:100,vix:i===400?35:20}));
test("equal capital-days diagnostic and fixed calendar allocations",()=>{
 const a=extendedTest(fixture(),{},{},{cost:0});
 const get=(method:string)=>a.details.find(x=>x.method===method)!;
 assert.equal(a.episodes.length,1);
 assert.equal(get("Immediate").ret,25);
 assert.equal(get("75% immediate").ret,18.75);
 assert.ok(Math.abs(get("Calendar 25/25/50").exposure-100*(.25+.25*53/63+.5*43/63))<1e-9);
 assert.equal(get("Staged dip + EMA").exposure,get("Matched cash A (ex post)").exposure);
 assert.equal(get("Staged VIX + band").exposure,get("Matched cash B (ex post)").exposure);
});
test("NBER and lagged Sahm labels are descriptive and never change entries",()=>{
 const rows=fixture(),d=rows[400].date.slice(0,7);
 const lag=new Date(rows[400].date.slice(0,7)+"-01T00:00:00Z");lag.setUTCMonth(lag.getUTCMonth()-2);
 const a=extendedTest(rows,{[d]:1},{[lag.toISOString().slice(0,7)]:.5});
 const b=extendedTest(rows);
 assert.equal(a.details[0].rec,"NBER recession");
 assert.equal(a.details[0].sahmState,"Sahm >=0.5");
 assert.deepEqual(a.details.map(x=>x.ret),b.details.map(x=>x.ret));
 assert.equal(b.details[0].rec,"Unknown");
});
test("missing VIX and censored paths never create completed outcomes",()=>{
 const rows=fixture();rows[399].vix=null;
 assert.equal(extendedTest(rows).episodes.length,0);
 assert.equal(extendedTest(fixture().slice(0,450)).details.length,0);
 assert.throws(()=>extendedTest([...fixture()].reverse()));
});
