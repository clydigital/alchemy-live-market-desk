import test from "node:test";
import assert from "node:assert/strict";
import {buildXlBenchmarkSynergy} from "../lib/bluebelly-xl-benchmark-synergy.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
const now=new Date("2026-11-24T12:00:00Z");
const dates=Array.from({length:100},(_,i)=>new Date(Date.UTC(2026,10,23-i))).filter(d=>d.getUTCDay()!==0&&d.getUTCDay()!==6).reverse().slice(-64);
function series(id:string,ret:(i:number)=>number):MarketMonitorRow{
 let value=100;const points=dates.map((d,i)=>{if(i)value*=1+ret(i);return {time:+d/1000,close:value};});
 return {id,symbol:id.toUpperCase(),label:id,type:"Sector",frequency:"daily",asOf:"2026-11-23",last:points.at(-1)!.close,points,sourceUrl:"https://example.com/"+id} as MarketMonitorRow;
}
const base=(i:number)=>i%2?.01:-.009;
const fixtures=[series("xlk",base),series("ndx",base),series("spx",i=>i%3?.005:-.007),series("rsp",i=>i%5?.006:-.012),series("dow",i=>i%7?.004:-.008)];
test("all eleven sectors and four benchmark identities; exact return synergy uses common intervals",()=>{
 const result=buildXlBenchmarkSynergy(fixtures,now);
 assert.equal(result.sectors.length,11);assert.equal(result.benchmarks.length,4);
 const x=result.sectors.find(r=>r.symbol==="XLK")!;
 assert.equal(x.correlation20.best,"ndx");assert.equal(x.correlation60.best,"ndx");
 assert.ok(Math.abs(x.correlation20.values.find(v=>v.id==="ndx")!.correlation!-1)<1e-10);
 assert.equal(x.relative.find(v=>v.id==="ndx")!.changes[5],0);
 assert.ok(x.relative.find(v=>v.id==="spx")!.changes[5]!==null);
 assert.equal(result.sectors.find(r=>r.symbol==="XLP")!.correlation20.best,null);
});
test("partial benchmark ranking is labelled by coverage; no relative return over mismatched session intervals",()=>{
 const missing=buildXlBenchmarkSynergy(fixtures.filter(r=>r.id!=="dow"),now).sectors.find(r=>r.symbol==="XLK")!;
 assert.equal(missing.correlation20.best,"ndx");assert.equal(missing.correlation20.coverage,3);assert.equal(missing.relative.find(v=>v.id==="dow")!.changes[5],null);
 const gap=fixtures.map(r=>r.id==="ndx"?{...r,points:r.points.filter((_,i)=>i!==r.points.length-2)}:r);
 const x=buildXlBenchmarkSynergy(gap,now).sectors.find(r=>r.symbol==="XLK")!;
 assert.equal(x.relative.find(v=>v.id==="ndx")!.changes[1],null);
 assert.equal(x.relative.find(v=>v.id==="ndx")!.changes[5],null);
});
test("stale rows cannot be used to create a current ranking",()=>{
 const result=buildXlBenchmarkSynergy(fixtures,new Date("2026-12-10"));
 assert.ok(result.sectors.every(s=>s.correlation20.best===null&&s.relative.every(r=>r.changes[5]===null)));
});
