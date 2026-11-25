import test from "node:test";
import assert from "node:assert/strict";
import {findStockIdentity} from "../lib/bluebelly-equity-universe.ts";
import {parseLongEquityHistory,readLongEquityHistory} from "../lib/bluebelly-equity-long-history.ts";
const spec=findStockIdentity("CI")!;
const now=new Date("2026-11-26T02:00:00Z");
const dates=["2026-11-23","2026-11-24","2026-11-25"];
const sample={chart:{result:[{meta:{symbol:"CI",currency:"USD"},timestamp:dates.map(x=>Date.parse(x+"T15:00:00Z")/1000),indicators:{quote:[{close:[275,270,268]}]}}]}};
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
