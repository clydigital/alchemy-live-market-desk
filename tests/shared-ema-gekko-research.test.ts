import test from "node:test";
import assert from "node:assert/strict";
import {completedBoundaryEvents,calculateTechnicalLevels} from "../lib/ema-sd-levels.ts";
import {gekkoStockResearchUrl} from "../lib/gekko-stock-research.ts";
test("shared event engine identifies cross and hold only with sufficient warm-up",()=>{
 const seed=Array(110).fill(100);
 assert.ok(completedBoundaryEvents([...seed,110],"2026-11-23").some(e=>e.period===20&&e.boundary==="ema"&&e.kind==="CROSS"&&e.direction==="up"));
 assert.ok(completedBoundaryEvents([...seed,110,111,112],"2026-11-23").some(e=>e.period===20&&e.boundary==="ema"&&e.kind==="HOLD"&&e.direction==="up"));
 assert.equal(completedBoundaryEvents([100,110],"2026-11-23").length,0);
});
test("stale weekly data and unverified daily dates produce no events",()=>{
 const rows=Array.from({length:110},(_,i)=>({day:new Date(Date.UTC(2023,0,2+7*i)).toISOString().slice(0,10),close:i===109?110:100}));
 assert.equal(calculateTechnicalLevels(rows,"1week","2026-11-27").events?.length,0);
 const daily=Array.from({length:110},(_,i)=>({day:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),close:i===109?110:100}));
 assert.equal(calculateTechnicalLevels(daily,"1day","2025-04-21").events?.length,0);
});
test("Gekko links are restricted to plain US issuer symbols",()=>{
 assert.equal(gekkoStockResearchUrl("nvda","US"),"https://www.gekko.app/stocks/nvda");
 assert.equal(gekkoStockResearchUrl("TENAGA","MY"),null);
 assert.equal(gekkoStockResearchUrl("../login","US"),null);
});
