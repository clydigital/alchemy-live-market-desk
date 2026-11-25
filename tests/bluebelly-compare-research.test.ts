import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCompareResearch,compareResearchLines,compareBreadthObservations,marketInternalsDiagnostics} from "../lib/bluebelly-compare-research.ts";
import {XL_COMPARISON_SYMBOLS} from "../lib/bluebelly-etf-comparison-universe.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import {buildDailyResearchPacket} from "../lib/daily-report-research-packet.ts";
const now=new Date("2026-11-24T09:00:00Z");
const row=(symbol:string,change:number,asOf="2026-11-23"):PublicMarketObservation=>({
 id:symbol,label:symbol,symbol,type:"Sector",last:100,change,change3d:change*2,change5d:change*3,changeUnit:"%",frequency:"daily",
 asOf,sourceName:"Test source",sourceUrl:"https://example.com/"+symbol
});
test("all eleven sectors use the same matched-session returns as Compare; missing is not zero",()=>{
 const observations=XL_COMPARISON_SYMBOLS.map((s,i)=>row(s,i-5));
 const result=buildCompareResearch([],observations,now);
 assert.equal(result.rotation[0].coverage,11);
 assert.equal(result.rotation[0].advancing,5);
 assert.equal(result.rotation[0].spreadPp,10);
 assert.equal(result.rotation[0].leader?.symbol,"XLY");
 assert.equal(result.rotation[0].laggard?.symbol,"XLB");
 assert.equal(result.rotation[2].spreadPp,30);
 assert.equal(result.benchmark.sectors.length,11);
 assert.equal(result.benchmark.benchmarks.length,4);
 assert.equal(result.benchmark.sectors[0].relative[0].changes[5],null);
 const partial=buildCompareResearch([],observations.slice(1),now);
 assert.equal(partial.rotation[0].status,"PARTIAL");
 assert.deepEqual(partial.rotation[0].missing,["XLB"]);
});
test("stale or unmatched data never become a valid relative market move",()=>{
 const stale=buildCompareResearch([],XL_COMPARISON_SYMBOLS.map(s=>row(s,1,"2026-10-30")),now);
 assert.equal(stale.rotation[0].coverage,0);
 assert.equal(stale.rotation[0].spreadPp,null);
 const mismatch=buildCompareResearch([],[row("SMH",2),row("QQQ",-1,"2026-11-20")],now);
 const pair=mismatch.divergences[0].pairs.find(p=>p.id==="semis-vs-nasdaq");
 assert.equal(pair?.status,"NOT_COMPARABLE");
 assert.equal(pair?.gapPp,null);
 const matched=buildCompareResearch([],[row("SMH",2),row("QQQ",-1)],now);
 const ok=matched.divergences[0].pairs.find(p=>p.id==="semis-vs-nasdaq");
 assert.equal(ok?.status,"OPPOSITE_MOVE");
 assert.equal(ok?.gapPp,3);
});
test("private report receives source-dated Compare evidence, not causal or canonical claims",()=>{
 const compare=buildCompareResearch([],XL_COMPARISON_SYMBOLS.map((s,i)=>row(s,i-5)),now);
 const packet=buildDailyResearchPacket({now:now.toISOString(),notion:{status:"NOT_CONFIGURED",sources:[],warnings:[],fetchedAt:now.toISOString()},news:[],calendar:[],prices:[],compare});
 assert.match(packet.packet,/MARKETS COMPARE/);
 assert.match(packet.packet,/11\/11/);
 assert.match(packet.packet,/UNKNOWN/);
 assert.ok(packet.sourceUrls.includes("https://example.com/XLY"));
 assert.ok(compareResearchLines(compare).some(line=>line.includes("not flows or causal evidence")));
 const route=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
 assert.match(route,/buildCompareResearch\(\[\.\.\.\(monitor\?\.rows\?\?\[\]\),\.\.\.\(monitor\?\.divergenceRows\?\?\[\]\)\]/);
 assert.match(route,/marketCompare:compare/);
 const mcp=readFileSync(new URL("../app/api/mcp/route.ts",import.meta.url),"utf8");
 assert.match(mcp,/if\(group==="compare"\)return buildCompareResearch/);
 assert.match(mcp,/validateBluebellyMcpBearer\(req\)/);
});

test("shared market internals preserve partial breadth, units, and missing horizons",()=>{
 const blank=marketInternalsDiagnostics(buildCompareResearch([],[],now));assert.equal(blank.length,3);assert.ok(blank.every(d=>d.status==="insufficient"));
 const series=["S5FI","S5TH","NDFI"].map(symbol=>({symbol,sourceName:"Fixture",sourceUrl:"https://example.com/"+symbol,points:[{date:"2026-11-20",value:42},{date:"2026-11-23",value:48}]}));
 const compare=buildCompareResearch([],compareBreadthObservations(series,now),now,series);
 const d=marketInternalsDiagnostics(compare);assert.equal(d[1].status,"ready");assert.match(d[1].interpretation,/NDFI 48.00% \(1D \+6.00 pp, 3D unavailable, 5D unavailable\)/);assert.equal(d[0].status,"insufficient");assert.equal(d[2].status,"insufficient");
 assert.ok(compareResearchLines(compare).some(line=>line.includes(d[1].headline)));
 assert.match(readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8"),/marketDiagnostics:marketInternalsDiagnostics\(compare\)/);
 assert.match(readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8"),/const divergenceRadar=compare\.radar/);
 assert.match(readFileSync(new URL("../components/blue-desk/RegimeCompareEvidence.tsx",import.meta.url),"utf8"),/marketInternalsDiagnostics\(compare\)/);
});
