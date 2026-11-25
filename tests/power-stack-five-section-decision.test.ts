import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
test("owner manual decision desk preserves five-section order, shared evidence and no legacy reader",()=>{
 const p=readFileSync(new URL("../app/power-stack/page.tsx",import.meta.url),"utf8");
 const order=["<PowerStackDecisionOverview","<PowerStackBBMarketSweep","<PowerStackOpportunityQueue","<PowerStackDecisionHub"].map(x=>p.indexOf(x));
 assert.ok(order.every((x,i)=>x>=0&&(i===0||x>order[i-1])));
 assert.match(p,/getSourceDatedBreadth\(true\)/);assert.match(p,/buildCompareResearch\(/);assert.match(p,/requested.theme!=="REAL_ESTATE"/);
 assert.doesNotMatch(p,/\.from\("power_stack_quote_observations"\)/);
 const o=readFileSync(new URL("../components/blue-desk/PowerStackDecisionOverview.tsx",import.meta.url),"utf8");
 assert.match(o,/CURRENT: UNASSESSED/);assert.match(o,/previous manual assessment only/);
 const tech=readFileSync(new URL("../components/blue-desk/PowerStackBBMarketSweep.tsx",import.meta.url),"utf8");
 assert.match(tech,/r.theme!=="REAL_ESTATE"/);assert.match(tech,/o.warmup==="READY"/);assert.match(tech,/conflicted/);
});
