import test from "node:test";import assert from "node:assert/strict";
import {projectPublicEquityCoverage} from "../lib/bluebelly-equity-coverage.ts";
import {scanEquityEma} from "../lib/bluebelly-equity-ema.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
test("quote quality distinguishes lagging US coverage and qualified bands",()=>{
 const now=new Date("2026-11-25T22:00:00Z");
 const bars=Array.from({length:300},(_,i)=>({time:Date.parse("2026-11-25T00:00:00Z")/1000-(299-i)*86400,close:100}));
 const row=(symbol:string,asOf:string)=>({symbol,frequency:"daily",asOf,last:100,currency:"USD",sourceName:"Example",sourceUrl:"https://example.com",emaScan:scanEquityEma(bars.filter(b=>new Date(b.time*1000).toISOString().slice(0,10)<=asOf),"America/New_York",now)}) as MarketMonitorRow;
 const p=projectPublicEquityCoverage([row("NVDA","2026-11-24"),row("CI","2026-11-25")],now);
 assert.equal(p.coverage.sourceDated,2);assert.equal(p.quality!.latestUs,1);assert.equal(p.quality!.behindUs,1);
 assert.equal(p.quality!.unavailableUs,p.coverage.US-2);
 const d=p.quality!.technical.find(x=>x.key==="D20")!;
 assert.equal(d.ready,1);assert.equal(d.unavailable,p.coverage.tracked-1);
 const m=p.quality!.technical.find(x=>x.key==="M200")!;
 assert.equal(m.ready,0);assert.equal(m.unavailable,p.coverage.tracked);
 assert.equal(p.rows.find(x=>x.ticker==="CI")!.emaScan!.observations.find(x=>x.frame==="D"&&x.period===20)!.sampleCount,300);
});