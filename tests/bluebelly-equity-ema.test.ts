import {scheduledUsEquityCloseHourET} from "../lib/bluebelly-us-equity-trading-calendar.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {calculateTechnicalLevels} from "../lib/ema-sd-levels.ts";
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

test("scanner and existing owner technical pilot use identical EMA seed and SD kernel",()=>{
 const bars=data(240,i=>100+i*.25);
 const r=scanEquityEma(bars,"America/New_York",new Date("2026-11-26T00:00:00Z"))!;
 const o=r.observations.find(x=>x.frame==="D"&&x.period===200)!;
 const levels=calculateTechnicalLevels(bars.map(b=>({day:new Date(b.time*1000).toISOString().slice(0,10),close:b.close})),"1day","2026-11-25");
 const band=levels.bands.find(b=>b.period===200)!;
 assert(Math.abs(o.ema-band.ema!)<1e-7);assert(Math.abs(o.upper-band.upper!)<1e-7);assert.equal(o.warmup,"SHORT_WARMUP");
});
test("completed-session crossing events capture reversal and reclaim inside window",()=>{
 const bars=data(120,i=>i===117?80:i===118?120:100);
 const r=scanEquityEma(bars,"America/New_York",new Date("2026-11-26T00:00:00Z"))!;
 const o=r.observations.find(x=>x.frame==="D"&&x.period===20)!;
 assert(o.windows["5"]!.events.some(e=>e.boundary==="ema"&&e.direction==="down"));
 assert(o.windows["5"]!.events.some(e=>e.boundary==="ema"&&e.direction==="up"));
 assert.equal(o.warmup,"READY");
});

test("confirmed close hold requires two more completed scheduled sessions and ready warmup",()=>{
 const end=Date.parse("2026-11-25T00:00:00Z");
 const bars=Array.from({length:180},(_,i)=>end-(179-i)*86400000).filter(t=>scheduledUsEquityCloseHourET(new Date(t).toISOString().slice(0,10))!==null).map(t=>({time:t/1000,close:100}));
 for(const b of bars.slice(-3))b.close=130;
 const now=new Date("2026-11-25T22:00:00Z");
 const o=scanEquityEma(bars,"America/New_York",now)!.observations.find(o=>o.frame==="D"&&o.period===20)!;
 assert(o.closeHolds?.some(h=>h.boundary==="ema"&&h.direction==="up"&&h.status==="HOLD_CONFIRMED"&&h.consecutiveCloses===3));
 const gap=bars.filter(b=>b!==bars.at(-2));
 const g=scanEquityEma(gap,"America/New_York",now)!.observations.find(o=>o.frame==="D"&&o.period===20)!;
 assert.equal(g.closeHolds?.length,0);
 const breakOnly=bars.map((b,i)=>({...b,close:i===bars.length-1?130:100}));
 const p=scanEquityEma(breakOnly,"America/New_York",now)!.observations.find(o=>o.frame==="D"&&o.period===20)!;
 assert(p.closeHolds?.some(h=>h.boundary==="ema"&&h.status==="BREAK_ONLY"));
});
