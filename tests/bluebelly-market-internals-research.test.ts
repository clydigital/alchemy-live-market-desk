import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildMarketInternalsResearch} from "../lib/bluebelly-market-internals-research.ts";
const now=new Date("2026-11-24T08:00:00Z");
test("missing inputs cannot create a positive market read",()=>{
 const r=buildMarketInternalsResearch([],[],now);
 assert.equal(r.diagnostics.length,3);
 assert.ok(r.diagnostics.every(d=>d.status==="insufficient"));
 assert.equal(r.matrix.sectors.length,11);
});
test("matched source participation is propagated with percentage-point units and missing horizons",()=>{
 const series=["S5FI","S5TH","NDFI"].map(symbol=>({symbol,sourceName:"Fixture",sourceUrl:"https://example.com/"+symbol,points:[{date:"2026-11-20",value:42},{date:"2026-11-23",value:48}]}));
 const r=buildMarketInternalsResearch([],series,now);
 assert.equal(r.diagnostics[1].status,"ready");
 assert.match(r.diagnostics[1].interpretation,/NDFI 48.00% \(1D \+6.00 pp, 3D unavailable, 5D unavailable\)/);
 assert.equal(r.diagnostics[0].status,"insufficient");
 assert.equal(r.diagnostics[2].status,"insufficient");
});
test("existing readers consume shared measured internals without changing canonical verdict",()=>{
 for(const p of ["app/api/owner/daily-research/route.ts","app/blue-desk/page.tsx","app/blue-desk/regime-watch/page.tsx","app/blue-desk/regime-watch/[lensId]/page.tsx"]){
  const s=readFileSync(p,"utf8");assert.match(s,/buildMarketInternalsResearch\(/);assert.match(s,/getSourceDatedBreadth\(true\)/);
 }
 assert.match(readFileSync("app/api/owner/daily-research/route.ts","utf8"),/marketDiagnostics:internals.diagnostics/);
 assert.match(readFileSync("app/api/mcp/route.ts","utf8"),/sectorBenchmarkComparisons:/);
});
