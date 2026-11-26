import test from "node:test";
import assert from "node:assert/strict";
import {buildResearchCharts} from "../lib/bluebelly-research-charts.ts";
import {buildCompareResearch,compareBreadthObservations} from "../lib/bluebelly-compare-research.ts";
import {XL_COMPARISON_SYMBOLS} from "../lib/bluebelly-etf-comparison-universe.ts";
import {buildDailyResearchPacket} from "../lib/daily-report-research-packet.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
const now=new Date("2026-11-24T09:00:00Z");
const row=(symbol:string,change:number,asOf="2026-11-23"):PublicMarketObservation=>({
 id:symbol,label:symbol,symbol,type:"Sector",last:100,change,change3d:change*2,change5d:change*3,changeUnit:"%",frequency:"daily",
 asOf,sourceName:"Fixture & source",sourceUrl:"https://example.com/"+symbol
});
const get=(rows:PublicMarketObservation[],clock=now)=>buildResearchCharts(buildCompareResearch([],rows,clock));
test("chart artifacts use the matched source session, explicit units and stable content hashes",()=>{
 const rows=XL_COMPARISON_SYMBOLS.map((s,i)=>row(s,i-5));
 const a=get(rows),b=get(rows,new Date("2026-11-24T12:00:00Z"));
 assert.equal(a.length,7);
 assert.equal(a[0].status,"READY");
 assert.equal(a[0].asOf,"2026-11-23");
 assert.equal(a[0].marks.length,11);
 assert.equal(a[0].unit,"%");
 assert.match(a[0].svg!,/Fixture &amp; source/);
 assert.match(a[0].svg!,/2026-11-23 UTC source date/);
 assert.equal(a[0].dataHash,b[0].dataHash);
 assert.equal(a[0].svg,b[0].svg);
 assert.notEqual(a[0].dataHash,get(rows.map((r,i)=>i===0?{...r,change:100}:r))[0].dataHash);
});
test("stale, empty and unmatched data are not rendered; partial coverage is explicit",()=>{
 const stale=get(XL_COMPARISON_SYMBOLS.map(s=>row(s,1,"2026-10-30")));
 assert.ok(stale.every(c=>c.status==="UNAVAILABLE"&&c.svg===null));
 const partial=get(XL_COMPARISON_SYMBOLS.slice(1).map(s=>row(s,1)));
 assert.equal(partial[0].status,"PARTIAL");
 assert.ok(partial[0].missing.includes("XLB"));
 const mismatched=get([row("SMH",2),row("QQQ",-1,"2026-11-20")]);
 assert.equal(mismatched.find(c=>c.id==="divergence-1D")?.svg,null);
});
test("breadth is percentage participation, not return, and stale history is excluded",()=>{
 const series=["S5FI","S5TH","NDFI"].map(symbol=>({symbol,sourceName:"Fixture",sourceUrl:"https://example.com/"+symbol,points:[{date:"2026-11-23",value:48}]}));
 const charts=get(compareBreadthObservations(series,now));
 const b=charts.find(c=>c.id==="breadth")!;
 assert.equal(b.status,"PARTIAL");
 assert.equal(b.kind,"SOURCE_DATED_SECONDARY");
 assert.equal(b.marks.length,3);
 assert.match(b.svg!,/proxies differ/);
});
test("existing private daily research packet includes the content-addressed chart artifacts",()=>{
 const compare=buildCompareResearch([],XL_COMPARISON_SYMBOLS.map((s,i)=>row(s,i-5)),now);
 const packet=buildDailyResearchPacket({now:now.toISOString(),notion:{status:"NOT_CONFIGURED",sources:[],warnings:[],fetchedAt:now.toISOString()},news:[],calendar:[],prices:[],compare});
 assert.equal(packet.researchCharts[0].dataHash,buildResearchCharts(compare)[0].dataHash);
 assert.ok(packet.researchCharts[0].svg);
});
