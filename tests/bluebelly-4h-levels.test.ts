import test from "node:test";
import assert from "node:assert/strict";
import {parseFourH,planFourHWatch} from "../lib/bluebelly-4h-levels.ts";
import {readFileSync} from "node:fs";
const now=new Date("2026-11-26T05:00:00Z");
const end=Date.parse("2026-11-26T04:00:00Z");
const values=Array.from({length:105},(_,i)=>({datetime:new Date(end-(104-i)*14400000).toISOString().slice(0,19).replace("T"," "),close:String(100+i)}));
const payload=(v=values)=>({meta:{symbol:"XAU/USD",interval:"4h",currency_base:"XAU",currency_quote:"USD"},values:v});
test("only elapsed UTC windows are admitted; common EMA periods remain intact",()=>{
 const x=parseFourH(payload(),"XAU/USD",now);
 assert.equal(x.status,"INDICATIVE");assert.equal(x.asOf,"2026-11-26T04:00:00.000Z");assert.equal(x.sampleCount,104);assert.equal(x.close,203);
 assert.equal(x.bands[0].status,"READY");assert.equal(x.bands[3].status,"INSUFFICIENT");
});
test("duplicates, future timestamps, overlap and listing mismatch fail closed",()=>{
 assert.equal(parseFourH(payload([...values,values[0]]),"XAU/USD",now).status,"INVALID_HISTORY");
 assert.equal(parseFourH(payload([...values,{datetime:"2026-11-26 08:00:00",close:"200"}]),"XAU/USD",now).status,"INVALID_HISTORY");
 assert.equal(parseFourH(payload(),"USD/JPY",now).status,"INVALID_HISTORY");
 assert.equal(parseFourH(payload([...values,{datetime:"2026-11-25 23:00:00",close:"200"}]),"XAU/USD",now).status,"INVALID_HISTORY");
});
test("gaps are explicit and stale history remains non-actionable",()=>{
 assert.equal(parseFourH(payload(values.filter((_,i)=>i!==50)),"XAU/USD",now).gapCount,1);
 assert.equal(parseFourH(payload(values.slice(0,-5)),"XAU/USD",now).status,"STALE");
});
test("4H read is owner-gated, opt-in and not called by scheduled pilot",()=>{
 const page=readFileSync(new URL("../app/market-tools/page.tsx",import.meta.url),"utf8");
 const provider=readFileSync(new URL("../lib/providers/twelve-data-ema-history.ts",import.meta.url),"utf8");
 assert.match(page,/access\.ok&&view==="technical"&&typeof options\.fourh==="string"\?await readFourH/);
 assert.match(provider,/timezone:"UTC"/);assert.match(provider,/outputsize:"1200"/);
 const pilot=provider.split("export async function refreshTechnicalPilot")[1].split("const cachedFourH")[0];
 assert.doesNotMatch(pilot,/readFourH|cachedFourH/);
});

test("4H boundary events require ready, adjacent elapsed windows",()=>{
 const end=Date.parse("2026-11-26T00:00:00Z");
 const series=Array.from({length:105},(_,i)=>({datetime:new Date(end-(104-i)*14400000).toISOString().slice(0,19).replace("T"," "),close:String(i===104?110:100)}));
 const r=parseFourH(payload(series),"XAU/USD",now);
 assert.ok(r.events.some(e=>e.period===20&&e.kind==="CROSS"&&e.boundary==="upper"&&e.direction==="up"));
 assert.equal(parseFourH(payload(series.filter((_,i)=>i!==103)),"XAU/USD",now).events.length,0);
 assert.equal(parseFourH(payload(series),"XAU/USD",new Date("2026-11-27T05:00:00Z")).events.length,0);
});

test("priority batch planning deduplicates, excludes unsupported, caps fanout and never repeats core",()=>{
 const allowed=["NVDA","PWR","AMD","MU","AVGO","TTWO","TLT","SPY"];
 const priority=["pwr","NVDA","PWR","MAA","SPY","AMD","MU","AVGO","TTWO","TLT","BAD"];
 const a=planFourHWatch(priority,allowed,"1");
 assert.deepEqual(a.symbols,["PWR","NVDA","AMD","MU","AVGO","TTWO"]);
 assert.deepEqual(a.excluded,["MAA","BAD"]);assert.equal(a.batches,2);
 assert.deepEqual(planFourHWatch(priority,allowed,"2").symbols,["TLT"]);
 assert.equal(planFourHWatch(priority,allowed,"999").symbols.length,0);
 assert.equal(planFourHWatch(priority,allowed,undefined).symbols.length,0);
 assert.equal(planFourHWatch(priority,allowed,"scan").symbols.length,6);
});
