import test from "node:test";
import assert from "node:assert/strict";
import {scanEquityEma} from "../lib/bluebelly-equity-ema.ts";
const data=(count:number,fn:(i:number)=>number)=>Array.from({length:count},(_,i)=>({time:Date.UTC(2024,0,1+i)/1000,close:fn(i)}));
test("flat EMA and SD, no fake monthly history",()=>{
 const r=scanEquityEma(data(240,()=>100),"America/New_York",new Date("2026-11-26T00:00:00Z"))!;
 const o=r.observations.find(x=>x.frame==="D"&&x.period===200)!;
 assert.equal(o.ema,100);assert.equal(o.upper,100);assert.equal(o.lower,100);assert.equal(o.side,"at");assert.equal(o.windows["5"]?.emaCross,"none");assert(r.unavailable.includes("M20"));
});
test("falling through an EMA and lower SD is separate from cheapness",()=>{
 const r=scanEquityEma(data(240,i=>i<237?100:80),"America/New_York",new Date("2026-11-26T00:00:00Z"))!;
 const o=r.observations.find(x=>x.frame==="D"&&x.period===20)!;
 assert.equal(o.side,"below");assert.equal(o.band,"below_lower");assert.equal(o.windows["3"]?.emaCross,"down");assert.equal(o.windows["3"]?.lowerCross,"down");
});
test("excludes current uncompleted daily observation",()=>{
 const bars=data(25,()=>100);const last=bars.at(-1)!;
 const r=scanEquityEma(bars,"America/New_York",new Date(last.time*1000+12*3600000))!;
 assert.equal(r.asOf,new Date(bars.at(-2)!.time*1000).toISOString().slice(0,10));
});
