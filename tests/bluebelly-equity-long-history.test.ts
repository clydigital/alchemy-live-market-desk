import test from "node:test";
import assert from "node:assert/strict";
import {findStockIdentity} from "../lib/bluebelly-equity-universe.ts";
import {parseLongEquityHistory,readLongEquityHistory,recentUsWindowComplete} from "../lib/bluebelly-equity-long-history.ts";
const spec=findStockIdentity("CI")!;
const now=new Date("2026-11-26T02:00:00Z");
const dates=["2026-11-23","2026-11-24","2026-11-25"];
const sample={chart:{result:[{meta:{symbol:"CI",currency:"USD",instrumentType:"EQUITY",exchangeTimezoneName:"America/New_York"},timestamp:dates.map(x=>Date.parse(x+"T15:00:00Z")/1000),indicators:{quote:[{close:[275,270,268]}]}}]}};
const fetcher=(async()=>new Response(JSON.stringify(sample),{status:200})) as typeof fetch;
test("long BB history validates listing currency and completed source sessions",()=>{
 assert.equal(parseLongEquityHistory(sample,spec,now).length,3);
 assert.throws(()=>parseLongEquityHistory(sample,findStockIdentity("ASML.AS")!,now),/mismatch/);
});
test("long history matches canonical date and price; no source substitution",async()=>{
 const a=await readLongEquityHistory(spec,{asOf:"2026-11-25",price:268},now,fetcher);
 assert.equal(a.status,"SOURCE_DATED");assert.equal(a.asOf,"2026-11-25");assert.equal(a.scan?.unavailable.length,12);
 const b=await readLongEquityHistory(spec,{asOf:"2026-11-25",price:280},now,fetcher);
 assert.equal(b.status,"SOURCE_MISMATCH");assert.equal(b.scan,null);
});

test("manual history rejects incompatible instrument metadata and duplicate dates",()=>{
 const bad=structuredClone(sample);bad.chart.result[0].meta.instrumentType="ETF";
 assert.throws(()=>parseLongEquityHistory(bad,spec,now),/mismatch/);
 const duplicate=structuredClone(sample);duplicate.chart.result[0].timestamp[1]=duplicate.chart.result[0].timestamp[0];
 assert.throws(()=>parseLongEquityHistory(duplicate,spec,now),/Duplicate/);
});
test("US manual history excludes holiday and unfinished bars, honours early close",()=>{
 const p=structuredClone(sample);
 p.chart.result[0].timestamp=["2026-11-23","2026-11-24","2026-11-25","2026-11-26","2026-11-27"].map(d=>Date.parse(d+"T15:00:00Z")/1000);
 p.chart.result[0].indicators.quote[0].close=[275,270,268,999,266];
 assert.equal(parseLongEquityHistory(p,spec,new Date("2026-11-27T17:59:00Z")).length,3);
 const bars=parseLongEquityHistory(p,spec,new Date("2026-11-27T18:16:00Z"));
 assert.equal(bars.length,4);assert.equal(bars.at(-1)?.close,266);
});
test("official recent US session gaps cannot compress crossing windows",()=>{
 const days=["2026-11-18","2026-11-19","2026-11-20","2026-11-23","2026-11-24","2026-11-25"];
 const rows=days.map(d=>({time:Date.parse(d+"T00:00:00Z")/1000,close:100}));
 assert.equal(recentUsWindowComplete(rows),true);
 assert.equal(recentUsWindowComplete([{time:Date.parse("2026-11-17T00:00:00Z")/1000,close:100},...rows.filter((_,i)=>i!==3)]),false);
});
