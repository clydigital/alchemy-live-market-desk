import test from "node:test";
import assert from "node:assert/strict";
import {projectLensReconciliation} from "../lib/bluebelly-regime-reconciliation.ts";
import {getRegimeResearchRevisions} from "../lib/bluebelly-regime-research-revisions.ts";
import type {CompareResearch} from "../lib/bluebelly-compare-research.ts";
import type {LiveLensResearch} from "../lib/bluebelly-regime-live-research.ts";
const now=new Date("2026-11-27T08:40:00Z");
const pairs=[{id:"equal-vs-cap",status:"RELATIVE_MOVE",gapPp:1.99,sourceSession:"2026-11-25"},{id:"semis-vs-nasdaq",status:"RELATIVE_MOVE",gapPp:-4.19,sourceSession:"2026-11-25"}];
const compare={rotation:[{window:"1D",asOf:"2026-11-25",coverage:11,advancing:8}],divergences:[{window:"5D",pairs}]} as unknown as CompareResearch;
const live:LiveLensResearch={facts:[],briefs:[],leads:[],partial:false};
const input={lens:"breadth" as const,now,compare,live,signal:{tone:"unknown" as const,label:"Unavailable",scope:"",readout:"",sourceDate:null,dateNote:""},reviews:getRegimeResearchRevisions(now,"breadth"),prior:null,dossier:{selectedAsOf:"2026-11-26T02:58:10Z",status:"degraded_latest" as const,usingFallback:false}};
test("prior degraded Dossier does not suppress newer source-dated review or matched rotation test",()=>{
 const r=projectLensReconciliation(input);
 assert.equal(r.dossier?.status,"degraded_latest");
 assert.match(r.marketState,/Rotation-compatible/);
 assert.match(r.marketLines.join(" "),/8\/11/);
 assert.equal(r.state,"DATED_REVIEW_AND_MARKET_TEST");
});
test("unmatched dates do not create a combined rotation interpretation",()=>{
 const c={...compare,divergences:[{window:"5D",pairs:[pairs[0],{...pairs[1],sourceSession:"2026-11-24"}]}]} as unknown as CompareResearch;
 const r=projectLensReconciliation({...input,compare:c});
 assert.doesNotMatch(r.marketState,/Rotation-compatible/);
 assert.equal(r.marketDate,null);
 assert.equal(r.state,"PARTIAL_MATCH");
});
test("new receipts flag reassessment without altering historical review or admitting leads",()=>{
 const fact={id:"a",title:"New source",detail:"",at:"2026-11-27T02:00:00Z",source:"Primary",url:"https://example.com"};
 const r=projectLensReconciliation({...input,live:{...live,facts:[fact],leads:[fact]}});
 assert.equal(r.newer.length,1);
 assert.equal(r.state,"NEW_EVIDENCE_TO_REVIEW");
 assert.ok(r.assessed.every(a=>a.reviewedOn==="2026-11-27"));
});
test("expired reviews remain insufficient even when a Dossier exists",()=>{
 const later=new Date("2026-12-30T08:00:00Z");
 const r=projectLensReconciliation({...input,now:later,reviews:getRegimeResearchRevisions(later,"breadth")});
 assert.equal(r.state,"INSUFFICIENT_REVIEW");
 assert.equal(r.assessed.length,0);
});
