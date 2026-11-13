import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {privateResearchFocus,RESEARCH_FOCUS} from "../lib/power-stack-investor-research-focus.ts";
const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("curated issuer priorities are only read for owner-tracked symbols and source review expires",()=>{
 const active=privateResearchFocus(["GRAB","FCX","NVDA"],new Date("2026-11-13T05:00:00Z"));
 assert.deepEqual(active.map(x=>x.ticker),["FCX","GRAB"]);
 assert.ok(active.every(x=>!x.expired));
 const old=privateResearchFocus(["GRAB"],new Date("2026-11-25T00:00:00Z"));
 assert.equal(old[0].expired,true);
 assert.equal(privateResearchFocus([],new Date("2026-11-13")).length,0);
});
test("every priority has original-source receipts and explicit thesis rejection; no target or bargain claim",()=>{
 assert.equal(new Set(RESEARCH_FOCUS.map(x=>x.ticker)).size,RESEARCH_FOCUS.length);
 for(const item of RESEARCH_FOCUS){
  assert.ok(item.contrast.length>=55&&item.firstRejection.length>=40&&item.nextTest.length>=45);
  assert.ok(item.sources.length>=1);
  assert.ok(item.sources.every(s=>s.url.startsWith("https://")&&(s.url.includes("sec.gov")||s.url.includes("investors.")||s.url.includes("investor."))));
 }
});
test("private review board is inserted after existing owner gate and never leaked to public routes",()=>{
 const page=file("app/power-stack/page.tsx");
 const focus=file("components/blue-desk/PowerStackResearchFocus.tsx");
 const regime=file("app/blue-desk/regime-watch/page.tsx");
 assert.ok(page.indexOf("PowerStackResearchFocus assets={issuers}")>page.indexOf("if (allowError || !allowed) redirect"));
 assert.match(page,/ready\?<PowerStackResearchFocus assets=\{issuers\}/);
 assert.match(page,/repricePegResearch\(record as PegResearchObservation,ownerQuote/);
 assert.match(page,/source_recorded_at:ownerQuote.source_recorded_at/);
 assert.match(focus,/data-power-stack-focus="owner-only-hypotheses-not-approved-investments"/);
 assert.match(focus,/First rejection:/);
 assert.match(focus,/Deciding test:/);
 assert.doesNotMatch(regime,/PowerStackResearchFocus|power_stack_peg_research_observations/);
});
